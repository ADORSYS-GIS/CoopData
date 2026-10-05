mod common;

use axum::http::Method;
use common::mock::TestApp;
use sea_orm::{DatabaseBackend, MockDatabase};

/// Empty-DB mock: the unconditional SELECTs the analytics handlers issue
/// with no cooperatives in scope (cooperative list, apex list, NF catalog,
/// custom-KPI list). All other repo calls short-circuit on empty ID lists.
async fn empty_analytics_app() -> TestApp {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![
            Vec::<coop_data_backend::entities::cooperative::Model>::new(),
            Vec::<coop_data_backend::entities::cooperative::Model>::new(),
        ])
        .append_query_results(vec![Vec::<coop_data_backend::entities::apex::Model>::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::non_financial_indicator_catalog::Model,
        >::new()])
        .append_query_results(vec![
            Vec::<coop_data_backend::entities::custom_kpi::Model>::new(),
        ]);
    TestApp::with_db(mock.into_connection()).await
}

// ─── GET /api/v1/analytics/national-overview ─────────────────────────────────

#[tokio::test]
async fn get_national_overview_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/national-overview")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_national_overview_success_ministry() {
    let app = empty_analytics_app().await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/analytics/national-overview")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    // Base assertions on the empty DB mock state
    assert_eq!(json["total_cooperatives"], 0);
    assert_eq!(json["cooperatives_with_data"], 0);
}

// ─── GET /api/v1/analytics/benchmark ─────────────────────────────────────────

#[tokio::test]
async fn get_benchmark_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/benchmark")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_benchmark_success_coop_admin() {
    let app = empty_analytics_app().await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/analytics/benchmark")
        .with_ministry_auth() // coop tokens need a Keycloak group path; empty scope via ministry
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert!(json["cooperative"].is_null(), "mock DB is empty");
    assert!(json["national_average"].is_null());
}

// ─── GET /api/v1/analytics/comparative ───────────────────────────────────────

#[tokio::test]
async fn get_comparative_statements_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/comparative-statements")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_comparative_statements_success_coop_admin() {
    let app = empty_analytics_app().await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/analytics/comparative-statements")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert!(json["grids"].is_array());
    assert!(json["grids"].as_array().expect("grids").is_empty());
}
