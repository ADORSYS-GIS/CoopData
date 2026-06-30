//! Shared routes accessible by all authenticated users.
//!
//! These routes don't require a specific role — any authenticated user can access them.

use axum::{
    extract::{Extension, State},
    routing::get,
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

/// Creates the shared routes router.
/// All routes are prefixed with `/api/v1`.
///
/// # Routes
/// - `GET /me` - Get current user profile (all authenticated users)
pub fn shared_routes() -> Router<AppState> {
    Router::new().route("/me", get(get_current_user_profile))
}

/// Get current user profile.
/// Returns the authenticated user's profile from JWT claims.
///
/// # Access
/// All authenticated users.
async fn get_current_user_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "id": claims.sub,
        "username": claims.preferred_username,
        "email": claims.email,
        "roles": claims.all_roles(),
        "organization": claims.get_organization_name(),
        "organization_id": claims.get_organization_id(),
        "cooperation": claims.get_cooperation_paths(),
        "assigned_dimensions": claims.get_assigned_dimensions()
    })))
}