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

// ─── Upload auth guards ───────────────────────────────────────────────────────

#[tokio::test]
async fn upload_financial_statement_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/cooperative/financial-statement/upload")
                .header("Content-Type", "multipart/form-data; boundary=----boundary")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_uploaded_files_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/cooperative/submissions/{id}/files"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn serve_uploaded_file_no_auth_returns_401() {
    let sub_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{sub_id}/files/{file_id}"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_uploaded_file_no_auth_returns_401() {
    let sub_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{sub_id}/files/{file_id}"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_financial_statement_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{id}/financial-statement"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── UploadResponse DTO ───────────────────────────────────────────────────────

#[tokio::test]
async fn upload_response_has_required_fields() {
    use coop_data_backend::api::dto::upload::UploadResponse;

    let submission_id = Uuid::new_v4();
    let fs_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();

    let resp = UploadResponse {
        submission_id,
        financial_statement_id: fs_id,
        extraction_job_id: job_id,
    };

    let json = serde_json::to_value(&resp).unwrap();
    assert_eq!(json["submission_id"], submission_id.to_string());
    assert_eq!(json["financial_statement_id"], fs_id.to_string());
    assert_eq!(json["extraction_job_id"], job_id.to_string());
}
