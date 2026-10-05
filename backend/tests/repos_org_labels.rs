mod common;

use common::mock_db::RecordingMock;
use coop_data_backend::api::dto::{UpdateOrganizationLabelRequest, UpdateOrganizationRequest};
use coop_data_backend::entities::{organization, organization_label};
use coop_data_backend::error::AppError;
use sea_orm::Set;
use uuid::Uuid;

fn org_label_row(key: &str) -> organization_label::Model {
    organization_label::Model {
        key: key.to_string(),
        label: "Cooperative".to_string(),
        short_label: "Coop".to_string(),
        plural_label: "Cooperatives".to_string(),
        description: None,
        icon: "building".to_string(),
        translations: serde_json::json!({}),
        created_at: chrono::Utc::now().into(),
        updated_at: chrono::Utc::now().into(),
    }
}

fn org_row(id: Uuid, name: &str) -> organization::Model {
    organization::Model {
        id,
        name: name.to_string(),
        organization_type: "SACCO".to_string(),
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

// ─── OrganizationLabelRepository ───────────────────────────────────────────────

#[tokio::test]
async fn org_label_find_by_key_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_label_repo
        .find_by_key("TEST_KEY")
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("organization_label"), "must target table");
    assert!(rm.binds(0).contains(&"TEST_KEY".to_string()));
}

#[tokio::test]
async fn org_label_find_all_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_label_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("organization_label"), "must target table");
}

#[tokio::test]
async fn org_label_update_issues_find_then_update() {
    let key = "TEST_KEY";
    let existing = org_label_row(key);
    let updated = org_label_row(key);

    let rm = RecordingMock::postgres()
        .query_rows(vec![existing])
        .query_rows(vec![updated])
        .build();
    let app = rm.app().await;

    app.state
        .organization_label_repo
        .update(
            key,
            UpdateOrganizationLabelRequest {
                label: "L".into(),
                short_label: "S".into(),
                plural_label: "P".into(),
                description: None,
                icon: "building".into(),
                translations: serde_json::json!({}),
            },
        )
        .await
        .expect("update ok");

    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2);
    assert!(sqls[0].contains("select"), "first check existing");
    assert!(sqls[1].contains("update"), "then update");
}

#[tokio::test]
async fn org_label_update_not_found_maps_to_error() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .organization_label_repo
        .update(
            "MISSING",
            UpdateOrganizationLabelRequest {
                label: "L".into(),
                short_label: "S".into(),
                plural_label: "P".into(),
                description: None,
                icon: "building".into(),
                translations: serde_json::json!({}),
            },
        )
        .await
        .expect_err("should fail");

    assert!(matches!(err, AppError::NotFound(_)));
}

// ─── OrganizationRepository ───────────────────────────────────────────────────

#[tokio::test]
async fn org_find_by_id_issues_select() {
    let id = Uuid::new_v4();
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .find_by_id(id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("organization"), "must target table");
    assert!(rm.binds(0).contains(&id.to_string()));
}

#[tokio::test]
async fn org_find_all_issues_select_with_order() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("order by"), "must order by name: {sql}");
}

#[tokio::test]
async fn org_find_active_filters_by_is_active() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .find_active()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("is_active"), "must filter is_active");
}

#[tokio::test]
async fn org_find_by_type_filters_by_type_and_active() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .find_by_type("SACCO")
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("organization_type"), "must filter type");
    assert!(sql.contains("is_active"), "must filter is_active");
}

#[tokio::test]
async fn org_create_unique_violation_maps_to_conflict() {
    let rm = RecordingMock::postgres().fail_insert_unique().build();
    let app = rm.app().await;

    let active = organization::ActiveModel {
        name: Set("Duplicate".into()),
        organization_type: Set("SACCO".into()),
        ..Default::default()
    };

    let err = app
        .state
        .organization_repo
        .create(active)
        .await
        .expect_err("should conflict");

    assert!(matches!(err, AppError::Conflict(_)));
}

#[tokio::test]
async fn org_update_issues_find_then_update() {
    let id = Uuid::new_v4();
    let existing = org_row(id, "Old");
    let updated = org_row(id, "New");

    let rm = RecordingMock::postgres()
        .query_rows(vec![existing])
        .query_rows(vec![updated])
        .build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .update(
            id,
            UpdateOrganizationRequest {
                name: Some("New".into()),
                organization_type: None,
                registration_number: None,
                sector: None,
                region: None,
                contact_email: None,
                contact_phone: None,
                address: None,
                federation_id: None,
                is_active: None,
            },
        )
        .await
        .expect("update ok");

    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2);
    assert!(sqls[0].contains("select"), "first check existing");
    assert!(sqls[1].contains("update"), "then update");
}

#[tokio::test]
async fn org_delete_issues_delete() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .organization_repo
        .delete(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
}

#[tokio::test]
async fn org_count_issues_count() {
    let rm = RecordingMock::postgres()
        .query_rows(vec![crate::common::mock_db::num_items_row(42)])
        .build();
    let app = rm.app().await;

    let count = app.state.organization_repo.count().await.expect("count ok");
    assert_eq!(count, 42);

    let sql = &rm.sql()[0];
    assert!(sql.contains("count"), "must issue COUNT query: {sql}");
}
