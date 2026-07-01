//! Route modules for the 4-level IAM hierarchy.
//!
//! # Route Structure
//! - `shared` - Shared routes accessible by all authenticated users (e.g., `/me`)
//! - `ministry` - Level 1: Platform super-admin routes (requires `ministry` role)
//! - `federation` - Level 2: Organization admin routes (requires `federation` role)
//! - `apex` - Level 3: Group admin routes (requires `apex` role)
//! - `cooperative` - Level 4: End user routes (requires `cooperative` or `apex` role)
//!
//! # Authorization Model
//! Role enforcement is handled exclusively by the `role_guard_layer` middleware.
//! Handler-level role checks (`require_*`) are NOT used — middleware rejects
//! unauthorized requests before they reach handlers.
//! Scope enforcement (e.g., federation can only see own org's apexes) is
//! handled in handlers via `ScopeEnforcement` methods.

use axum::routing::get;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use crate::api::handlers;
use crate::auth::middleware::auth_layer;
use crate::auth::rbac::roles;
use crate::AppState;

/// Public routes that don't require authentication.
fn public_routes() -> Router<AppState> {
    Router::new().route("/health", get(handlers::health_check))
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

/// User management routes accessible by ministry, federation, and apex.
/// Prefix: `/api/v1`
fn user_routes() -> Router<AppState> {
    crate::api::routes::users::user_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
        roles::MINISTRY,
        roles::FEDERATION,
        roles::APEX,
    ])))
}

/// Creates a role-checking middleware layer for route groups.
/// This provides early rejection before handlers are called.
pub fn role_guard_layer(
    allowed_roles: &'static [&'static str],
) -> impl Fn(
    axum::extract::Request,
    axum::middleware::Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = axum::response::Response> + Send>>
       + Clone
       + 'static {
    use axum::body::Body;
    use axum::extract::Request;
    use axum::middleware::Next;
    use axum::response::Response;
    use std::sync::Arc;

    move |request: Request, next: Next| {
        let roles = allowed_roles;
        Box::pin(async move {
            let claims = request
                .extensions()
                .get::<Arc<crate::auth::claims::Claims>>()
                .cloned();

            match claims {
                Some(claims) => {
                    if claims.has_any_role(roles) {
                        next.run(request).await
                    } else {
                        tracing::info!(
                            user_id = %claims.sub,
                            required_roles = ?roles,
                            user_roles = ?claims.all_roles(),
                            "RBAC middleware: Access denied - missing required role"
                        );
                        Response::builder()
                            .status(axum::http::StatusCode::FORBIDDEN)
                            .body(Body::from(serde_json::json!({
                                "error": "forbidden",
                                "message": format!("Access denied. Required role: {}", roles.join(" or ")),
                                "required_roles": roles
                            }).to_string()))
                            .unwrap()
                    }
                }
                None => Response::builder()
                    .status(axum::http::StatusCode::UNAUTHORIZED)
                    .body(Body::from(
                        serde_json::json!({
                            "error": "unauthorized",
                            "message": "Missing or invalid authentication"
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            }
        })
    }
}

/// Creates the main application router.
///
/// # Route Structure
/// - `/api/v1/health` - Public health check
/// - `/api/v1/me` - Current user profile (authenticated, any role)
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
/// Route-level role middleware provides early rejection before handler execution.
/// No handler-level role checks are needed — middleware enforces roles.
/// Scope enforcement (data-level access) is handled in handlers via `ScopeEnforcement`.
pub fn create_app(state: AppState) -> Router {
    let protected = Router::new()
        .merge(shared_routes())
        .merge(user_routes())
        .nest(
            "/ministry",
            ministry_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::MINISTRY,
            ]))),
        )
        .nest(
            "/federation",
            federation_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::FEDERATION,
            ]))),
        )
        .nest(
            "/apex",
            apex_routes().layer(axum::middleware::from_fn(role_guard_layer(&[roles::APEX]))),
        )
        .nest(
            "/cooperative",
            cooperative_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::COOPERATIVE,
                roles::APEX,
            ]))),
        )
        .layer(axum::middleware::from_fn_with_state(
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
