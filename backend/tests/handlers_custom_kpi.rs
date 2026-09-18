mod common;

use axum::http::Method;
use common::mock::TestApp;
use coop_data_backend::api::dto::custom_kpi::{
    CreateCustomKpiRequest, CustomKpiDto, EvaluateKpiRequest, UpdateCustomKpiRequest,
};
use coop_data_backend::entities::{audit_log, custom_kpi, non_financial_indicator_catalog, user};
use sea_orm::{DatabaseBackend, MockDatabase};

/// Mock-backed app: 1 user lookup miss, then the KPI INSERT…RETURNING row,
/// then the audit-log user lookup miss and its INSERT…RETURNING row.
fn create_kpi_mock_app(kpi_row: custom_kpi::Model) -> MockDatabase {
    let audit_row = audit_log::Model {
        id: uuid::Uuid::new_v4(),
        actor_keycloak_id: "test-user".into(),
        actor_id: None,
        action: "CREATE".into(),
        resource_type: "custom_kpi".into(),
        resource_keycloak_id: None,
        details: None,
        ip_address: None,
        user_agent: None,
        created_at: chrono::Utc::now(),
    };
    MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<user::Model>::new()])
        .append_query_results(vec![vec![kpi_row]])
        .append_query_results(vec![Vec::<user::Model>::new()])
        .append_query_results(vec![vec![audit_row]])
}

fn kpi_row(name: &str, formula: &str) -> custom_kpi::Model {
    custom_kpi::Model {
        id: uuid::Uuid::new_v4(),
        name: name.into(),
        description: None,
        translations: serde_json::json!({}),
        formula: formula.into(),
        created_by: None,
        created_at: chrono::Utc::now().into(),
        updated_at: chrono::Utc::now().into(),
    }
}

// ─── POST /api/v1/ministry/custom-kpis ───────────────────────────────────────

#[tokio::test]
async fn create_custom_kpi_requires_auth() {
    let app = TestApp::new().await;
    let payload = CreateCustomKpiRequest {
        name: "Test KPI".into(),
        description: None,
        formula: "A + B".into(),
        translations: None,
    };

    app.request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis")
        .json(&payload)
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn create_custom_kpi_requires_ministry_role() {
    let app = TestApp::new().await;
    let payload = CreateCustomKpiRequest {
        name: "Test KPI".into(),
        description: None,
        formula: "A + B".into(),
        translations: None,
    };

    app.request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis")
        .with_coop_admin_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn create_custom_kpi_rejects_invalid_formula() {
    let app = TestApp::new().await;
    let payload = CreateCustomKpiRequest {
        name: "Test KPI".into(),
        description: None,
        formula: "A + B * ( missing parenthesis".into(),
        translations: None,
    };

    app.request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(400);
}

#[tokio::test]
async fn create_custom_kpi_success() {
    let mock = create_kpi_mock_app(kpi_row("Test KPI", "1 + 1"));
    let app = TestApp::with_db(mock.into_connection()).await;
    let payload = CreateCustomKpiRequest {
        name: "Test KPI".into(),
        description: None,
        formula: "1 + 1".into(),
        translations: None,
    };

    let response = app
        .request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(201);

    let kpi: CustomKpiDto = response.json().await;
    assert_eq!(kpi.name, "Test KPI");
    assert_eq!(kpi.formula, "1 + 1");
}

// ─── GET /api/v1/ministry/custom-kpis ────────────────────────────────────────

#[tokio::test]
async fn list_custom_kpis_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/ministry/custom-kpis")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn list_custom_kpis_success() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<custom_kpi::Model>::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/ministry/custom-kpis")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(200);

    let json: Vec<serde_json::Value> = response.json().await;
    assert!(json.is_empty(), "mock repo returns empty initially");
}

// ─── PUT /api/v1/ministry/custom-kpis/{id} ───────────────────────────────────

#[tokio::test]
async fn update_custom_kpi_requires_auth() {
    let app = TestApp::new().await;
    let payload = UpdateCustomKpiRequest {
        name: Some("Updated".into()),
        description: None,
        formula: None,
        translations: None,
    };

    app.request()
        .method(Method::PUT)
        .uri(format!(
            "/api/v1/ministry/custom-kpis/{}",
            uuid::Uuid::new_v4()
        ))
        .json(&payload)
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn update_custom_kpi_not_found() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<custom_kpi::Model>::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let payload = UpdateCustomKpiRequest {
        name: Some("Updated".into()),
        description: None,
        formula: None,
        translations: None,
    };

    app.request()
        .method(Method::PUT)
        .uri(format!(
            "/api/v1/ministry/custom-kpis/{}",
            uuid::Uuid::new_v4()
        ))
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(404);
}

// ─── DELETE /api/v1/ministry/custom-kpis/{id} ────────────────────────────────

#[tokio::test]
async fn delete_custom_kpi_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::DELETE)
        .uri(format!(
            "/api/v1/ministry/custom-kpis/{}",
            uuid::Uuid::new_v4()
        ))
        .send()
        .await
        .assert_status(401);
}

// ─── POST /api/v1/ministry/custom-kpis/evaluate ──────────────────────────────

#[tokio::test]
async fn evaluate_custom_kpi_requires_auth() {
    let app = TestApp::new().await;
    let payload = EvaluateKpiRequest {
        formula: "1 + 1".into(),
    };

    app.request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis/evaluate")
        .json(&payload)
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn evaluate_custom_kpi_success() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<non_financial_indicator_catalog::Model>::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let payload = EvaluateKpiRequest {
        formula: "total_assets * 2".into(),
    };

    let response = app
        .request()
        .method(Method::POST)
        .uri("/api/v1/ministry/custom-kpis/evaluate")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert_eq!(json["is_valid"], true);
    // Dummy values fallback to 100
    assert_eq!(json["value"], 200.0);
}
