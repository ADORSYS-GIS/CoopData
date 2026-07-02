//! Cooperative-level routes (Level 4 in the 4-level IAM hierarchy).
//!
//! Cooperative users can view their own cooperative data (read-only).
//! Apex users accessing these routes also see their cooperative context.
//!
//! All routes require either `cooperative` or `apex` role.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use std::sync::Arc;

use crate::api::dto::cooperative::CooperativeResponse;
use crate::api::dto::member::MemberResponse;
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::error::AppResult;
use crate::AppState;

/// Creates the Cooperative routes router.
/// All routes are prefixed with `/api/v1/cooperative`.
///
/// # Required Role
/// `cooperative` OR `apex` (enforced by `role_guard_layer` in `api.rs`)
pub fn cooperative_routes() -> Router<AppState> {
    Router::new()
        .route("/profile", get(get_cooperative_profile))
        .route("/members", get(list_cooperative_members))
        .route("/dimensions", get(get_assigned_dimensions))
}

/// Get the cooperative's own profile (read-only).
/// Cooperative ID is derived from the `cooperation` JWT claim path.
async fn get_cooperative_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<Json<CooperativeResponse>> {
    let coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;

    let group = state
        .keycloak
        .get_group_by_id(&coop_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(cooperative_id = %coop_id, user_id = %claims.sub, "Cooperative profile viewed");
    Ok(Json(CooperativeResponse::from(group)))
}

/// List members in the cooperative (read-only for cooperative role).
async fn list_cooperative_members(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<(StatusCode, Json<Vec<MemberResponse>>)> {
    let coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;

    let members = state
        .keycloak
        .get_group_members(&coop_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

/// Get assigned dimensions for the current user.
/// Values come directly from the JWT `assigned_dimensions` claim.
async fn get_assigned_dimensions(
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<Json<serde_json::Value>> {
    let dimensions = claims.get_assigned_dimensions();
    let coop_id = ScopeEnforcement::get_cooperative_id(&claims).ok();

    Ok(Json(serde_json::json!({
        "cooperative_id": coop_id,
        "assigned_dimensions": dimensions,
        "user_id": claims.sub
    })))
}
