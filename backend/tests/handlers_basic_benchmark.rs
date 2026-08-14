mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use tower::util::ServiceExt;

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// ─── Basic benchmark route is registered ────────────────────────────────────

#[tokio::test]
async fn test_basic_benchmark_route_registered() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/analytics/basic-benchmark")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    // Without auth, should be 401 — proves the route is registered
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── OpenAPI spec includes basic benchmark endpoint ─────────────────────────

#[tokio::test]
async fn test_openapi_includes_basic_benchmark_endpoint() {
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
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let paths = spec["paths"].as_object().unwrap();
    assert!(paths.contains_key("/api/v1/analytics/basic-benchmark"));
}

#[tokio::test]
async fn test_openapi_includes_basic_benchmark_schemas() {
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
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let components = spec["components"]["schemas"].as_object().unwrap();
    assert!(components.contains_key("BasicBenchmarkResponse"));
    assert!(components.contains_key("BasicBenchmarkRow"));
    assert!(components.contains_key("BasicBenchmarkInsufficientData"));
    assert!(components.contains_key("BasicBenchmarkParams"));
}
