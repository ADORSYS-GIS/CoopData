mod common;

use common::mock::TestApp;
use coop_data_backend::api::dto::{CreateOrganizationRequest, UpdateOrganizationLabelRequest};
use axum::http::Method;
use sea_orm::{DatabaseBackend, MockDatabase};
use uuid::Uuid;

use coop_data_backend::entities::{audit_log, organization, user};

fn org_row(name: &str) -> organization::Model {
    organization::Model {
        id: Uuid::new_v4(),
        name: name.into(),
        organization_type: "SACCO".into(),
        registration_number: None,
        sector: None,
        region: None,
        contact_email: None,
        contact_phone: None,
        address: None,
        federation_id: None,
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

fn audit_row() -> audit_log::Model {
    audit_log::Model {
        id: Uuid::new_v4(),
        actor_keycloak_id: "test-user".into(),
        actor_id: None,
        action: "AUDIT".into(),
        resource_type: "organization".into(),
        resource_keycloak_id: None,
        details: None,
        ip_address: None,
        user_agent: None,
        created_at: chrono::Utc::now(),
    }
}

// ─── organization_label.rs ───────────────────────────────────────────────────

#[tokio::test]
async fn list_organization_labels_success() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres).append_query_results(vec![Vec::<
        coop_data_backend::entities::organization_label::Model,
    >::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/settings/organization-labels")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(200);

    let json: Vec<serde_json::Value> = response.json().await;
    assert!(json.is_empty(), "mock repo returns empty initially");
}

#[tokio::test]
async fn update_organization_label_requires_ministry() {
    let app = TestApp::new().await;
    let payload = UpdateOrganizationLabelRequest {
        label: "Updated".into(),
        short_label: "Upd".into(),
        plural_label: "Updateds".into(),
        description: None,
        icon: "icon".into(),
        translations: serde_json::json!({}),
    };

    app.request()
        .method(Method::PUT)
        .uri("/api/v1/settings/organization-labels/ministry")
        .with_coop_admin_auth() // not ministry
        .json(&payload)
        .send()
        .await
        .assert_status(403);
}

#[tokio::test]
async fn update_organization_label_invalid_key() {
    let app = TestApp::new().await;
    let payload = UpdateOrganizationLabelRequest {
        label: "Updated".into(),
        short_label: "Upd".into(),
        plural_label: "Updateds".into(),
        description: None,
        icon: "icon".into(),
        translations: serde_json::json!({}),
    };

    app.request()
        .method(Method::PUT)
        .uri("/api/v1/settings/organization-labels/invalid_key")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(400);
}

#[tokio::test]
async fn update_organization_label_not_found() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres).append_query_results(vec![Vec::<
        coop_data_backend::entities::organization_label::Model,
    >::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let payload = UpdateOrganizationLabelRequest {
        label: "Updated".into(),
        short_label: "Upd".into(),
        plural_label: "Updateds".into(),
        description: None,
        icon: "icon".into(),
        translations: serde_json::json!({}),
    };

    app.request()
        .method(Method::PUT)
        .uri("/api/v1/settings/organization-labels/ministry")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(404);
}

// ─── organizations.rs ────────────────────────────────────────────────────────

#[tokio::test]
async fn list_organizations_success() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres).append_query_results(vec![Vec::<
        organization::Model,
    >::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let response = app
        .request()
        .method(Method::GET)
        .uri("/api/v1/ministry/organizations")
        .with_ministry_auth()
        .send()
        .await
        .assert_status(200);

    let json: serde_json::Value = response.json().await;
    assert_eq!(json["total"], 0);
    assert_eq!(json["page"], 1);
    assert!(json["data"].is_array());
}

#[tokio::test]
async fn get_organization_not_found() {
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![Vec::<organization::Model>::new()]);
    let app = TestApp::with_db(mock.into_connection()).await;
    app.request()
        .method(Method::GET)
        .uri(format!("/api/v1/ministry/organizations/{}", Uuid::new_v4()))
        .with_ministry_auth()
        .send()
        .await
        .assert_status(404);
}

#[tokio::test]
async fn create_organization_success() {
    // Pop order: 1) org INSERT…RETURNING, 2) audit user lookup, 3) audit
    // INSERT…RETURNING. The cache invalidation never touches the DB.
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(vec![vec![org_row("Test Org")]])
        .append_query_results(vec![Vec::<user::Model>::new()])
        .append_query_results(vec![vec![audit_row()]]);
    let app = TestApp::with_db(mock.into_connection()).await;
    let payload = CreateOrganizationRequest {
        name: "Test Org".into(),
        organization_type: "SACCO".into(),
        registration_number: Some("REG123".into()),
        sector: Some("Agriculture".into()),
        region: Some("Central".into()),
        contact_email: Some("test@example.com".into()),
        contact_phone: Some("123456789".into()),
        address: Some("123 Test St".into()),
        federation_id: None,
    };

    let response = app
        .request()
        .method(Method::POST)
        .uri("/api/v1/ministry/organizations")
        .with_ministry_auth()
        .json(&payload)
        .send()
        .await
        .assert_status(201);

    let json: serde_json::Value = response.json().await;
    assert_eq!(json["name"], "Test Org");
}

#[tokio::test]
async fn delete_organization_success() {
    // Pop order: 1) plain DELETE exec, 2) audit user lookup, 3) audit
    // INSERT…RETURNING.
    let mock = MockDatabase::new(DatabaseBackend::Postgres)
        .append_exec_results(vec![sea_orm::MockExecResult {
            rows_affected: 1,
            ..Default::default()
        }])
        .append_query_results(vec![Vec::<user::Model>::new()])
        .append_query_results(vec![vec![audit_row()]]);
    let app = TestApp::with_db(mock.into_connection()).await;
    // mock repo currently returns Ok(()) on delete without checking if it exists
    app.request()
        .method(Method::DELETE)
        .uri(format!("/api/v1/ministry/organizations/{}", Uuid::new_v4()))
        .with_ministry_auth()
        .send()
        .await
        .assert_status(204);
}
