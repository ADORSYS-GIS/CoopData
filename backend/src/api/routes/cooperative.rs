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
    get_financial_statement, list_line_items, update_line_items,
};
use crate::api::handlers::submission::{
    create_submission, delete_submission, get_submission, list_cooperative_submissions,
    list_submission_sections, submit_submission, update_submission_section, validate_extraction,
};
use crate::api::handlers::upload::upload_financial_statement;
use crate::auth::claims::Claims;

use crate::error::AppResult;
use crate::AppState;

pub fn cooperative_routes() -> Router<AppState> {
    Router::new()
        .route("/profile", get(get_cooperative_profile))
        .route("/members", get(list_cooperative_members))
        .route("/dimensions", get(get_assigned_dimensions))
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
        .route("/submissions/{id}/sections", get(list_submission_sections))
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
        .route("/financial-statements/{id}", get(get_financial_statement))
        .route(
            "/financial-statements/{id}/line-items",
            get(list_line_items).patch(update_line_items),
        )
        .route("/extraction-jobs/{id}", get(get_extraction_job))
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
