//! Auth integration tests — verifies 401/403 behavior.
//!
//! These tests verify that the double-gatekeeper pattern works:
//! 1. Backend rejects unauthenticated requests with 401
//! 2. Backend rejects wrong-role requests with 403
//!
//! Note: 403 tests require a valid JWT with a specific role.
//! The test setup uses a permissive validator for 401 tests.

mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use tower::util::ServiceExt;

/// Creates a test app instance.
async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// =============================================================================
// 401 Tests — Unauthenticated requests
// =============================================================================

#[tokio::test]
async fn test_health_check_public_no_auth_required() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_protected_routes_require_auth() {
    let app = app().await;

    // All these routes should return 401 without auth header
    let protected_routes = [
        "/api/v1/me",
        "/api/v1/ministry/federations",
        "/api/v1/federation/apexes",
        "/api/v1/apex/cooperatives",
        "/api/v1/cooperative/profile",
        "/api/v1/users",
    ];

    for uri in protected_routes {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri(uri)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Expected 401 for {} without auth header",
            uri,
        );
    }
}

#[tokio::test]
async fn test_missing_auth_header_returns_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/ministry/federations")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn test_invalid_bearer_token_returns_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .header("Authorization", "Bearer not-a-valid-jwt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_malformed_authorization_header_returns_401() {
    let app = app().await;

    // Missing "Bearer " prefix
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .header("Authorization", "Token abc123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_empty_bearer_token_returns_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .header("Authorization", "Bearer ")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =============================================================================
// 403 Tests — Wrong role access
// =============================================================================
//
// Note: 403 tests require a valid JWT with a specific role.
// These tests document the expected behavior but require integration
// with a real Keycloak instance or mock JWT generator.
//
// Example 403 test (requires valid JWT with "cooperative" role):
// ```ignore
// #[tokio::test]
// async fn test_cooperative_cannot_access_ministry_routes() {
//     let app = app().await;
//     let cooperative_token = create_test_token("cooperative");
//
//     let response = app
//         .oneshot(
//             Request::builder()
//                 .method(Method::GET)
//                 .uri("/api/v1/ministry/federations")
//                 .header("Authorization", format!("Bearer {}", cooperative_token))
//                 .body(Body::empty())
//                 .unwrap(),
//         )
//         .await
//         .unwrap();
//
//     assert_eq!(response.status(), StatusCode::FORBIDDEN);
// }
// ```

#[tokio::test]
async fn test_openapi_spec_accessible_without_auth() {
    // OpenAPI spec is public documentation
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}