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
use crate::api::handlers::upload::serve_uploaded_file;
use crate::AppState;

pub fn apex_routes() -> Router<AppState> {
    Router::new()
        .route("/profile", get(handlers::cooperative::get_apex_profile))
        .route("/stats", get(handlers::submission::get_apex_stats))
        // Bulk export
        .route(
            "/submissions/export",
            get(handlers::financial_statement::export_apex_submissions),
        )
        .route(
            "/cooperatives",
            post(handlers::cooperative::create_cooperative)
                .get(handlers::cooperative::list_cooperatives),
        )
        .route(
            "/cooperatives/{id}",
            get(handlers::cooperative::get_cooperative)
                .patch(handlers::cooperative::update_cooperative)
                .delete(handlers::cooperative::delete_cooperative),
        )
        .route(
            "/cooperatives/{id}/delete-preview",
            get(handlers::cooperative::delete_cooperative_preview),
        )
        .route(
            "/cooperatives/{id}/members",
            post(handlers::cooperative::add_cooperative_member)
                .get(handlers::cooperative::list_cooperative_members),
        )
        .route(
            "/cooperatives/{group_id}/members/{user_id}",
            delete(handlers::cooperative::remove_cooperative_member)
                .patch(handlers::cooperative::update_cooperative_member),
        )
        .route(
            "/cooperatives/{group_id}/members/{user_id}/resend-verification",
            post(handlers::cooperative::resend_cooperative_member_verification),
        )
        .route(
            "/coop-profiles",
            post(handlers::cooperative::create_cooperative_profile)
                .get(handlers::cooperative::list_cooperative_profiles),
        )
        .route(
            "/coop-profiles/{id}",
            get(handlers::cooperative::get_cooperative_profile)
                .patch(handlers::cooperative::update_cooperative_profile)
                .delete(handlers::cooperative::delete_cooperative_profile),
        )
        // Submission review
        .route(
            "/submissions",
            get(handlers::submission::list_apex_submissions),
        )
        .route(
            "/submissions/{id}",
            get(handlers::submission::get_submission_as_apex),
        )
        .route(
            "/submissions/{id}/approve",
            post(handlers::submission::apex_approve_submission),
        )
        .route(
            "/submissions/{id}/return",
            post(handlers::submission::apex_return_submission),
        )
        .route(
            "/submissions/{id}/flags",
            get(handlers::submission::get_submission_flags),
        )
        .route(
            "/submissions/{id}/export",
            get(crate::api::handlers::export::export_single_submission),
        )
        .route(
            "/export",
            get(crate::api::handlers::export::export_bulk_consolidated),
        )
        .route(
            "/submissions/{submission_id}/files/{file_id}",
            get(serve_uploaded_file),
        )
        // KPI computation for a specific submission (used in deep-dive analytics)
        .route(
            "/submissions/{id}/kpis",
            get(handlers::financial_statement::get_submission_kpis),
        )
}
