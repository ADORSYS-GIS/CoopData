use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::services::nf_indicator_engine::NfIndicatorEngine;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/nf-statistics",
    responses(
        (status = 200, description = "NF statistics for the caller's cooperative", body = crate::api::dto::non_financial::NfStatisticsResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Non-Financial Statistics"
)]
pub async fn get_nf_statistics(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let stats = NfIndicatorEngine::compute(&state.db, coop.id).await?;
    Ok((StatusCode::OK, Json(stats)))
}
