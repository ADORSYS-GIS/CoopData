use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::sync::Arc;
use serde_json::json;

use crate::api::dto::questionnaire::{FinancialQuestionnaireRequest, NonFinancialQuestionnaireRequest};
use crate::api::dto::common::ErrorResponse;
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
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

    // Serialize payload to JSON for metadata persistence
    let metadata_value = serde_json::to_value(&body)
        .map_err(|e| AppError::BadRequest(format!("Failed to serialize questionnaire: {e}")))?;

    // Save/update submission metadata in DB
    if let Some(existing) = state.submissions.find_by_id(submission_id).await? {
        let mut active: crate::entities::submission::ActiveModel = existing.into();
        active.metadata = sea_orm::Set(metadata_value);
        active.updated_at = sea_orm::Set(chrono::Utc::now());
        active.update(&state.db).await?;
    } else {
        let active = crate::entities::submission::ActiveModel {
            id: sea_orm::Set(submission_id),
            reference: sea_orm::Set(Some(format!("REF-FN-{}", &submission_id.to_string()[..8]))),
            cooperative_id: sea_orm::Set(coop_id),
            reporting_year: sea_orm::Set(chrono::Datelike::year(&chrono::Utc::now())),
            status: sea_orm::Set(crate::entities::enums::SubmissionStatus::Draft),
            current_tier: sea_orm::Set(crate::entities::enums::ReviewTier::Cooperative),
            submitted_by: sea_orm::Set(uuid::Uuid::parse_str(&claims.sub).ok()),
            submitted_at: sea_orm::Set(Some(chrono::Utc::now())),
            last_reviewed_by: sea_orm::Set(None),
            last_reviewed_at: sea_orm::Set(None),
            rejection_reason: sea_orm::Set(None),
            priority: sea_orm::Set("normal".into()),
            metadata: sea_orm::Set(metadata_value),
            created_at: sea_orm::Set(chrono::Utc::now()),
            updated_at: sea_orm::Set(chrono::Utc::now()),
        };
        state.submissions.create(active).await?;
    }
    
    // Log the audit event
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "financial_questionnaire",
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
            "message": "Financial questionnaire submitted and metadata persisted successfully",
            "submission_id": submission_id
        }))
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

    // Serialize payload to JSON for metadata persistence
    let metadata_value = serde_json::to_value(&body)
        .map_err(|e| AppError::BadRequest(format!("Failed to serialize questionnaire: {e}")))?;

    // Save/update submission metadata in DB
    if let Some(existing) = state.submissions.find_by_id(submission_id).await? {
        let mut active: crate::entities::submission::ActiveModel = existing.into();
        active.metadata = sea_orm::Set(metadata_value);
        active.updated_at = sea_orm::Set(chrono::Utc::now());
        active.update(&state.db).await?;
    } else {
        let active = crate::entities::submission::ActiveModel {
            id: sea_orm::Set(submission_id),
            reference: sea_orm::Set(Some(format!("REF-NF-{}", &submission_id.to_string()[..8]))),
            cooperative_id: sea_orm::Set(coop_id),
            reporting_year: sea_orm::Set(chrono::Datelike::year(&chrono::Utc::now())),
            status: sea_orm::Set(crate::entities::enums::SubmissionStatus::Draft),
            current_tier: sea_orm::Set(crate::entities::enums::ReviewTier::Cooperative),
            submitted_by: sea_orm::Set(uuid::Uuid::parse_str(&claims.sub).ok()),
            submitted_at: sea_orm::Set(Some(chrono::Utc::now())),
            last_reviewed_by: sea_orm::Set(None),
            last_reviewed_at: sea_orm::Set(None),
            rejection_reason: sea_orm::Set(None),
            priority: sea_orm::Set("normal".into()),
            metadata: sea_orm::Set(metadata_value),
            created_at: sea_orm::Set(chrono::Utc::now()),
            updated_at: sea_orm::Set(chrono::Utc::now()),
        };
        state.submissions.create(active).await?;
    }
    
    // Log the audit event
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
            "message": "Non-Financial questionnaire submitted and metadata persisted successfully",
            "submission_id": submission_id
        }))
    ))
}
