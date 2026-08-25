use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use std::time::Duration;

use crate::api::dto::{OrganizationLabelResponse, UpdateOrganizationLabelRequest};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::repositories::OrganizationLabelRepository;
use crate::AppState;

const CACHE_KEY: &str = "organization_labels:all";
const ALLOWED_KEYS: &[&str] = &["ministry", "federation", "apex", "cooperative"];

#[utoipa::path(
    get,
    path = "/api/v1/settings/organization-labels",
    responses(
        (status = 200, description = "List of organization level labels", body = Vec<OrganizationLabelResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "OrganizationLabels"
)]
pub async fn list_organization_labels(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    // 1. Try reading from Redis cache first
    if let Ok(Some(cached)) = state
        .cache
        .get::<Vec<OrganizationLabelResponse>>(CACHE_KEY)
        .await
    {
        return Ok((StatusCode::OK, Json(cached)));
    }

    // 2. Cache miss — query database repository
    let repo = OrganizationLabelRepository::new(state.db.clone());
    let labels = repo.find_all().await?;
    let response: Vec<OrganizationLabelResponse> = labels.into_iter().map(Into::into).collect();

    // 3. Write-through to Redis cache (TTL: 5 min)
    if let Err(e) = state
        .cache
        .set(CACHE_KEY, &response, Duration::from_secs(300))
        .await
    {
        tracing::warn!("Failed to cache organization labels: {}", e);
    }

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
        (status = 400, description = "Bad request / validation error"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Organization label not found"),
        (status = 500, description = "Internal server error")
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
        return Err(AppError::Forbidden(
            "Only ministry official can update organization labels".into(),
        ));
    }

    // Key path parameter validation
    let key_lower = key.to_lowercase();
    if !ALLOWED_KEYS.contains(&key_lower.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid organization label key '{}'. Must be one of: ministry, federation, apex, cooperative",
            key
        )));
    }

    // DTO input validation
    body.validate()?;

    let repo = OrganizationLabelRepository::new(state.db.clone());
    let updated = repo.update(&key_lower, body).await?;

    tracing::info!(label_key = %key_lower, "Organization label updated");

    // Invalidate Redis cache
    if let Err(e) = state.cache.delete(CACHE_KEY).await {
        tracing::warn!("Failed to invalidate organization labels cache: {}", e);
    }

    // Log to Audit Trail
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "organization_label",
            Some(&key_lower),
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

    Ok((
        StatusCode::OK,
        Json(OrganizationLabelResponse::from(updated)),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_keys_validation() {
        assert!(ALLOWED_KEYS.contains(&"ministry"));
        assert!(ALLOWED_KEYS.contains(&"federation"));
        assert!(ALLOWED_KEYS.contains(&"apex"));
        assert!(ALLOWED_KEYS.contains(&"cooperative"));
        assert!(!ALLOWED_KEYS.contains(&"unknown"));
        assert!(!ALLOWED_KEYS.contains(&"admin"));
    }
}
