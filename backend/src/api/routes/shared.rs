//! Shared routes accessible by all authenticated users.
//!
//! These routes don't require a specific role — any authenticated user can access them.

use axum::{
    extract::{Extension, State},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

pub fn shared_routes() -> Router<AppState> {
    Router::new()
        .route("/me", get(get_current_user_profile))
        .route(
            "/me/password",
            post(crate::api::handlers::me::change_password),
        )
        .route(
            "/me/verify-identity",
            post(crate::api::handlers::me::verify_identity),
        )
        // Non-financial indicator catalog — readable by all authenticated roles
        .route(
            "/non-financial-indicators/catalog",
            get(crate::api::handlers::non_financial_indicator::list_catalog),
        )
        // Benchmark analytics — accessible to all authenticated roles
        .route(
            "/benchmarks",
            get(crate::api::handlers::financial_statement::get_benchmarks),
        )
        // Monthly trend analytics — accessible to all authenticated roles
        .route(
            "/analytics/monthly-trend",
            get(crate::api::handlers::financial_statement::get_monthly_trend),
        )
        .route(
            "/analytics/submission-activity",
            get(crate::api::handlers::financial_statement::get_submission_activity),
        )
        // Region compliance analytics — accessible to all authenticated roles
        .route(
            "/analytics/region-compliance",
            get(crate::api::handlers::financial_statement::get_region_compliance),
        )
        // Sector breakdown analytics — accessible to all authenticated roles
        .route(
            "/analytics/sector-breakdown",
            get(crate::api::handlers::financial_statement::get_sector_breakdown),
        )
        // National overview — aggregated KPI traffic-light distribution
        .route(
            "/analytics/national-overview",
            get(crate::api::handlers::national_overview::get_national_overview),
        )
        // Benchmark — privacy-safe cooperative comparison (own row + server averages)
        .route(
            "/analytics/benchmark",
            get(crate::api::handlers::national_overview::get_benchmark),
        )
        // Dynamic questionnaire analytics - accessible to all authenticated roles
        .route(
            "/analytics/questionnaire",
            get(crate::api::handlers::questionnaire::get_questionnaire_analytics),
        )
        .route(
            "/analytics/comparative-statements",
            get(crate::api::handlers::national_overview::get_comparative_statements),
        )
        .route(
            "/analytics/nf-trend",
            get(crate::api::handlers::nf_indicator_stats::get_nf_trend),
        )
        .route(
            "/analytics/consolidated-nf-statistics",
            get(crate::api::handlers::nf_indicator_stats::get_consolidated_nf_statistics),
        )
}

async fn get_current_user_profile(
    Extension(claims): Extension<Arc<Claims>>,
    State(_state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
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
