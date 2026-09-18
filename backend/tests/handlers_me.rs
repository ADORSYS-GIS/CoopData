mod common;

use common::mock::TestApp;
use common::mock_db::MockKeycloak;
use axum::http::Method;
use sea_orm::DatabaseConnection;

#[tokio::test]
async fn get_me_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/me")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_me_success() {
    let app = TestApp::with_db(DatabaseConnection::default()).await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/me")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert_eq!(json["email"], "user@test.example");
}

#[tokio::test]
async fn get_security_settings_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/me/security")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_security_settings_success() {
    let kc = MockKeycloak::start("apex", "apex-group", "coop-group").await;
    let app = TestApp::with_db_and_keycloak_url(DatabaseConnection::default(), kc.url()).await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/me/security")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert_eq!(json["mfa_enabled"], false);
    assert_eq!(json["mfa_configured"], false);
}

#[tokio::test]
async fn mfa_setup_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::POST)
        .uri("/api/v1/me/security/mfa/setup")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn change_password_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::POST)
        .uri("/api/v1/me/password")
        .json(&serde_json::json!({
            "current_password": "old",
            "new_password": "new",
        }))
        .send()
        .await
        .assert_status(401);
}
