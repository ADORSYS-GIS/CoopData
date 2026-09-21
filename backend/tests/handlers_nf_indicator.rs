mod common;

use axum::http::Method;
use common::mock::TestApp;
use common::mock_db::MockKeycloak;
use sea_orm::{DatabaseBackend, MockDatabase};
use uuid::Uuid;

/// Mock-DB app with the mock Keycloak group tree ("test-apex" → "test-coop").
/// Used by tests whose handlers resolve the caller's cooperative through
/// the `cooperation` claim + `resolve_group`.
///
/// `coop_pops` = how many times the handler path reads a cooperative row
/// (find_by_keycloak_id + filter_cooperatives' find_by_ids). Then: one empty
/// submission pop, then empty entity scans for the `NfIndicatorEngine`
/// aggregates → statistics come back zeroed with 200.
async fn app_with_keycloak(coop_pops: usize) -> (TestApp, MockKeycloak) {
    use coop_data_backend::entities::{
        farm_coop, fixed_deposit, loan, member, savings_account, submission,
    };

    let kc = MockKeycloak::start("test-apex", "test-apex", "test-coop").await;

    let coop_row =
        common::mock_db::cooperative_row(uuid::Uuid::new_v4(), "test-coop", uuid::Uuid::new_v4());
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![vec![coop_row]; coop_pops])
        .append_query_results(vec![Vec::<submission::Model>::new(); 2])
        .append_query_results(vec![Vec::<member::Model>::new(); 2])
        .append_query_results(vec![Vec::<savings_account::Model>::new(); 2])
        .append_query_results(vec![Vec::<loan::Model>::new(); 2])
        .append_query_results(vec![Vec::<fixed_deposit::Model>::new(); 2])
        .append_query_results(vec![Vec::<farm_coop::Model>::new(); 2]);

    let app = TestApp::with_db_and_keycloak_url(mock.into_connection(), kc.url()).await;
    (app, kc)
}

// ─── nf_indicator_stats.rs ───────────────────────────────────────────────────

#[tokio::test]
async fn get_nf_statistics_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/cooperative/nf-statistics")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_nf_statistics_success_coop_admin() {
    let (app, _kc) = app_with_keycloak(1).await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/cooperative/nf-statistics")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);
}

#[tokio::test]
async fn get_nf_trend_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/nf-trend")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_nf_trend_success_coop_admin() {
    let (app, _kc) = app_with_keycloak(2).await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/nf-trend")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);
}

#[tokio::test]
async fn get_consolidated_nf_statistics_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/consolidated-nf-statistics")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn get_consolidated_nf_statistics_success_coop_admin() {
    let (app, _kc) = app_with_keycloak(2).await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/analytics/consolidated-nf-statistics")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);
}

// ─── non_financial_indicator.rs ──────────────────────────────────────────────

#[tokio::test]
async fn list_catalog_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/non-financial-indicators/catalog")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn list_catalog_success() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::non_financial_indicator_catalog::Model,
        >::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let res = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/non-financial-indicators/catalog")
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(200);
    let json: Vec<serde_json::Value> = res.json().await;
    assert!(json.is_empty());
}

#[tokio::test]
async fn create_catalog_item_requires_ministry() {
    let app = TestApp::new().await;
    let payload = serde_json::json!({
        "indicator_name": "test",
        "display_name": "Test",
        "data_type": "Number",
        "is_required": false,
    });

    app.request()
        .method(Method::POST)
        .uri("/api/v1/ministry/non-financial-indicators/catalog")
        .with_coop_admin_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn update_catalog_item_requires_ministry() {
    let app = TestApp::new().await;
    let payload = serde_json::json!({
        "display_name": "Test",
        "description": null,
        "data_type": "Number",
        "is_required": false,
    });

    app.request()
        .method(Method::PUT)
        .uri(format!(
            "/api/v1/ministry/non-financial-indicators/catalog/{}",
            Uuid::new_v4()
        ))
        .with_coop_admin_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn delete_catalog_item_requires_ministry() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::DELETE)
        .uri(format!(
            "/api/v1/ministry/non-financial-indicators/catalog/{}",
            Uuid::new_v4()
        ))
        .with_coop_admin_auth()
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn get_submission_entries_requires_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri(format!(
            "/api/v1/cooperative/submissions/{}/non-financial-indicators",
            Uuid::new_v4()
        ))
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn save_submission_entries_requires_auth() {
    let app = TestApp::new().await;
    let payload = serde_json::json!({ "entries": [] });
    app.request()
        .method(Method::POST)
        .uri(format!(
            "/api/v1/cooperative/submissions/{}/non-financial-indicators",
            Uuid::new_v4()
        ))
        .json(&payload)
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn consolidate_indicator_requires_ministry_auth() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/ministry/non-financial-indicators/consolidate?indicator_name=test")
        .send()
        .await
        .assert_status(401);
}

#[tokio::test]
async fn consolidate_indicator_requires_indicator_name() {
    let app = TestApp::new().await;
    app.request()
        .method(Method::GET)
        .uri("/api/v1/ministry/non-financial-indicators/consolidate")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(400); // Bad Request missing param
}
