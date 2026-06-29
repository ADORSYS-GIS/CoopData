//! Shared routes accessible by multiple roles.
//!
//! These routes are accessible by users with any of the specified roles.
//! Some endpoints may have additional scope enforcement checks.

use axum::{
    extract::{Extension, Path, State},
    routing::{get, post},
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
/// - `GET /organizations` - List organizations (ministry only)
/// - `POST /organizations` - Create organization (ministry only)
/// - etc.
pub fn shared_routes() -> Router<AppState> {
    Router::new()
        // Current user profile
        .route("/me", get(get_current_user_profile))
        // Organization endpoints (restricted)
        .route(
            "/organizations",
            get(list_organizations).post(create_organization),
        )
        .route(
            "/organizations/{id}",
            get(get_organization)
                .patch(update_organization)
                .delete(delete_organization),
        )
        // User endpoints (restricted)
        .route("/users", get(list_users).post(create_user))
        .route(
            "/users/{id}",
            get(get_user).patch(update_user).delete(delete_user),
        )
        .route("/users/{id}/assign-role", post(assign_role_to_user))
}

// ============================================================================
// Shared Handlers (Skeleton)
// ============================================================================

/// Get current user profile.
/// Returns the authenticated user's profile from JWT claims.
///
/// # Access
/// All authenticated users.
async fn get_current_user_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    // - Optionally enrich with data from database
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

/// List all organizations.
/// Ministry-only endpoint.
async fn list_organizations(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    // - Add role check for ministry
    Ok(Json(serde_json::json!({
        "message": "list_organizations - TODO",
        "organizations": []
    })))
}

/// Create a new organization.
/// Ministry-only endpoint.
async fn create_organization(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "create_organization - TODO"
    })))
}

/// Get an organization by ID.
async fn get_organization(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "get_organization - TODO",
        "id": id
    })))
}

/// Update an organization.
async fn update_organization(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "update_organization - TODO",
        "id": id
    })))
}

/// Delete an organization.
async fn delete_organization(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "delete_organization - TODO",
        "id": id
    })))
}

/// List all users.
async fn list_users(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "list_users - TODO",
        "users": []
    })))
}

/// Create a new user.
async fn create_user(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "create_user - TODO"
    })))
}

/// Get a user by ID.
async fn get_user(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "get_user - TODO",
        "id": id
    })))
}

/// Update a user.
async fn update_user(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "update_user - TODO",
        "id": id
    })))
}

/// Delete a user.
async fn delete_user(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "delete_user - TODO",
        "id": id
    })))
}

/// Assign a role to a user.
async fn assign_role_to_user(
    Extension(_claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "assign_role_to_user - TODO",
        "user_id": id
    })))
}
