use axum::{
    extract::{DefaultBodyLimit, Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::api::dto::cooperative::CooperativeResponse;
use crate::api::dto::member::MemberResponse;
use crate::api::handlers::extraction::get_extraction_job;
use crate::api::handlers::financial_statement::{
    get_financial_statement, get_submission_kpis, list_chart_of_accounts, list_line_items,
    update_line_items,
};
use crate::api::handlers::nf_indicator_stats::get_nf_statistics;
use crate::api::handlers::non_financial;
use crate::api::handlers::questionnaire;
use crate::api::handlers::submission::{
    create_submission, delete_submission, get_submission, list_cooperative_submissions,
    list_submission_reviews, list_submission_sections, submit_submission,
    update_submission_section, validate_extraction,
};
use crate::api::handlers::upload::{
    delete_financial_statement, serve_uploaded_file, upload_financial_statement,
};
use crate::auth::claims::Claims;

use crate::error::AppResult;
use crate::AppState;

pub fn cooperative_routes() -> Router<AppState> {
    Router::new()
        .route("/profile", get(get_cooperative_profile))
        .route(
            "/stats",
            get(crate::api::handlers::submission::get_cooperative_stats),
        )
        .route("/members", get(list_cooperative_members))
        .route("/dimensions", get(get_assigned_dimensions))
        .route(
            "/non-financial/upload",
            post(non_financial::upload_non_financial),
        )
        .route(
            "/non-financial/members",
            get(non_financial::list_members).post(non_financial::create_member),
        )
        .route(
            "/non-financial/members/{id}",
            get(non_financial::get_member)
                .put(non_financial::update_member)
                .delete(non_financial::delete_member),
        )
        .route(
            "/non-financial/savings",
            get(non_financial::list_savings_accounts).post(non_financial::create_savings_account),
        )
        .route(
            "/non-financial/savings/{id}",
            get(non_financial::get_savings_account)
                .put(non_financial::update_savings_account)
                .delete(non_financial::delete_savings_account),
        )
        .route(
            "/non-financial/loans",
            get(non_financial::list_loans).post(non_financial::create_loan),
        )
        .route(
            "/non-financial/loans/{id}",
            get(non_financial::get_loan)
                .put(non_financial::update_loan)
                .delete(non_financial::delete_loan),
        )
        .route(
            "/non-financial/fixed-deposits",
            get(non_financial::list_fixed_deposits).post(non_financial::create_fixed_deposit),
        )
        .route(
            "/non-financial/fixed-deposits/{id}",
            get(non_financial::get_fixed_deposit)
                .put(non_financial::update_fixed_deposit)
                .delete(non_financial::delete_fixed_deposit),
        )
        .route(
            "/non-financial/farm-coop",
            get(non_financial::list_farm_coop).post(non_financial::create_farm_coop),
        )
        .route(
            "/non-financial/farm-coop/{id}",
            get(non_financial::get_farm_coop)
                .put(non_financial::update_farm_coop)
                .delete(non_financial::delete_farm_coop),
        )
        // Manual Questionnaire Entry
        .route(
            "/questionnaire/financial",
            post(questionnaire::submit_financial_questionnaire),
        )
        .route(
            "/questionnaire/non-financial",
            post(questionnaire::submit_non_financial_questionnaire),
        )
        // Submissions
        .route(
            "/submissions",
            get(list_cooperative_submissions).post(create_submission),
        )
        .route(
            "/submissions/{id}",
            get(get_submission).delete(delete_submission),
        )
        .route("/submissions/{id}/submit", post(submit_submission))
        .route(
            "/submissions/{id}/export",
            get(crate::api::handlers::export::export_single_submission),
        )
        .route("/submissions/{id}/kpis", get(get_submission_kpis))
        .route("/submissions/{id}/sections", get(list_submission_sections))
        .route("/submissions/{id}/reviews", get(list_submission_reviews))
        .route(
            "/submissions/{submission_id}/files/{file_id}",
            get(serve_uploaded_file),
        )
        .route(
            "/submissions/{id}/sections/{section}",
            axum::routing::patch(update_submission_section),
        )
        .route(
            "/submissions/{id}/validate-extraction",
            post(validate_extraction),
        )
        // Non-Financial Indicator entries (per submission)
        .route(
            "/submissions/{id}/non-financial-indicators",
            get(crate::api::handlers::non_financial_indicator::get_submission_entries)
                .post(crate::api::handlers::non_financial_indicator::save_submission_entries),
        )
        // Catalog read-only for cooperatives
        .route(
            "/non-financial-indicators/catalog",
            get(crate::api::handlers::non_financial_indicator::list_catalog),
        )
        // Upload + extraction (20 MB body limit for multipart file uploads)
        .route(
            "/financial-statement/upload",
            post(upload_financial_statement).layer(DefaultBodyLimit::max(20 * 1024 * 1024)),
        )
        .route(
            "/submissions/{id}/financial-statement",
            axum::routing::delete(delete_financial_statement),
        )
        .route("/financial-statements/{id}", get(get_financial_statement))
        .route(
            "/financial-statements/{id}/line-items",
            get(list_line_items).patch(update_line_items),
        )
        .route("/chart-of-accounts", get(list_chart_of_accounts))
        .route("/extraction-jobs/{id}", get(get_extraction_job))
        // NF indicator statistics for the caller's cooperative
        .route("/nf-statistics", get(get_nf_statistics))
}

async fn get_cooperative_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<Json<CooperativeResponse>> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let group = state
        .keycloak
        .get_group_by_id(&coop.keycloak_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;
    tracing::info!(cooperative_id = %coop.keycloak_id, user_id = %claims.sub, "Cooperative profile viewed");

    let mut resp = CooperativeResponse::from(group);
    resp.institution_type = coop.institution_type.map(|t| t.as_str().to_string());
    resp.region = coop.region.map(|r| r.as_str().to_string());

    Ok(Json(resp))
}

async fn list_cooperative_members(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<(StatusCode, Json<Vec<MemberResponse>>)> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let members = state
        .keycloak
        .get_group_members(&coop.keycloak_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;
    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

async fn get_assigned_dimensions(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let dimensions = claims.get_assigned_dimensions();
    let coop_id = crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims)
        .await
        .ok()
        .map(|c| c.keycloak_id);
    Ok(Json(serde_json::json!({
        "cooperative_id": coop_id,
        "assigned_dimensions": dimensions,
        "user_id": claims.sub
    })))
}
