use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use sea_orm::ActiveModelTrait;
use serde_json::json;
use std::sync::Arc;

use crate::api::dto::questionnaire::{
    FinancialQuestionnaireRequest, NonFinancialQuestionnaireRequest,
};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::questionnaire_converter;
use crate::AppState;

const QUESTIONNAIRE_TAG: &str = "Questionnaire";

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/questionnaire/financial",
    request_body = FinancialQuestionnaireRequest,
    responses(
        (status = 201, description = "Financial questionnaire saved successfully", body = serde_json::Value),
        (status = 400, description = "Validation error", body = ErrorResponse),
    ),
    tag = QUESTIONNAIRE_TAG,
)]
pub async fn submit_financial_questionnaire(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<FinancialQuestionnaireRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let submission_id = body.submission_id;

    let sub = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let mut existing_metadata = sub.metadata.clone();
    let questionnaire_json = serde_json::to_value(&body)
        .map_err(|e| AppError::BadRequest(format!("Failed to serialize questionnaire: {e}")))?;
    existing_metadata["financial_questionnaire"] = questionnaire_json;

    let metadata_value = existing_metadata;
    let mut active: crate::entities::submission::ActiveModel = sub.clone().into();
    active.metadata = sea_orm::Set(metadata_value);
    active.updated_at = sea_orm::Set(chrono::Utc::now());
    active.update(&state.db).await?;

    let (fs_model, mut line_items) = questionnaire_converter::convert_financial_questionnaire(
        &body,
        submission_id,
        coop_id,
        sub.reporting_year,
    );

    let fs_id = if let Some(existing_fs) = state.financial_statement_repo.find_by_submission(submission_id).await? {
        state.line_item_repo.delete_by_financial_statement(existing_fs.id).await?;
        existing_fs.id
    } else {
        let fs = state.financial_statement_repo.create(fs_model).await?;
        fs.id
    };

    for mut item in line_items {
        item.financial_statement_id = sea_orm::Set(fs_id);
        state.line_item_repo.create(item).await?;
    }

    if let Ok(Some(sec)) = state
        .section_repo
        .find_by_submission_and_section(submission_id, "financial")
        .await
    {
        let _ = state.section_repo.update_status(sec.id, "ready").await;
    }

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "financial_questionnaire",
            Some(&submission_id.to_string()),
            Some(json!({ "cooperative_id": coop_id, "fs_id": fs_id })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Financial questionnaire submitted and persisted successfully",
            "submission_id": submission_id,
            "financial_statement_id": fs_id
        })),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/questionnaire/non-financial",
    request_body = NonFinancialQuestionnaireRequest,
    responses(
        (status = 201, description = "Non-Financial questionnaire saved successfully", body = serde_json::Value),
        (status = 400, description = "Validation error", body = ErrorResponse),
    ),
    tag = QUESTIONNAIRE_TAG,
)]
pub async fn submit_non_financial_questionnaire(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<NonFinancialQuestionnaireRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let submission_id = body.submission_id;

    let sub = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let mut existing_metadata = sub.metadata.clone();
    let questionnaire_json = serde_json::to_value(&body)
        .map_err(|e| AppError::BadRequest(format!("Failed to serialize questionnaire: {e}")))?;
    existing_metadata["non_financial_questionnaire"] = questionnaire_json;

    let metadata_value = existing_metadata;
    let mut active: crate::entities::submission::ActiveModel = sub.clone().into();
    active.metadata = sea_orm::Set(metadata_value);
    active.updated_at = sea_orm::Set(chrono::Utc::now());
    active.update(&state.db).await?;

    let nf_sections = &[
        "members",
        "savings",
        "loans",
        "fixed_deposits",
        "farm_coop",
        "indicators",
    ];
    for section_name in nf_sections {
        if let Ok(Some(sec)) = state
            .section_repo
            .find_by_submission_and_section(submission_id, section_name)
            .await
        {
            let _ = state.section_repo.update_status(sec.id, "ready").await;
        }
    }

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "non_financial_questionnaire",
            Some(&submission_id.to_string()),
            Some(json!({ "cooperative_id": coop_id })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Non-Financial questionnaire submitted and persisted successfully",
            "submission_id": submission_id
        })),
    ))
}
