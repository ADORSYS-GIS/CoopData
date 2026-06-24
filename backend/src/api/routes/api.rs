use axum::{routing::get, Router};
use tower_http::request_id::MakeRequestUuid;

use crate::{api::handlers, AppState};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health_check))
        .nest("/api/v1", api_v1_routes())
        .with_state(state)
        .layer(tower_http::request_id::SetRequestIdLayer::new(
            axum::http::header::HeaderName::from_static("x-request-id"),
            MakeRequestUuid,
        ))
}

fn api_v1_routes() -> Router<AppState> {
    Router::new()
}