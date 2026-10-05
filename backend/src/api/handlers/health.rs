use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

use crate::AppResult;

#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses(
        (status = 200, description = "Service and all dependencies are healthy", body = serde_json::Value),
        (status = 503, description = "Service is up but one or more dependencies are unavailable", body = serde_json::Value)
    ),
    tag = "Health"
)]
pub async fn health_check(State(state): State<crate::AppState>) -> AppResult<impl IntoResponse> {
    let db_ok = state.db.ping().await.is_ok();
    let cache_ok = state.cache.ping().await;
    let keycloak_ok = state.keycloak.is_healthy().await;

    let status = if db_ok && cache_ok && keycloak_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    Ok((
        status,
        Json(json!({
            "status": if status == StatusCode::OK { "healthy" } else { "degraded" },
            "checks": {
                "database": if db_ok { "ok" } else { "down" },
                "redis": if cache_ok { "ok" } else { "down" },
                "keycloak": if keycloak_ok { "ok" } else { "down" },
            }
        })),
    ))
}
