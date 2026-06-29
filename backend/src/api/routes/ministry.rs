//! Ministry-level routes (Level 1 in the 4-level IAM hierarchy).
//!
//! Ministry users are platform super-admins who can:
//! - Create, read, update, delete federations
//! - Invite users to federations
//! - View all organizations and users
//!
//! All routes require the `ministry` role.

use axum::{
    extract::{Extension, Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::auth::middleware::require_ministry;
use crate::error::AppResult;
use crate::AppState;

/// Creates the Ministry routes router.
/// All routes are prefixed with `/api/v1/ministry`.
///
/// # Required Role
/// `ministry`
///
/// # Routes
/// - `POST /federations` - Create a new federation
/// - `GET /federations` - List all federations
/// - `GET /federations/:id` - Get a federation by ID
/// - `PATCH /federations/:id` - Update a federation
/// - `DELETE /federations/:id` - Delete a federation
/// - `POST /federations/:id/invitations` - Invite user to federation
/// - `GET /federations/:id/invitations` - List federation invitations
/// - `DELETE /federations/:id/invitations/:invitation_id` - Cancel invitation
/// - `POST /federations/:id/invitations/:invitation_id/resend` - Resend invitation
/// - `GET /federations/:id/members` - List federation members
pub fn ministry_routes() -> Router<AppState> {
    Router::new()
        // Federation CRUD
        .route("/federations", post(create_federation).get(list_federations))
        .route(
            "/federations/{id}",
            get(get_federation)
                .patch(update_federation)
                .delete(delete_federation),
        )
        // Federation Invitations
        .route(
            "/federations/{id}/invitations",
            post(invite_user_to_federation).get(list_federation_invitations),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}",
            delete(cancel_federation_invitation),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}/resend",
            post(resend_federation_invitation),
        )
        // Federation Members
        .route("/federations/{id}/members", get(list_federation_members))
}

// ============================================================================
// Federation Handlers (Skeleton)
// ============================================================================

/// Create a new federation.
/// Ministry-only endpoint.
///
/// # Implementation
/// TODO: Implement federation creation:
/// 1. Validate JWT claims (ministry role) - done via middleware
/// 2. Create Keycloak Organization
/// 3. Create PostgreSQL federation record
/// 4. Return created federation
async fn create_federation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "create_federation - TODO",
        "user_id": claims.sub
    })))
}

/// List all federations.
/// Ministry-only endpoint.
async fn list_federations(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "list_federations - TODO",
        "federations": []
    })))
}

/// Get a federation by ID.
/// Ministry-only endpoint.
async fn get_federation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "get_federation - TODO",
        "id": id
    })))
}

/// Update a federation.
/// Ministry-only endpoint.
async fn update_federation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "update_federation - TODO",
        "id": id
    })))
}

/// Delete a federation.
/// Ministry-only endpoint.
async fn delete_federation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "delete_federation - TODO",
        "id": id
    })))
}

/// Invite a user to a federation.
/// Ministry-only endpoint.
async fn invite_user_to_federation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "invite_user_to_federation - TODO",
        "federation_id": id
    })))
}

/// List federation invitations.
/// Ministry-only endpoint.
async fn list_federation_invitations(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "list_federation_invitations - TODO",
        "federation_id": id
    })))
}

/// Cancel a federation invitation.
/// Ministry-only endpoint.
async fn cancel_federation_invitation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path((federation_id, invitation_id)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "cancel_federation_invitation - TODO",
        "federation_id": federation_id,
        "invitation_id": invitation_id
    })))
}

/// Resend a federation invitation.
/// Ministry-only endpoint.
async fn resend_federation_invitation(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path((federation_id, invitation_id)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "resend_federation_invitation - TODO",
        "federation_id": federation_id,
        "invitation_id": invitation_id
    })))
}

/// List federation members.
/// Ministry-only endpoint.
async fn list_federation_members(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    require_ministry(&claims)?;
    
    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "list_federation_members - TODO",
        "federation_id": id
    })))
}