use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

use crate::api::dto::{AuditLogFilterParams, AuditLogResponse, PaginatedAuditLogResponse};
use crate::error::AppResult;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/ministry/audit-logs",
    params(
        ("action" = Option<String>, Query, description = "Filter by action"),
        ("resource_type" = Option<String>, Query, description = "Filter by resource type"),
        ("actor_keycloak_id" = Option<String>, Query, description = "Filter by actor"),
        ("resource_keycloak_id" = Option<String>, Query, description = "Filter by resource"),
        ("date_from" = Option<String>, Query, description = "Filter from date (ISO 8601)"),
        ("date_to" = Option<String>, Query, description = "Filter to date (ISO 8601)"),
        ("page" = Option<u64>, Query, description = "Page number"),
        ("per_page" = Option<u64>, Query, description = "Items per page"),
    ),
    responses(
        (status = 200, description = "Audit logs retrieved", body = PaginatedAuditLogResponse),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse),
    ),
    tag = "Ministry"
)]
pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(mut params): Query<AuditLogFilterParams>,
) -> AppResult<impl IntoResponse> {
    // Clamp per_page to prevent excessive queries
    const MAX_PER_PAGE: u64 = 100;
    if params.per_page > MAX_PER_PAGE {
        params.per_page = MAX_PER_PAGE;
    }
    if params.page == 0 {
        params.page = 1;
    }

    let (items, total) = state
        .audit
        .repo()
        .find_by_filters(
            params.action.as_deref(),
            params.resource_type.as_deref(),
            params.actor_keycloak_id.as_deref(),
            params.resource_keycloak_id.as_deref(),
            params.date_from.as_deref(),
            params.date_to.as_deref(),
            params.page,
            params.per_page,
        )
        .await?;

    let total_pages = total.div_ceil(params.per_page.max(1));

    Ok((
        StatusCode::OK,
        Json(PaginatedAuditLogResponse {
            data: items.into_iter().map(AuditLogResponse::from).collect(),
            total,
            page: params.page,
            per_page: params.per_page,
            total_pages,
        }),
    ))
}
