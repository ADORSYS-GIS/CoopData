use std::sync::Arc;

use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

use crate::api::dto::basic_dashboard::BasicDashboardParams;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::basic_dashboard::{build, DashboardRequest};
use crate::AppState;

/// GET /api/v1/analytics/basic-dashboard
///
/// Regulator-style KPIs, trends and market share computed from questionnaire
/// answers. Cooperatives see their own data; apex, federation and ministry
/// users see the consolidated view of the cooperatives in their scope.
#[utoipa::path(
    get,
    path = "/api/v1/analytics/basic-dashboard",
    params(BasicDashboardParams),
    responses(
        (status = 200, description = "Basic analytics dashboard", body = BasicDashboardResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Cooperative outside the caller's scope")
    ),
    tag = "Analytics"
)]
pub async fn get_basic_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<BasicDashboardParams>,
) -> AppResult<impl IntoResponse> {
    let mut cooperative_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    if let Some(id) = params.cooperative_id {
        if !cooperative_ids.contains(&id) {
            return Err(AppError::Forbidden(
                "This cooperative is outside your scope".into(),
            ));
        }
        cooperative_ids = vec![id];
    }

    if params.federation_id.is_some() || params.apex_id.is_some() {
        cooperative_ids = crate::api::handlers::financial_statement::filter_cooperatives(
            &state,
            cooperative_ids,
            None,
            None,
            None,
            params.federation_id,
            params.apex_id,
        )
        .await?;
    }

    let admin_view = !claims.has_role("cooperative");
    let response = build(
        &state,
        DashboardRequest {
            params,
            cooperative_ids,
            admin_view,
            focus_submission: None,
        },
    )
    .await?;
    Ok((StatusCode::OK, Json(response)))
}
