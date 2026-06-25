use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

use crate::AppResult;

#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses(
        (status = 200, description = "Service is healthy", body = serde_json::Value)
    ),
    tag = "Health"
)]
pub async fn health_check(State(_state): State<crate::AppState>) -> AppResult<impl IntoResponse> {
    Ok((StatusCode::OK, Json(json!({ "status": "healthy" }))))
}