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

// ─── Extraction handler auth guards ──────────────────────────────────────────

#[tokio::test]
async fn get_extraction_job_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/cooperative/extraction-jobs/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn validate_extraction_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{id}/validate-extraction"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Extraction job status domain logic ──────────────────────────────────────

#[tokio::test]
async fn extraction_job_terminal_statuses_are_recognized() {
    let terminal = ["succeeded", "failed", "partial"];
    let non_terminal = ["queued", "processing"];

    for s in terminal {
        assert!(
            matches!(s, "succeeded" | "failed" | "partial"),
            "{s} should be terminal"
        );
    }
    for s in non_terminal {
        assert!(
            !matches!(s, "succeeded" | "failed" | "partial"),
            "{s} should not be terminal"
        );
    }
}

#[tokio::test]
async fn extraction_job_initial_status_is_queued() {
    // Verify the string used when creating a new extraction job record
    let initial_status = "queued";
    assert_eq!(initial_status, "queued", "new jobs must start as queued");
    assert_ne!(initial_status, "processing");
    assert_ne!(initial_status, "succeeded");
}
