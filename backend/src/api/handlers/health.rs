use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

use crate::{AppResult, AppState};

#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = serde_json::Value)
    ),
    tag = "Health"
)]
pub async fn health_check(State(_state): State<AppState>) -> AppResult<impl IntoResponse> {
    Ok((StatusCode::OK, Json(json!({ "status": "healthy" }))))
}