mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use tower::util::ServiceExt;
use uuid::Uuid;

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// ─── Auth guard: federation profile ──────────────────────────────────────────

#[tokio::test]
async fn get_federation_profile_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/profile")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn patch_federation_profile_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri("/api/v1/federation/profile")
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: federation stats ────────────────────────────────────────────

#[tokio::test]
async fn get_federation_stats_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: federation apexes ───────────────────────────────────────────

#[tokio::test]
async fn list_federation_apexes_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/apexes")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_federation_apex_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/federation/apexes")
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name":"New Apex"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_federation_apex_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/federation/apexes/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_federation_apex_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/v1/federation/apexes/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: federation submissions ──────────────────────────────────────

#[tokio::test]
async fn list_federation_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_federation_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/federation/submissions/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn approve_federation_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/federation/submissions/{id}/approve"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn return_federation_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/federation/submissions/{id}/return"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: federation bulk export ──────────────────────────────────────

#[tokio::test]
async fn export_federation_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/export")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
