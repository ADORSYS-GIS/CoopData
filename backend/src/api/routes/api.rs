//! Route modules for the 4-level IAM hierarchy.
//!
//! # Route Structure
//! - `ministry` - Level 1: Platform super-admin routes (requires `ministry` role)
//! - `federation` - Level 2: Organization admin routes (requires `federation` role)
//! - `apex` - Level 3: Group admin routes (requires `apex` role)
//! - `cooperative` - Level 4: End user routes (requires `cooperative` or `apex` role)
//! - `shared` - Shared routes accessible by multiple roles

use axum::Router;
use axum::routing::get;
use tower_http::cors::{Any, CorsLayer};

use crate::api::handlers;
use crate::auth::middleware::auth_layer;
use crate::AppState;

/// Public routes that don't require authentication.
fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(handlers::health_check))
}

/// Ministry-level routes (Level 1).
/// Requires `ministry` role.
/// Prefix: `/api/v1/ministry`
fn ministry_routes() -> Router<AppState> {
    crate::api::routes::ministry::ministry_routes()
}

/// Federation-level routes (Level 2).
/// Requires `federation` role.
/// Prefix: `/api/v1/federation`
fn federation_routes() -> Router<AppState> {
    crate::api::routes::federation::federation_routes()
}

/// Apex-level routes (Level 3).
/// Requires `apex` role.
/// Prefix: `/api/v1/apex`
fn apex_routes() -> Router<AppState> {
    crate::api::routes::apex::apex_routes()
}

/// Cooperative-level routes (Level 4).
/// Requires `cooperative` OR `apex` role.
/// Prefix: `/api/v1/cooperative`
fn cooperative_routes() -> Router<AppState> {
    crate::api::routes::cooperative::cooperative_routes()
}

/// Shared routes accessible by multiple roles.
/// Prefix: `/api/v1`
fn shared_routes() -> Router<AppState> {
    crate::api::routes::shared::shared_routes()
}

/// Creates the main application router.
///
/// # Route Structure
/// - `/api/v1/health` - Public health check
/// - `/api/v1/me` - Current user profile (authenticated)
/// - `/api/v1/ministry/*` - Ministry routes (requires `ministry` role)
/// - `/api/v1/federation/*` - Federation routes (requires `federation` role)
/// - `/api/v1/apex/*` - Apex routes (requires `apex` role)
/// - `/api/v1/cooperative/*` - Cooperative routes (requires `cooperative` or `apex` role)
///
/// # Authentication
/// All routes except `/health` require a valid JWT token in the Authorization header.
/// The `auth_layer` middleware validates the token and extracts claims.
///
/// # Authorization
/// Each route group has its own role requirements enforced at the handler level
/// using the `require_role_layer()` or `role_guard()` functions.
pub fn create_app(state: AppState) -> Router {
    // Protected routes require authentication
    let protected = Router::new()
        .merge(shared_routes())
        .merge(ministry_routes())
        .merge(federation_routes())
        .merge(apex_routes())
        .merge(cooperative_routes())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_layer,
        ));

    Router::new()
        .nest("/api/v1", public_routes().merge(protected))
        .merge(crate::api::openapi::serve_openapi())
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::request_id::SetRequestIdLayer::new(
            axum::http::header::HeaderName::from_static("x-request-id"),
            tower_http::request_id::MakeRequestUuid,
        ))
        .with_state(state)
}