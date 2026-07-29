//! Ministry-level routes (Level 1 in the 4-level IAM hierarchy).
//!
//! Ministry users are platform super-admins who can:
//! - Create, read, update, delete federations
//! - Invite users to federations and manage federation members
//! - Manage organizations and users
//!
//! All routes require the `ministry` role.
//! Role enforcement is handled by middleware in `api.rs`.

use axum::routing::{delete, get, post};
use axum::Router;

use crate::api::handlers::audit::list_audit_logs;
use crate::api::handlers::federation::{
    create_federation, delete_federation, delete_federation_invitation, delete_federation_preview,
    get_federation, invite_user_to_federation, list_federation_invitations,
    list_federation_members, list_federations, remove_federation_member,
    resend_federation_invitation, update_federation,
};
use crate::api::handlers::upload::serve_uploaded_file;
use crate::api::handlers::{
    assign_role_to_user, create_organization, create_user, delete_organization, delete_user,
    get_organization, get_user, list_organizations, list_users, update_organization, update_user,
};
use crate::AppState;

/// Creates the Ministry routes router.
/// All routes are prefixed with `/api/v1/ministry`.
pub fn ministry_routes() -> Router<AppState> {
    Router::new()
        // Apex list for ministry
        .route(
            "/apexes",
            get(crate::api::handlers::apex::ministry_list_apexes),
        )
        // Federation CRUD
        .route(
            "/federations",
            post(create_federation).get(list_federations),
        )
        .route(
            "/federations/{id}",
            get(get_federation)
                .patch(update_federation)
                .delete(delete_federation),
        )
        .route(
            "/federations/{id}/delete-preview",
            get(delete_federation_preview),
        )
        // Federation Invitations
        .route(
            "/federations/{id}/invitations",
            post(invite_user_to_federation).get(list_federation_invitations),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}",
            delete(delete_federation_invitation),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}/resend",
            post(resend_federation_invitation),
        )
        // Federation Members
        .route("/federations/{id}/members", get(list_federation_members))
        .route(
            "/federations/{id}/members/{user_id}",
            delete(remove_federation_member),
        )
        // Organization CRUD
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
        // User management
        .route("/users", get(list_users).post(create_user))
        .route(
            "/users/{id}",
            get(get_user).patch(update_user).delete(delete_user),
        )
        .route("/users/{id}/assign-role", post(assign_role_to_user))
        // Audit logs
        .route("/audit-logs", get(list_audit_logs))
        // Submission review
        .route(
            "/submissions",
            get(crate::api::handlers::submission::list_ministry_submissions),
        )
        .route(
            "/submissions/{id}",
            get(crate::api::handlers::submission::get_submission_as_ministry),
        )
        .route(
            "/submissions/{id}/approve",
            post(crate::api::handlers::submission::ministry_approve_submission),
        )
        .route(
            "/submissions/{id}/reject",
            post(crate::api::handlers::submission::ministry_reject_submission),
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
        // Non-Financial Indicator catalog management (ministry-only)
        .route(
            "/non-financial-indicators/catalog",
            post(crate::api::handlers::non_financial_indicator::create_catalog_item)
                .get(crate::api::handlers::non_financial_indicator::list_catalog),
        )
        .route(
            "/non-financial-indicators/catalog/{id}",
            axum::routing::put(crate::api::handlers::non_financial_indicator::update_catalog_item)
                .delete(crate::api::handlers::non_financial_indicator::delete_catalog_item),
        )
        // Consolidation analytics (ministry-only)
        .route(
            "/non-financial-indicators/consolidate",
            get(crate::api::handlers::non_financial_indicator::consolidate_indicator),
        )
        // Dashboard stats
        .route(
            "/stats",
            get(crate::api::handlers::financial_statement::get_ministry_stats),
        )
        // Bulk export
        .route(
            "/submissions/export",
            get(crate::api::handlers::financial_statement::export_ministry_submissions),
        )
        // Custom KPIs
        .route(
            "/custom-kpis",
            post(crate::api::handlers::custom_kpi::create_custom_kpi)
                .get(crate::api::handlers::custom_kpi::list_custom_kpis),
        )
        .route(
            "/custom-kpis/{id}",
            delete(crate::api::handlers::custom_kpi::delete_custom_kpi),
        )
        .route(
            "/custom-kpis/evaluate",
            post(crate::api::handlers::custom_kpi::evaluate_custom_kpi),
        )
        // Questionnaire templates
        .route(
            "/questionnaire-templates",
            post(crate::api::handlers::questionnaire_template::create_template)
                .get(crate::api::handlers::questionnaire_template::list_templates),
        )
        .route(
            "/questionnaire-templates/{id}",
            get(crate::api::handlers::questionnaire_template::get_template)
                .put(crate::api::handlers::questionnaire_template::update_template)
                .delete(crate::api::handlers::questionnaire_template::delete_template),
        )
        .route(
            "/questionnaire-templates/{id}/activate",
            post(crate::api::handlers::questionnaire_template::activate_template),
        )
        .route(
            "/questionnaire-templates/active",
            get(crate::api::handlers::questionnaire_template::get_active_template_ministry),
        )
}
