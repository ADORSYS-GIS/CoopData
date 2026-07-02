//! Apex-level routes (Level 3 in the 4-level IAM hierarchy).
//!
//! Apex users are group administrators who can:
//! - View their apex dashboard and profile
//! - Create, read, update, delete cooperatives within their apex
//! - Manage members in their cooperatives
//!
//! All routes require the `apex` role.
//! Scope enforcement ensures users can only access cooperatives within their own group.

use axum::routing::{delete, get, post};
use axum::Router;

use crate::api::handlers;
use crate::AppState;

/// Creates the Apex routes router.
/// All routes are prefixed with `/api/v1/apex`.
///
/// # Required Role
/// `apex` (enforced by `role_guard_layer` in `api.rs`)
pub fn apex_routes() -> Router<AppState> {
    Router::new()
        // Apex profile & dashboard
        .route("/profile", get(handlers::cooperative::get_apex_profile))
        // Cooperative CRUD
        .route(
            "/cooperatives",
            post(handlers::cooperative::create_cooperative)
                .get(handlers::cooperative::list_cooperatives),
        )
        .route(
            "/cooperatives/:id",
            get(handlers::cooperative::get_cooperative)
                .patch(handlers::cooperative::update_cooperative)
                .delete(handlers::cooperative::delete_cooperative),
        )
        // Cooperative Members
        .route(
            "/cooperatives/:id/members",
            post(handlers::cooperative::add_cooperative_member)
                .get(handlers::cooperative::list_cooperative_members),
        )
        .route(
            "/cooperatives/:group_id/members/:user_id",
            delete(handlers::cooperative::remove_cooperative_member)
                .patch(handlers::cooperative::update_cooperative_member),
        )
        .route(
            "/cooperatives/:group_id/members/:user_id/resend-verification",
            post(handlers::cooperative::resend_cooperative_member_verification),
        )
}
