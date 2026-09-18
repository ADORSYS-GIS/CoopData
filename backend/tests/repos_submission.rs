mod common;

use common::mock_db::{
    mock_recording_postgres, mock_recording_postgres_failing, where_clause, RecordingMock,
};
use coop_data_backend::entities::enums::{PeriodType, ReviewTier, SubmissionStatus};
use coop_data_backend::error::AppError;
use uuid::Uuid;

#[tokio::test]
async fn find_by_id_for_cooperatives_filters_by_cooperative_in_sql() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let scope = [Uuid::new_v4(), Uuid::new_v4()];
    let _ = app
        .state
        .submission_repo
        .find_by_id_for_cooperatives(Uuid::new_v4(), &scope)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("\"submissions\""),
        "queries submissions: {}",
        sql
    );
    let where_ = where_clause(sql);
    assert!(
        where_.contains("cooperative_id") && where_.contains(" in ("),
        "tenant scope must be cooperative_id IN (...): {}",
        sql
    );
    assert!(where_.contains("\"id\""), "must still select by id");
}

#[tokio::test]
async fn find_by_id_for_cooperatives_empty_scope_never_queries() {
    let rm = mock_recording_postgres();
    let app = rm.app().await;

    let result = app
        .state
        .submission_repo
        .find_by_id_for_cooperatives(Uuid::new_v4(), &[])
        .await
        .expect("guard short-circuits");

    assert!(result.is_none());
    assert!(
        rm.sql().is_empty(),
        "guard must avoid the DB entirely: {:?}",
        rm.sql()
    );
}

#[tokio::test]
async fn find_by_status_approved_includes_submitted() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .submission_repo
        .find_by_status(SubmissionStatus::Approved)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"approved".to_string()),
        "approved bound: {:?}",
        binds
    );
    assert!(
        binds.contains(&"submitted".to_string()),
        "approved must ALSO include submitted rows (the .or case): {:?}",
        binds
    );
    assert!(
        sql.contains(" or "),
        "must be an OR of both statuses: {}",
        sql
    );
}

#[tokio::test]
async fn find_by_status_draft_queries_only_draft() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .submission_repo
        .find_by_status(SubmissionStatus::Draft)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"draft".to_string()),
        "draft bound: {:?}",
        binds
    );
    assert_eq!(binds.len(), 1, "exactly one status: {:?}", binds);
    assert!(
        !sql.contains(" or "),
        "no special case for other statuses: {}",
        sql
    );
}

#[tokio::test]
async fn find_by_cooperative_ids_empty_list_never_queries() {
    let rm = mock_recording_postgres();
    let app = rm.app().await;

    let rows = app
        .state
        .submission_repo
        .find_by_cooperative_ids(vec![])
        .await
        .expect("empty list short-circuits");

    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn find_by_cooperative_ids_and_tier_empty_list_never_queries() {
    let rm = mock_recording_postgres();
    let app = rm.app().await;

    let rows = app
        .state
        .submission_repo
        .find_by_cooperative_ids_and_tier(vec![], ReviewTier::Apex)
        .await
        .expect("empty list short-circuits");

    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn find_by_cooperative_and_period_has_all_four_filters() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let coop = Uuid::new_v4();
    let found = app
        .state
        .submission_repo
        .find_by_cooperative_and_period(coop, 2026, PeriodType::Quarterly, "Q1")
        .await
        .expect("query ok");

    assert!(found.is_none(), "empty reply decodes to None");
    let sql = &rm.sql()[0];
    assert!(
        sql.contains("cooperative_id"),
        "tenant filter missing: {}",
        sql
    );
    assert!(
        sql.contains("reporting_year"),
        "year filter missing: {}",
        sql
    );
    assert!(
        sql.contains("period_type"),
        "period-type filter missing: {}",
        sql
    );
    assert!(
        sql.contains("period_value"),
        "period-value filter missing: {}",
        sql
    );
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"Q1".to_string()),
        "period_value bound: {:?}",
        binds
    );
    assert!(
        binds.contains(&coop.to_string()),
        "coop id bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn count_by_reporting_year_decodes_count() {
    let rm = RecordingMock::postgres().count(42).build();
    let app = rm.app().await;

    let count = app
        .state
        .submission_repo
        .count_by_reporting_year(2026)
        .await
        .expect("count ok");

    assert_eq!(count, 42);
    assert!(
        rm.sql()[0].contains("count"),
        "is a COUNT query: {}",
        rm.sql()[0]
    );
}

