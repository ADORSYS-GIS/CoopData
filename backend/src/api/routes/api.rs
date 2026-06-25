use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use crate::api::handlers;
use crate::auth::middleware::auth_layer;
use crate::AppState;

fn public_routes() -> Router<AppState> {
    Router::new().route("/health", axum::routing::get(handlers::health_check))
}

fn protected_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/organizations",
            axum::routing::get(handlers::list_organizations).post(handlers::create_organization),
        )
        .route(
            "/organizations/{id}",
            axum::routing::get(handlers::get_organization)
                .patch(handlers::update_organization)
                .delete(handlers::delete_organization),
        )
        .route(
            "/users",
            axum::routing::get(handlers::list_users).post(handlers::create_user),
        )
        .route(
            "/users/{id}",
            axum::routing::get(handlers::get_user)
                .patch(handlers::update_user)
                .delete(handlers::delete_user),
        )
        .route(
            "/users/{id}/assign-role",
            axum::routing::post(handlers::assign_role),
        )
}

pub fn create_app(state: AppState) -> Router {
    let protected = protected_routes().layer(axum::middleware::from_fn_with_state(
        state.clone(),
        auth_layer,
    ));

    Router::new()
        .nest("/api/v1", public_routes().merge(protected))
        .merge(crate::api::openapi::serve_openapi())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::request_id::SetRequestIdLayer::new(
            axum::http::header::HeaderName::from_static("x-request-id"),
            tower_http::request_id::MakeRequestUuid,
        ))
        .with_state(state)
}
