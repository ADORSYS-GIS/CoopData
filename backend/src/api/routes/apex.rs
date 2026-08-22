//! Apex-level routes (Level 3 in the 4-level IAM hierarchy).
//!
//! Apex users are group administrators who can:
//! - View their apex dashboard and profile
//! - Create, read, update, delete cooperatives within their apex
//! - Manage members in their cooperatives
//!
//! All routes require the `apex` role.
//! Scope enforcement ensures users can only access cooperatives within their own group.

use axum::extract::DefaultBodyLimit;
use axum::routing::{delete, get, patch, post};
use axum::Router;

use crate::api::handlers;
use crate::api::handlers::non_financial;
use crate::api::handlers::upload::{serve_uploaded_file, upload_financial_statement};
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
            get(handlers::submission::list_apex_submissions)
                .post(handlers::submission::create_apex_submission),
        )
        .route(
            "/submissions/{id}",
            get(handlers::submission::get_submission_as_apex)
                .delete(handlers::submission::delete_submission),
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
            "/submissions/{id}/submit",
            post(handlers::submission::apex_submit_submission),
        )
        .route(
            "/submissions/{id}/delegate",
            post(handlers::submission::delegate_submission),
        )
        .route(
            "/submissions/{id}/reclaim",
            post(handlers::submission::reclaim_submission),
        )
        .route(
            "/submissions/{id}/sections/{section}",
            patch(handlers::submission::update_submission_section),
        )
        .route(
            "/submissions/{id}/method",
            patch(handlers::submission::update_submission_method),
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
            "/submissions/{id}/narratives",
            get(crate::api::handlers::export::get_submission_narratives)
                .post(crate::api::handlers::export::generate_submission_narratives),
        )
        .route(
            "/{apex_id}/narratives",
            get(crate::api::handlers::export::get_apex_narratives),
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
        // File uploads (apex fills data on behalf of cooperatives)
        .route(
            "/non-financial/upload",
            post(non_financial::upload_non_financial),
        )
        .route(
            "/financial-statement/upload",
            post(upload_financial_statement).layer(DefaultBodyLimit::max(20 * 1024 * 1024)),
        )
}
