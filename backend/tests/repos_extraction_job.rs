mod common;

use common::mock_db::{
    mock_recording_postgres, mock_recording_postgres_failing, where_clause, RecordingMock,
};
use coop_data_backend::error::AppError;
use uuid::Uuid;

fn extraction_job_row(
    id: Uuid,
    submission_id: Uuid,
    status: &str,
) -> coop_data_backend::entities::extraction_job::Model {
    coop_data_backend::entities::extraction_job::Model {
        id,
        submission_id,
        source_file_id: Uuid::new_v4(),
        status: status.to_string(),
        engine: None,
        raw_text: None,
        extracted_json: None,
        confidence: None,
        error_message: None,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
    }
}

#[tokio::test]
async fn extraction_job_find_by_submission_scopes_to_submission_id() {
    let sub_id = Uuid::new_v4();
    let row = extraction_job_row(Uuid::new_v4(), sub_id, "queued");

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let result = app
        .state
        .extraction_job_repo
        .find_by_submission(sub_id)
        .await
        .expect("query ok");

    assert!(result.is_some());
    let sql = &rm.sql()[0];
    let where_ = where_clause(sql);
    assert!(
        where_.contains("submission_id"),
        "must filter by submission_id: {sql}"
    );
    let binds = rm.binds(0);
    assert!(
        binds.contains(&sub_id.to_string()),
        "submission_id bound: {binds:?}"
    );
}

#[tokio::test]
async fn extraction_job_find_by_submission_returns_none_when_no_job() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .extraction_job_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect("query ok");

    assert!(result.is_none());
}

#[tokio::test]
async fn extraction_job_find_by_submission_ids_empty_list_short_circuits() {
    let rm = mock_recording_postgres();
    let app = rm.app().await;

    let results = app
        .state
        .extraction_job_repo
        .find_by_submission_ids(vec![])
        .await
        .expect("empty guard ok");

    assert!(results.is_empty());
    assert!(
        rm.sql().is_empty(),
        "must not hit the DB for an empty list: {:?}",
        rm.sql()
    );
}

#[tokio::test]
async fn extraction_job_update_status_issues_find_then_update() {
    let id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();
    let before = extraction_job_row(id, sub_id, "queued");
    let mut after = before.clone();
    after.status = "processing".to_string();
    after.started_at = Some(chrono::Utc::now());

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .extraction_job_repo
        .update_status(id, "processing", Some(chrono::Utc::now()), None, None)
        .await
        .expect("update ok");

    assert_eq!(updated.status, "processing");
    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2, "find + UPDATE: {sqls:?}");
    assert!(sqls[0].contains("select"), "first is SELECT: {}", sqls[0]);
    assert!(sqls[1].contains("update"), "second is UPDATE: {}", sqls[1]);
    let binds = rm.binds(1);
    assert!(
        binds.contains(&"processing".to_string()),
        "new status bound: {binds:?}"
    );
}

#[tokio::test]
async fn extraction_job_update_status_missing_row_maps_to_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .extraction_job_repo
        .update_status(Uuid::new_v4(), "failed", None, None, Some("error".into()))
        .await
        .expect_err("missing row must be NotFound");

    assert!(
        matches!(err, AppError::NotFound(_)),
        "wrong error type: {err:?}"
    );
}

#[tokio::test]
async fn extraction_job_db_failure_surfaces_as_database_error() {
    let rm = mock_recording_postgres_failing();
    let app = rm.app().await;

    let err = app
        .state
        .extraction_job_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect_err("injected failure must surface");

    assert!(
        matches!(err, AppError::DatabaseError(_)),
        "wrong error type: {err:?}"
    );
}
