mod common;

use common::mock_db::RecordingMock;
use uuid::Uuid;

// ─── AuditLogRepository ───────────────────────────────────────────────────────

#[tokio::test]
async fn audit_log_find_by_filters_no_filters_issues_select_ordered_by_created_at() {
    // Two queues: COUNT(*) + paginated SELECT
    let rm = RecordingMock::postgres()
        .count(0) // num_items
        .query_empty() // paginated rows
        .build();
    let app = rm.app().await;

    let (rows, total) = app
        .state
        .audit
        .repo()
        .find_by_filters(None, None, None, None, None, None, 1, 10)
        .await
        .expect("query ok");

    assert_eq!(total, 0);
    assert!(rows.is_empty());

    let sqls = rm.sql();
    // At minimum two statements: count + fetch
    assert!(sqls.len() >= 2, "expected count + select: {sqls:?}");
    let count_sql = &sqls[0];
    assert!(
        count_sql.contains("count"),
        "first statement must be COUNT: {count_sql}"
    );
    let select_sql = &sqls[1];
    assert!(
        select_sql.contains("created_at"),
        "order column missing: {select_sql}"
    );
    assert!(
        select_sql.contains("desc"),
        "must be descending: {select_sql}"
    );
}

#[tokio::test]
async fn audit_log_find_by_filters_action_filter_adds_where_clause() {
    let rm = RecordingMock::postgres()
        .count(0)
        .query_empty()
        .build();
    let app = rm.app().await;

    app.state
        .audit
        .repo()
        .find_by_filters(
            Some("login"),
            None,
            None,
            None,
            None,
            None,
            1,
            10,
        )
        .await
        .expect("query ok");

    let sqls = rm.sql();
    // The SELECT must contain an action filter
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("action"),
        "action filter missing: {select_sql}"
    );
    let binds: Vec<String> = rm.statements().iter().flat_map(|s| {
        use sea_orm::sea_query::Value;
        let Some(v) = &s.values else { return vec![] };
        v.0.iter().filter_map(|v| match v {
            Value::String(Some(s)) => Some(s.to_string()),
            _ => None,
        }).collect::<Vec<_>>()
    }).collect();
    assert!(binds.contains(&"login".to_string()), "action bound: {binds:?}");
}

#[tokio::test]
async fn audit_log_find_by_filters_resource_type_filter_binds_type() {
    let rm = RecordingMock::postgres()
        .count(0)
        .query_empty()
        .build();
    let app = rm.app().await;

    app.state
        .audit
        .repo()
        .find_by_filters(
            None,
            Some("cooperative"),
            None,
            None,
            None,
            None,
            1,
            10,
        )
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("resource_type"),
        "resource_type filter missing: {select_sql}"
    );
}

#[tokio::test]
async fn audit_log_find_by_filters_pagination_applies_offset() {
    // page 3, 5 per page → offset = (3-1) * 5 = 10
    let rm = RecordingMock::postgres()
        .count(20)
        .query_empty()
        .build();
    let app = rm.app().await;

    app.state
        .audit
        .repo()
        .find_by_filters(None, None, None, None, None, None, 3, 5)
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let paginated_sql = sqls.iter().find(|s| s.contains("limit") || s.contains("offset")).expect("paginated SQL");
    assert!(
        paginated_sql.contains("limit"),
        "limit clause missing: {paginated_sql}"
    );
    assert!(
        paginated_sql.contains("offset"),
        "offset clause missing: {paginated_sql}"
    );
}

// ─── FarmCoopRepository ──────────────────────────────────────────────────────

#[tokio::test]
async fn farm_coop_find_by_id_issues_select_by_pk() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;
    let id = Uuid::new_v4();

    app.state
        .farm_coop_repo
        .find_by_id(id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("farm_coop"), "must target farm_coop table: {sql}");
    assert!(
        rm.binds(0).contains(&id.to_string()),
        "id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn farm_coop_find_by_id_returns_none_on_empty() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .farm_coop_repo
        .find_by_id(Uuid::new_v4())
        .await
        .expect("ok");

    assert!(result.is_none());
}

#[tokio::test]
async fn farm_coop_find_by_cooperative_id_filters_on_cooperative_id() {
    let rm = RecordingMock::postgres()
        .count(0)
        .query_empty()
        .build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();

    app.state
        .farm_coop_repo
        .find_by_cooperative_id(coop_id, None, 1, 10)
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("cooperative_id"),
        "cooperative_id filter missing: {select_sql}"
    );
    // cooperative_id should appear in binds
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
async fn farm_coop_find_by_cooperative_id_with_submission_adds_submission_filter() {
    let rm = RecordingMock::postgres()
        .count(0)
        .query_empty()
        .build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();

    app.state
        .farm_coop_repo
        .find_by_cooperative_id(coop_id, Some(sub_id), 1, 10)
        .await
        .expect("query ok");

    let sqls = rm.sql();
    let select_sql = sqls.iter().find(|s| s.contains("select")).expect("SELECT");
    assert!(
        select_sql.contains("submission_id"),
        "submission_id filter missing: {select_sql}"
    );
}

#[tokio::test]
async fn farm_coop_delete_issues_delete_by_id() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .farm_coop_repo
        .delete(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
    assert!(sql.contains("farm_coop"), "must target farm_coop table: {sql}");
}

#[tokio::test]
async fn farm_coop_delete_by_cooperative_filters_both_coop_and_submission() {
    let rm = RecordingMock::postgres().exec(3).build();
    let app = rm.app().await;
    let coop_id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();

    let count = app
        .state
        .farm_coop_repo
        .delete_by_cooperative_and_submission(coop_id, sub_id)
        .await
        .expect("delete ok");

    assert_eq!(count, 3);
    let sql = &rm.sql()[0];
    assert!(sql.contains("cooperative_id"), "coop filter missing: {sql}");
    assert!(sql.contains("submission_id"), "sub filter missing: {sql}");
}

#[tokio::test]
async fn farm_coop_bulk_insert_empty_short_circuits() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let count = app
        .state
        .farm_coop_repo
        .bulk_insert(vec![])
        .await
        .expect("short-circuit ok");

    assert_eq!(count, 0);
    assert!(rm.sql().is_empty(), "no DB call for empty insert");
}
