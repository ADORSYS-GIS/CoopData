use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::api::dto::{OrganizationLabelResponse, UpdateOrganizationLabelRequest};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::repositories::OrganizationLabelRepository;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/settings/organization-labels",
    responses(
        (status = 200, description = "List of organization level labels", body = Vec<OrganizationLabelResponse>),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    ),
    tag = "OrganizationLabels"
)]
pub async fn list_organization_labels(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationLabelRepository::new(state.db.clone());
    let labels = repo.find_all().await?;
    let response: Vec<OrganizationLabelResponse> = labels.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    put,
    path = "/api/v1/settings/organization-labels/{key}",
    params(
        ("key" = String, Path, description = "Role level key (ministry, federation, apex, cooperative)")
    ),
    request_body = UpdateOrganizationLabelRequest,
    responses(
        (status = 200, description = "Organization label updated successfully", body = OrganizationLabelResponse),
        (status = 404, description = "Organization label not found", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    ),
    tag = "OrganizationLabels"
)]
pub async fn update_organization_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(key): Path<String>,
    Json(body): Json<UpdateOrganizationLabelRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.has_role("ministry") {
        return Err(AppError::Forbidden("Only ministry official can update organization labels".into()));
    }

    if body.label.trim().is_empty() {
        return Err(AppError::BadRequest("Label cannot be empty".into()));
    }
    if body.short_label.trim().is_empty() {
        return Err(AppError::BadRequest("Short label cannot be empty".into()));
    }
    if body.plural_label.trim().is_empty() {
        return Err(AppError::BadRequest("Plural label cannot be empty".into()));
    }

    let repo = OrganizationLabelRepository::new(state.db.clone());
    let updated = repo.update(&key, body).await?;

    tracing::info!(label_key = %key, "Organization label updated");

    // Invalidate Redis cache
    if let Err(e) = state.cache.delete("organization_labels:all").await {
        tracing::warn!("Failed to invalidate organization labels cache: {}", e);
    }

    // Log to Audit Trail
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "organization_label",
            Some(&key),
            Some(serde_json::json!({
                "label": &updated.label,
                "short_label": &updated.short_label,
                "plural_label": &updated.plural_label,
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((StatusCode::OK, Json(OrganizationLabelResponse::from(updated))))
}