#[tokio::test]
async fn update_status_persists_status_and_tier() {
    let id = Uuid::new_v4();
    let coop = Uuid::new_v4();
    let before =
        common::mock_db::submission_row(id, coop, SubmissionStatus::Draft, ReviewTier::Cooperative);
    let mut after = before.clone();
    after.status = SubmissionStatus::Submitted;
    after.current_tier = ReviewTier::Apex;

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .submission_repo
        .update_status(id, SubmissionStatus::Submitted, ReviewTier::Apex)
        .await
        .expect("update ok");

    assert_eq!(updated.status, SubmissionStatus::Submitted);
    assert_eq!(updated.current_tier, ReviewTier::Apex);

    let sql = rm.sql();
    assert_eq!(sql.len(), 2, "find + UPDATE…RETURNING: {:?}", sql);
    assert!(sql[0].contains("select"), "first is the find: {}", sql[0]);
    assert!(
        sql[1].contains("update"),
        "second is the UPDATE: {}",
        sql[1]
    );
    assert!(
        sql[1].contains("returning"),
        "Postgres RETURNING: {}",
        sql[1]
    );
    let binds = rm.binds(1);
    assert!(
        binds.contains(&"submitted".to_string()),
        "new status bound: {:?}",
        binds
    );
    assert!(
        binds.contains(&"apex".to_string()),
        "new tier bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn update_status_missing_row_maps_to_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .submission_repo
        .update_status(
            Uuid::new_v4(),
            SubmissionStatus::Submitted,
            ReviewTier::Apex,
        )
        .await
        .expect_err("missing row must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
    assert_eq!(
        rm.sql().len(),
        1,
        "stops after the failed find: {:?}",
        rm.sql()
    );
}

#[tokio::test]
async fn claim_edited_by_zero_rows_returns_none_and_guards_on_null_editor() {
    let rm = RecordingMock::postgres().exec(0).build();
    let app = rm.app().await;

    let claimed = app
        .state
        .submission_repo
        .claim_edited_by(Uuid::new_v4(), Uuid::new_v4(), Some("reviewer".into()))
        .await
        .expect("claim ok");

    assert!(claimed.is_none(), "0 rows affected = already claimed");
    let sql = rm.sql();
    assert_eq!(
        sql.len(),
        1,
        "no follow-up SELECT when claim fails: {:?}",
        sql
    );
    assert!(
        sql[0].contains("edited_by is null"),
        "claim must guard on edited_by IS NULL: {}",
        sql[0]
    );
}

#[tokio::test]
async fn claim_edited_by_success_binds_reviewer_and_returns_submission() {
    let id = Uuid::new_v4();
    let coop = Uuid::new_v4();
    let claimed =
        common::mock_db::submission_row(id, coop, SubmissionStatus::Draft, ReviewTier::Cooperative);

    let rm = RecordingMock::postgres()
        .exec(1)
        .query_rows(vec![claimed])
        .build();
    let app = rm.app().await;

    let reviewer = Uuid::new_v4();
    let result = app
        .state
        .submission_repo
        .claim_edited_by(id, reviewer, Some("reviewer".into()))
        .await
        .expect("claim ok");

    assert!(result.is_some(), "1 row affected = claim succeeded");
    let binds = rm.binds(0);
    assert!(
        binds.contains(&reviewer.to_string()),
        "reviewer id bound: {:?}",
        binds
    );
    assert!(
        binds.contains(&"reviewer".to_string()),
        "reviewer name bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn clear_edited_by_is_find_plus_update() {
    let id = Uuid::new_v4();
    let coop = Uuid::new_v4();
    let mut before =
        common::mock_db::submission_row(id, coop, SubmissionStatus::Submitted, ReviewTier::Apex);
    before.edited_by = Some(Uuid::new_v4());
    before.edited_by_name = Some("someone".to_string());
    let mut after = before.clone();
    after.edited_by = None;
    after.edited_by_name = None;

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let result = app
        .state
        .submission_repo
        .clear_edited_by(id)
        .await
        .expect("clear ok");

    assert!(result.edited_by.is_none());
    assert_eq!(rm.sql().len(), 2, "find + UPDATE…RETURNING: {:?}", rm.sql());
}

#[tokio::test]
async fn update_metadata_binds_merged_json() {
    let id = Uuid::new_v4();
    let coop = Uuid::new_v4();
    let mut before =
        common::mock_db::submission_row(id, coop, SubmissionStatus::Draft, ReviewTier::Cooperative);
    before.metadata = serde_json::json!({ "keep_me": 1, "overwrite_me": "old" });
    let after = before.clone();

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let _ = app
        .state
        .submission_repo
        .update_metadata(
            id,
            serde_json::json!({ "overwrite_me": "new", "added": true }),
        )
        .await
        .expect("update ok");

    let binds = rm.binds(1);
    let merged = binds
        .iter()
        .find(|b| b.contains("keep_me"))
        .unwrap_or_else(|| panic!("merged metadata must be bound: {:?}", binds));
    assert!(merged.contains("\"keep_me\":1"), "kept key: {}", merged);
    assert!(
        merged.contains("\"overwrite_me\":\"new\""),
        "overwritten: {}",
        merged
    );
    assert!(merged.contains("\"added\":true"), "added key: {}", merged);
}

#[tokio::test]
async fn update_metadata_missing_row_maps_to_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .submission_repo
        .update_metadata(Uuid::new_v4(), serde_json::json!({}))
        .await
        .expect_err("missing row must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
}

#[tokio::test]
async fn db_failure_maps_to_database_error() {
    let rm = mock_recording_postgres_failing();
    let app = rm.app().await;

    let err = app
        .state
        .submission_repo
        .find_by_cooperative(Uuid::new_v4())
        .await
        .expect_err("injected failure must surface");

    assert!(matches!(err, AppError::DatabaseError(_)));
}

#[tokio::test]
async fn find_by_cooperative_orders_newest_first() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .submission_repo
        .find_by_cooperative(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("order by") && sql.contains("created_at") && sql.contains("desc"),
        "newest-first ordering missing: {}",
        sql
    );
}
