//! Federation-level routes (Level 2 in the 4-level IAM hierarchy).
//!
//! Federation users are organization administrators who can:
//! - Create, read, update, delete apexes within their federation
//! - Manage members in their apexes
//! - View and update their federation's profile
//!
//! All routes require the `federation` role.
//! Scope enforcement ensures users can only access their own federation's data.

use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::api::handlers;
use crate::api::handlers::upload::serve_uploaded_file;
use crate::AppState;

/// Creates the Federation routes router.
/// All routes are prefixed with `/api/v1/federation`.
///
/// # Required Role
/// `federation`
///
/// # Scope Enforcement
/// Federation users can only access apexes within their own organization.
/// The `organization_keycloak_id` from JWT claims must match the requested data.
///
/// # Routes
/// - `POST /apexes` - Create a new apex
/// - `GET /apexes` - List apexes (scoped to user's federation)
/// - `GET /apexes/{id}` - Get an apex by ID
/// - `PATCH /apexes/{id}` - Update an apex
/// - `DELETE /apexes/{id}` - Delete an apex
/// - `POST /apexes/{id}/members` - Add member to apex
/// - `GET /apexes/{id}/members` - List apex members
/// - `DELETE /apexes/{group_id}/members/{user_id}` - Remove member from apex
/// - `GET /profile` - Get federation profile
/// - `PATCH /profile` - Update federation profile
pub fn federation_routes() -> Router<AppState> {
    Router::new()
        // Apex CRUD
        .route(
            "/apexes",
            post(handlers::apex::create_apex).get(handlers::apex::list_apexes),
        )
        .route(
            "/apexes/{id}",
            get(handlers::apex::get_apex)
                .patch(handlers::apex::update_apex)
                .delete(handlers::apex::delete_apex),
        )
        .route(
            "/apexes/{id}/delete-preview",
            get(handlers::apex::delete_apex_preview),
        )
        // Apex Members
        .route(
            "/apexes/{id}/members",
            post(handlers::apex::add_apex_member).get(handlers::apex::list_apex_members),
        )
        .route(
            "/apexes/{group_id}/members/{user_id}",
            delete(handlers::apex::remove_apex_member).patch(handlers::apex::update_apex_member),
        )
        .route(
            "/apexes/{group_id}/members/{user_id}/resend-verification",
            post(handlers::apex::resend_apex_member_verification),
        )
        // Federation Profile
        .route(
            "/profile",
            get(handlers::federation::get_federation_profile)
                .patch(handlers::federation::update_federation_profile),
        )
        // Federation Stats
        .route("/stats", get(handlers::federation::get_federation_stats))
        // Submission review
        .route(
            "/submissions",
            get(handlers::submission::list_federation_submissions),
        )
        .route(
            "/submissions/{id}",
            get(handlers::submission::get_submission_as_federation),
        )
        .route(
            "/submissions/{id}/approve",
            post(handlers::submission::federation_approve_submission),
        )
        .route(
            "/submissions/{id}/return",
            post(handlers::submission::federation_return_submission),
        )
        .route(
            "/submissions/{submission_id}/files/{file_id}",
            get(serve_uploaded_file),
        )
}
