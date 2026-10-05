mod common;

use common::mock_db::{apex_row, cooperative_row, federation_row, RecordingMock};
use coop_data_backend::error::AppError;
use uuid::Uuid;

#[tokio::test]
async fn coop_find_by_keycloak_group_id_filters_on_group_id() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .cooperative_repo
        .find_by_keycloak_group_id(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("keycloak_group_id"), "filter missing: {}", sql);
}

#[tokio::test]
async fn coop_find_by_name_binds_name() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .cooperative_repo
        .find_by_name("Mooi River")
        .await
        .expect("query ok");

    assert!(
        rm.sql()[0].contains("name"),
        "filter missing: {}",
        rm.sql()[0]
    );
    assert!(
        rm.binds(0).contains(&"Mooi River".to_string()),
        "name bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn coop_find_by_ids_empty_list_never_queries() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let rows = app
        .state
        .cooperative_repo
        .find_by_ids(vec![])
        .await
        .expect("short-circuits");
    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn coop_find_by_apex_id_scopes_to_apex() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let apex_id = Uuid::new_v4();
    app.state
        .cooperative_repo
        .find_by_apex_id(apex_id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("apex_id"), "apex scope missing: {}", sql);
    assert!(
        rm.binds(0).contains(&apex_id.to_string()),
        "apex bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn federation_create_unique_violation_maps_to_conflict() {
    let id = Uuid::new_v4();
    let failing = RecordingMock::postgres().fail_insert_unique().build();
    let app = failing.app().await;

    let err = app
        .state
        .federation_repo
        .create(federation_active(id))
        .await
        .expect_err("unique violation must surface");

    assert!(matches!(err, AppError::Conflict(_)), "got: {err:?}");
    assert!(
        failing.sql()[0].contains("insert"),
        "failure happens on the INSERT: {}",
        failing.sql()[0]
    );
}

#[tokio::test]
async fn federation_update_metadata_merges_and_binds() {
    let id = Uuid::new_v4();
    let mut before = federation_row(id, "kc-fed");
    before.metadata = Some(serde_json::json!({ "keep": "yes", "stale": 1 }));
    let after = before.clone();

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .federation_repo
        .update_metadata(id, serde_json::json!({ "stale": 2, "new_key": true }))
        .await
        .expect("update ok");

    assert_eq!(updated.id, id);
    let binds = rm.binds(1);
    let merged = binds
        .iter()
        .find(|b| b.contains("\"keep\""))
        .unwrap_or_else(|| panic!("merged metadata bound: {:?}", binds));
    assert!(merged.contains("\"stale\":2"), "patch applied: {}", merged);
    assert!(merged.contains("\"new_key\":true"), "new key: {}", merged);
}

#[tokio::test]
async fn federation_update_metadata_missing_row_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .federation_repo
        .update_metadata(Uuid::new_v4(), serde_json::json!({}))
        .await
        .expect_err("must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
}

#[tokio::test]
async fn apex_find_by_federation_id_scopes_to_federation() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let fed_id = Uuid::new_v4();
    app.state
        .apex_repo
        .find_by_federation_id(fed_id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("federation_id"),
        "federation scope missing: {}",
        sql
    );
    assert!(
        rm.binds(0).contains(&fed_id.to_string()),
        "fed bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn apex_find_by_ids_empty_list_never_queries() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let rows = app
        .state
        .apex_repo
        .find_by_ids(vec![])
        .await
        .expect("short-circuits");
    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn apex_update_metadata_missing_row_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .apex_repo
        .update_metadata(Uuid::new_v4(), serde_json::json!({}))
        .await
        .expect_err("must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
}

#[tokio::test]
async fn apex_delete_issues_delete_by_id() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .apex_repo
        .delete(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "is a DELETE: {}", sql);
    assert!(sql.contains("apex"), "targets apex table: {}", sql);
}

#[tokio::test]
async fn apex_and_coop_rows_survive_model_roundtrip() {
    // Model → MockRow → Model roundtrip catches fixture/field drift early.
    let id = Uuid::new_v4();
    let fed = federation_row(id, "kc-fed");
    let apex = apex_row(id, "kc-apex", id);
    let coop = cooperative_row(id, "kc-coop", id);

    let rm = RecordingMock::postgres()
        .query_rows(vec![fed])
        .query_rows(vec![apex])
        .query_rows(vec![coop])
        .build();
    let app = rm.app().await;

    let fed = app
        .state
        .federation_repo
        .find_by_id(id)
        .await
        .expect("ok")
        .expect("row");
    let apex = app
        .state
        .apex_repo
        .find_by_id(id)
        .await
        .expect("ok")
        .expect("row");
    let coop = app
        .state
        .cooperative_repo
        .find_by_id(id)
        .await
        .expect("ok")
        .expect("row");

    assert_eq!(fed.keycloak_id, "kc-fed");
    assert_eq!(apex.federation_id, id);
    assert_eq!(coop.apex_id, id);
}

fn federation_active(id: Uuid) -> coop_data_backend::entities::federation::ActiveModel {
    use coop_data_backend::entities::federation;
    use sea_orm::ActiveValue::Set;
    let mut m = federation::ActiveModel::from(federation_row(id, "kc-fed"));
    m.id = Set(id);
    m.keycloak_id = Set("kc-fed".to_string());
    m
}
