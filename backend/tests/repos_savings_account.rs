mod common;

use common::mock_db::{savings_row, RecordingMock};
use coop_data_backend::error::AppError;
use uuid::Uuid;

// ─── SavingsAccountRepository ─────────────────────────────────────────────────

#[tokio::test]
async fn savings_find_by_id_issues_select_with_pk() {
    let id = Uuid::new_v4();
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .savings_account_repo
        .find_by_id(id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(
        sql.contains("savings_account"),
        "must target savings table: {sql}"
    );
    assert!(
        rm.binds(0).contains(&id.to_string()),
        "id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn savings_find_by_id_returns_none_on_empty() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .savings_account_repo
        .find_by_id(Uuid::new_v4())
        .await
        .expect("ok");

    assert!(result.is_none());
}

#[tokio::test]
async fn savings_find_by_cooperative_filters_on_cooperative_id() {
    let rm = RecordingMock::postgres().count(0).query_empty().build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();

    app.state
        .savings_account_repo
        .find_by_cooperative_id(coop_id, None, 1, 10)
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("cooperative_id"),
        "coop filter missing: {select_sql}"
    );
    let all_binds: Vec<String> = rm
        .statements()
        .iter()
        .enumerate()
        .flat_map(|(i, _)| rm.binds(i))
        .collect();
    assert!(
        all_binds.contains(&coop_id.to_string()),
        "coop_id bound: {all_binds:?}"
    );
}

#[tokio::test]
async fn savings_find_by_cooperative_with_submission_adds_submission_filter() {
    let rm = RecordingMock::postgres().count(0).query_empty().build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();

    app.state
        .savings_account_repo
        .find_by_cooperative_id(coop_id, Some(sub_id), 1, 10)
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("submission_id"),
        "submission filter missing: {select_sql}"
    );
}

#[tokio::test]
async fn savings_create_unique_violation_maps_to_conflict() {
    let rm = RecordingMock::postgres().fail_insert_unique().build();
    let app = rm.app().await;

    let coop_id = Uuid::new_v4();
    let id = Uuid::new_v4();
    let model = {
        use coop_data_backend::entities::savings_account;
        let row = savings_row(id, coop_id, "SA-001");
        savings_account::ActiveModel::from(row)
    };

    let err = app
        .state
        .savings_account_repo
        .create(model)
        .await
        .expect_err("conflict");

    assert!(matches!(err, AppError::Conflict(_)), "got: {err:?}");
}

#[tokio::test]
async fn savings_delete_issues_delete_by_id() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .savings_account_repo
        .delete(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
    assert!(
        sql.contains("savings_account"),
        "must target savings table: {sql}"
    );
}

#[tokio::test]
async fn savings_delete_by_cooperative_and_submission_filters_both() {
    let rm = RecordingMock::postgres().exec(5).build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();

    let count = app
        .state
        .savings_account_repo
        .delete_by_cooperative_and_submission(coop_id, sub_id)
        .await
        .expect("delete ok");

    assert_eq!(count, 5);
    let sql = &rm.sql()[0];
    assert!(sql.contains("cooperative_id"), "coop filter missing: {sql}");
    assert!(sql.contains("submission_id"), "sub filter missing: {sql}");
}

#[tokio::test]
async fn savings_bulk_upsert_empty_short_circuits() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let count = app
        .state
        .savings_account_repo
        .bulk_upsert(vec![])
        .await
        .expect("short-circuit ok");

    assert_eq!(count, 0);
    assert!(rm.sql().is_empty(), "no DB call for empty upsert");
}

#[tokio::test]
async fn savings_row_roundtrip_via_mock() {
    let id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();
    let row = savings_row(id, coop_id, "SA-ROUND");

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let fetched = app
        .state
        .savings_account_repo
        .find_by_id(id)
        .await
        .expect("ok")
        .expect("row exists");

    assert_eq!(fetched.id, id);
    assert_eq!(fetched.cooperative_id, coop_id);
    assert_eq!(fetched.savings_account_id, "SA-ROUND");
}
