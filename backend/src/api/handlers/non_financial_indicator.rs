use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::non_financial_indicator::{
    ConsolidationResponse, CreateIndicatorRequest, IndicatorCatalogResponse,
    IndicatorEntryResponse, SaveEntriesRequest, UpdateIndicatorRequest,
};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::entities::enums::IndicatorDataType;
use crate::error::{AppError, AppResult};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/non-financial-indicators/catalog",
    params(
        ("coop_type" = Option<String>, Query, description = "Filter by cooperative type")
    ),
    responses(
        (status = 200, description = "Indicator catalog list", body = Vec<IndicatorCatalogResponse>),
        (status = 401, description = "Unauthorized")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn list_catalog(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let items = if let Some(coop_type) = params.get("coop_type") {
        state
            .non_financial_indicator_catalog_repo
            .find_by_coop_type(coop_type)
            .await?
    } else {
        state
            .non_financial_indicator_catalog_repo
            .find_all()
            .await?
    };
    let res: Vec<IndicatorCatalogResponse> = items.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(res)))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/non-financial-indicators/catalog",
    request_body = CreateIndicatorRequest,
    responses(
        (status = 201, description = "Catalog indicator created", body = IndicatorCatalogResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden - Ministry only"),
        (status = 409, description = "Indicator name already exists")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn create_catalog_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateIndicatorRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(AppError::Forbidden("Ministry role required".into()));
    }
    if body.indicator_name.trim().is_empty() {
        return Err(AppError::BadRequest("Indicator name is required".into()));
    }
    if body.display_name.trim().is_empty() {
        return Err(AppError::BadRequest("Display name is required".into()));
    }

    let active = crate::entities::non_financial_indicator_catalog::ActiveModel {
        id: sea_orm::Set(Uuid::new_v4()),
        indicator_name: sea_orm::Set(body.indicator_name.trim().to_string()),
        display_name: sea_orm::Set(body.display_name.trim().to_string()),
        description: sea_orm::Set(body.description.map(|d| d.trim().to_string())),
        data_type: sea_orm::Set(body.data_type),
        coop_type: sea_orm::Set(body.coop_type.map(|c| c.trim().to_string())),
        is_required: sea_orm::Set(body.is_required),
        created_at: sea_orm::Set(chrono::Utc::now()),
        updated_at: sea_orm::Set(chrono::Utc::now()),
    };

    let created = state
        .non_financial_indicator_catalog_repo
        .create(active)
        .await?;

    let _ = state
        .audit
        .log(
            &claims,
            "CREATE_INDICATOR_CATALOG",
            "indicator_catalog",
            Some(&created.id.to_string()),
            Some(serde_json::json!({
                "indicator_name": &created.indicator_name,
                "data_type": &created.data_type.as_str(),
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await;

    tracing::info!(indicator_name = %created.indicator_name, "Indicator catalog item created");
    Ok((
        StatusCode::CREATED,
        Json(IndicatorCatalogResponse::from(created)),
    ))
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/non-financial-indicators/catalog/{id}",
    params(
        ("id" = Uuid, Path, description = "Catalog indicator ID")
    ),
    request_body = UpdateIndicatorRequest,
    responses(
        (status = 200, description = "Catalog indicator updated", body = IndicatorCatalogResponse),
        (status = 403, description = "Forbidden - Ministry only"),
        (status = 404, description = "Indicator not found")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn update_catalog_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIndicatorRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(AppError::Forbidden("Ministry role required".into()));
    }
    let existing = state
        .non_financial_indicator_catalog_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Indicator not found".into()))?;

    let mut active: crate::entities::non_financial_indicator_catalog::ActiveModel = existing.into();
    active.display_name = sea_orm::Set(body.display_name.trim().to_string());
    active.description = sea_orm::Set(body.description.map(|d| d.trim().to_string()));
    active.data_type = sea_orm::Set(body.data_type);
    active.coop_type = sea_orm::Set(body.coop_type.map(|c| c.trim().to_string()));
    active.is_required = sea_orm::Set(body.is_required);
    active.updated_at = sea_orm::Set(chrono::Utc::now());

    let updated = state
        .non_financial_indicator_catalog_repo
        .update(active)
        .await?;

    let _ = state
        .audit
        .log(
            &claims,
            "UPDATE_INDICATOR_CATALOG",
            "indicator_catalog",
            Some(&updated.id.to_string()),
            Some(serde_json::json!({
                "indicator_name": &updated.indicator_name,
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await;

    tracing::info!(id = %id, "Indicator catalog item updated");
    Ok((StatusCode::OK, Json(IndicatorCatalogResponse::from(updated))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/non-financial-indicators/catalog/{id}",
    params(
        ("id" = Uuid, Path, description = "Catalog indicator ID")
    ),
    responses(
        (status = 204, description = "Deleted"),
        (status = 403, description = "Forbidden - Ministry only"),
        (status = 404, description = "Indicator not found"),
        (status = 409, description = "Cannot delete: reported entries exist")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn delete_catalog_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(AppError::Forbidden("Ministry role required".into()));
    }
    let _existing = state
        .non_financial_indicator_catalog_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Indicator not found".into()))?;

    state
        .non_financial_indicator_catalog_repo
        .delete(id)
        .await?;

    let _ = state
        .audit
        .log(
            &claims,
            "DELETE_INDICATOR_CATALOG",
            "indicator_catalog",
            Some(&id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await;

    tracing::info!(id = %id, "Indicator catalog item deleted");
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
    ),
    responses(
        (status = 200, description = "Indicator entries for submission", body = Vec<IndicatorEntryResponse>),
        (status = 404, description = "Submission not found")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn get_submission_entries(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let _sub = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let entries = state
        .non_financial_indicator_entry_repo
        .find_by_submission_id(id)
        .await?;
    let res: Vec<IndicatorEntryResponse> = entries.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(res)))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
    ),
    request_body = SaveEntriesRequest,
    responses(
        (status = 200, description = "Entries saved", body = Vec<IndicatorEntryResponse>),
        (status = 400, description = "Invalid submission state or bad values"),
        (status = 403, description = "Scope violation"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn save_submission_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveEntriesRequest>,
) -> AppResult<impl IntoResponse> {
    let sub = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if sub.status != crate::entities::enums::SubmissionStatus::Draft {
        return Err(AppError::BadRequest(
            "Cannot edit indicators: submission is not in Draft status".into(),
        ));
    }

    if claims.is_cooperative() {
        let caller_coop =
            super::cooperative::resolve_caller_cooperative(&state, &claims).await?;
        if caller_coop.id != sub.cooperative_id {
            return Err(AppError::Forbidden(
                "Access denied: submission belongs to a different cooperative".into(),
            ));
        }
    }

    let mut active_entries = Vec::new();
    for entry in body.entries {
        let catalog = state
            .non_financial_indicator_catalog_repo
            .find_by_id(entry.catalog_id)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Indicator catalog item not found: {}",
                    entry.catalog_id
                ))
            })?;

        if catalog.is_required {
            match catalog.data_type {
                IndicatorDataType::Number => {
                    if entry.value_numeric.is_none() {
                        return Err(AppError::BadRequest(format!(
                            "Indicator '{}' requires a numeric value",
                            catalog.indicator_name
                        )));
                    }
                }
                IndicatorDataType::Text => {
                    let empty = entry.value_text.as_deref()
                        .map(|t| t.trim().is_empty())
                        .unwrap_or(true);
                    if empty {
                        return Err(AppError::BadRequest(format!(
                            "Indicator '{}' requires a text value",
                            catalog.indicator_name
                        )));
                    }
                }
                IndicatorDataType::Boolean => {
                    // Boolean defaults to false — always has a value
                }
            }
        }

        let active = crate::entities::non_financial_indicator_entry::ActiveModel {
            id: sea_orm::Set(Uuid::new_v4()),
            submission_id: sea_orm::Set(id),
            catalog_id: sea_orm::Set(entry.catalog_id),
            value_numeric: sea_orm::Set(entry.value_numeric.map(|f| rust_decimal::Decimal::try_from(f).unwrap_or_default())),
            value_text: sea_orm::Set(entry.value_text),
            value_boolean: sea_orm::Set(entry.value_boolean),
            created_at: sea_orm::Set(chrono::Utc::now()),
            updated_at: sea_orm::Set(chrono::Utc::now()),
        };
        active_entries.push(active);
    }

    let saved = state
        .non_financial_indicator_entry_repo
        .save_batch(id, active_entries)
        .await?;

    // Determine section completeness: check if all required catalog items for this
    // cooperative type have a non-null value in the current saved entries.
    let coop_profile = state.cooperative_repo.find_by_id(sub.cooperative_id).await?;
    let coop_type_str = coop_profile
        .and_then(|c| c.institution_type)
        .map(|t| t.as_str().to_string());

    let required_catalog = if let Some(ref ct) = coop_type_str {
        state
            .non_financial_indicator_catalog_repo
            .find_by_coop_type(ct)
            .await?
    } else {
        state
            .non_financial_indicator_catalog_repo
            .find_all()
            .await?
    };

    // Use all current entries (includes previously saved ones too)
    let current_entries = state
        .non_financial_indicator_entry_repo
        .find_by_submission_id(id)
        .await?;

    let required_items: Vec<_> = required_catalog.iter().filter(|i| i.is_required).collect();

    let all_required_filled = if required_items.is_empty() {
        // No required indicators defined — mark ready if anything was saved
        !current_entries.is_empty()
    } else {
        required_items.iter().all(|item| {
            current_entries
                .iter()
                .find(|e| e.catalog_id == item.id)
                .map(|e| match item.data_type {
                    IndicatorDataType::Number => e.value_numeric.is_some(),
                    IndicatorDataType::Text => e
                        .value_text
                        .as_ref()
                        .map(|t| !t.trim().is_empty())
                        .unwrap_or(false),
                    IndicatorDataType::Boolean => e.value_boolean.is_some(),
                })
                .unwrap_or(false)
        })
    };

    let indicators_status = if all_required_filled { "ready" } else { "in_progress" };
    if let Some(sec) = state
        .section_repo
        .find_by_submission_and_section(id, "indicators")
        .await?
    {
        state.section_repo.update_status(sec.id, indicators_status).await?;
    }
    tracing::info!(
        submission_id = %id,
        indicators_status,
        "Indicators section status updated"
    );

    let _ = state
        .audit
        .log(
            &claims,
            "SAVE_INDICATOR_ENTRIES",
            "submission",
            Some(&id.to_string()),
            Some(serde_json::json!({ "entry_count": saved.len(), "indicators_status": indicators_status })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await;

    tracing::info!(submission_id = %id, entry_count = saved.len(), "Indicator entries saved");
    let res: Vec<IndicatorEntryResponse> = saved.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(res)))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/non-financial-indicators/consolidate",
    params(
        ("indicator_name" = String, Query, description = "Indicator to aggregate across all cooperatives")
    ),
    responses(
        (status = 200, description = "Consolidation metrics", body = ConsolidationResponse),
        (status = 400, description = "Missing indicator_name"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Non-Financial Indicators"
)]
pub async fn consolidate_indicator(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let indicator_name = params
        .get("indicator_name")
        .ok_or_else(|| AppError::BadRequest("Query parameter 'indicator_name' is required".into()))?;

    let metrics = state
        .non_financial_indicator_entry_repo
        .consolidate_metrics(indicator_name)
        .await?;
    Ok((StatusCode::OK, Json(ConsolidationResponse::from(metrics))))
}
