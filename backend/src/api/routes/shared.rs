//! Shared routes accessible by all authenticated users.
//!
//! These routes don't require a specific role — any authenticated user can access them.

use axum::{
    extract::{Extension, State},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

pub fn shared_routes() -> Router<AppState> {
    Router::new()
        .route("/me", get(get_current_user_profile))
        .route(
            "/me/password",
            post(crate::api::handlers::me::change_password),
        )
}

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
