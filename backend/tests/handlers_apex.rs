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

// ─── Auth guard: apex profile & stats ────────────────────────────────────────

#[tokio::test]
async fn get_apex_profile_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/profile")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_apex_stats_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: apex cooperatives ───────────────────────────────────────────

#[tokio::test]
async fn list_apex_cooperatives_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/cooperatives")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_apex_cooperative_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/apex/cooperatives")
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name":"New Coop"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_apex_cooperative_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/apex/cooperatives/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_apex_cooperative_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/v1/apex/cooperatives/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: apex submissions ────────────────────────────────────────────

#[tokio::test]
async fn list_apex_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_apex_submission_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/apex/submissions")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"reporting_year":2026,"period_type":"yearly","submission_method":"manual","fiscal_start_month":1,"priority":"normal"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_apex_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/apex/submissions/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn apex_approve_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/apex/submissions/{id}/approve"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn apex_return_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/apex/submissions/{id}/return"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn apex_submit_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/apex/submissions/{id}/submit"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_apex_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/v1/apex/submissions/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Auth guard: apex bulk export ────────────────────────────────────────────

#[tokio::test]
async fn export_apex_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/export")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
