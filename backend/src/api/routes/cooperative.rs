//! Cooperative-level routes (Level 4 in the 4-level IAM hierarchy).
//!
//! Cooperative users are end users who can:
//! - View their cooperative dashboard (read-only)
//! - View their cooperative profile (read-only)
//! - View members of their cooperative (read-only)
//! - View their assigned dimensions
//!
//! All routes require either `cooperative` or `apex` role.
//! Cooperative users have read-only access; Apex users can manage cooperatives.

use axum::{
    extract::{Extension, State},
    routing::get,
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::auth::middleware::require_cooperative_or_apex;
use crate::auth::rbac::ScopeEnforcement;
use crate::error::AppResult;
use crate::AppState;

/// Creates the Cooperative routes router.
/// All routes are prefixed with `/api/v1/cooperative`.
///
/// # Required Role
/// `cooperative` OR `apex`
///
/// # Scope Enforcement
/// cooperative users can only view their own cooperative data.
/// The `cooperation` claim from JWT determines which cooperative they belong to.
///
/// # Routes (Read-Only for cooperative)
/// - `GET /dashboard` - Get cooperative dashboard
/// - `GET /profile` - Get cooperative profile
/// - `GET /members` - List cooperative members
/// - `GET /dimensions` - Get assigned dimensions
pub fn cooperative_routes() -> Router<AppState> {
    Router::new()
        // Dashboard
        .route("/dashboard", get(get_cooperative_dashboard))
        // Profile
        .route("/profile", get(get_cooperative_profile))
        // Members
        .route("/members", get(list_cooperative_members_view))
        // Dimensions
        .route("/dimensions", get(get_assigned_dimensions))
}

// ============================================================================
// Cooperative Handlers (Skeleton) - Read-Only View
// ============================================================================

/// Get cooperative dashboard.
/// This is the main landing page for cooperative users.
/// Shows cooperative overview, member count, assigned dimensions, assessment status.
///
/// # Access
/// - `cooperative` role: Can view their own cooperative
/// - `apex` role: Can view cooperatives they manage
async fn get_cooperative_dashboard(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_cooperative_or_apex(&claims)?;

    let coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;

    // TODO: Implement
    // - Fetch cooperative data
    // - Calculate stats (member count, assessment status, etc.)
    Ok(Json(serde_json::json!({
        "message": "get_cooperative_dashboard - TODO",
        "cooperative_id": coop_id,
        "user_roles": claims.all_roles(),
        "dashboard": {
            "name": "TBD",
            "member_count": 0,
            "assigned_dimensions": [],
            "assessment_status": "pending"
        }
    })))
}

/// Get cooperative profile.
/// Returns cooperative details (name, description, members list).
///
/// # Access
/// - `cooperative` role: Read-only view
/// - `apex` role: Can edit (use apex routes for editing)
async fn get_cooperative_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_cooperative_or_apex(&claims)?;

    let coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;

    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "get_cooperative_profile - TODO",
        "cooperative_id": coop_id,
        "profile": {
            "name": "TBD",
            "description": "TBD",
            "apex_id": claims.get_apex_group_id()
        }
    })))
}

/// List cooperative members.
/// Returns all members with their roles and assigned dimensions.
///
/// # Access
/// - `cooperative` role: Read-only view
/// - `apex` role: Can edit (use apex routes for editing)
async fn list_cooperative_members_view(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_cooperative_or_apex(&claims)?;

    let coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;

    // TODO: Implement
    Ok(Json(serde_json::json!({
        "message": "list_cooperative_members_view - TODO",
        "cooperative_id": coop_id,
        "members": []
    })))
}

/// Get assigned dimensions for the current user.
/// Returns which dimensions the user can access and assess.
///
/// # Access
/// - `cooperative` role: Can view their assigned dimensions
/// - `apex` role: Can view all dimensions
///
/// # Data Source
/// Dimensions come from the `assigned_dimensions` claim in the JWT token.
async fn get_assigned_dimensions(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    require_cooperative_or_apex(&claims)?;

    let dimensions = claims.get_assigned_dimensions();

    // TODO: Implement
    // - Optionally enrich dimension IDs with names from database
    Ok(Json(serde_json::json!({
        "message": "get_assigned_dimensions - TODO",
        "dimensions": dimensions,
        "user_id": claims.sub
    })))
}
