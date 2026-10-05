mod common;

use common::mock_db::RecordingMock;
use coop_data_backend::entities::custom_kpi;
use coop_data_backend::error::AppError;
use uuid::Uuid;

fn custom_kpi_row(id: Uuid, name: &str) -> custom_kpi::Model {
    custom_kpi::Model {
        id,
        name: name.to_string(),
        description: None,
        formula: "A + B".to_string(),
        translations: serde_json::json!({}),
        created_by: None,
        created_at: chrono::Utc::now().into(),
        updated_at: chrono::Utc::now().into(),
    }
}

// ─── KpiRecordRepository ──────────────────────────────────────────────────────

#[tokio::test]
async fn kpi_record_find_by_submission_issues_select_with_filter() {
    let sub_id = Uuid::new_v4();
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .kpi_record_repo
        .find_by_submission(sub_id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(
        sql.contains("kpi_record"),
        "must target kpi_record table: {sql}"
    );
    assert!(sql.contains("submission_id"), "filter missing: {sql}");
    assert!(rm.binds(0).contains(&sub_id.to_string()));
}

#[tokio::test]
async fn kpi_record_find_by_submission_ids_empty_short_circuits() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let res = app
        .state
        .kpi_record_repo
        .find_by_submission_ids(vec![])
        .await
        .expect("query ok");

    assert!(res.is_empty());
    assert!(rm.sql().is_empty(), "must not query DB on empty list");
}

#[tokio::test]
async fn kpi_record_find_by_cooperative_ids_issues_in_clause() {
    let coop_id = Uuid::new_v4();
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .kpi_record_repo
        .find_by_cooperative_ids(vec![coop_id])
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("cooperative_id"), "filter missing: {sql}");
    assert!(sql.contains("in ("), "missing IN clause: {sql}");
}

#[tokio::test]
async fn kpi_record_delete_by_submission_issues_delete() {
    let sub_id = Uuid::new_v4();
    let rm = RecordingMock::postgres().exec(3).build();
    let app = rm.app().await;

    let rows = app
        .state
        .kpi_record_repo
        .delete_by_submission(sub_id)
        .await
        .expect("delete ok");

    assert_eq!(rows, 3);
    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
    assert!(sql.contains("submission_id"), "filter missing: {sql}");
}

#[tokio::test]
async fn kpi_record_create_many_empty_short_circuits() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    app.state
        .kpi_record_repo
        .create_many(vec![])
        .await
        .expect("ok");

    assert!(rm.sql().is_empty());
}

// ─── CustomKpiRepository ──────────────────────────────────────────────────────

#[tokio::test]
async fn custom_kpi_find_all_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .custom_kpi_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("custom_kpi"), "must target custom_kpi: {sql}");
}

#[tokio::test]
async fn custom_kpi_update_issues_find_then_update() {
    let id = Uuid::new_v4();
    let before = custom_kpi_row(id, "Old Name");
    let after = custom_kpi_row(id, "New Name");

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    app.state
        .custom_kpi_repo
        .update(
            id,
            "New Name".into(),
            None,
            "A * B".into(),
            Some(serde_json::json!({})),
        )
        .await
        .expect("update ok");

    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2);
    assert!(sqls[0].contains("select"), "first is SELECT: {}", sqls[0]);
    assert!(sqls[1].contains("update"), "second is UPDATE: {}", sqls[1]);
}

#[tokio::test]
async fn custom_kpi_update_not_found_maps_to_error() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .custom_kpi_repo
        .update(Uuid::new_v4(), "New".into(), None, "A".into(), None)
        .await
        .expect_err("should fail");

    assert!(matches!(err, AppError::NotFound(_)));
}

#[tokio::test]
async fn custom_kpi_delete_issues_delete() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .custom_kpi_repo
        .delete(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
}
