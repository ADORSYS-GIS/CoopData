mod common;

use common::mock::TestApp;
use axum::http::Method;
use uuid::Uuid;

#[tokio::test]
async fn export_single_submission_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri(format!("/api/v1/cooperative/submissions/{}/export", Uuid::new_v4()))
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn export_bulk_consolidated_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/apex/export?reporting_year=2025")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_submission_narratives_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri(format!("/api/v1/cooperative/submissions/{}/narratives", Uuid::new_v4()))
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn generate_submission_narratives_requires_ministry() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::POST)
        .uri(format!("/api/v1/cooperative/submissions/{}/narratives", Uuid::new_v4()))
        .with_coop_admin_auth() // not ministry
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn get_apex_narratives_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/apex/123/narratives?year=2025")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_federation_narratives_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/federation/123/narratives?year=2025")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_ministry_narratives_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/ministry/submissions/narratives?year=2025")
        .send()
        .await
        .assert_status(401);
}
