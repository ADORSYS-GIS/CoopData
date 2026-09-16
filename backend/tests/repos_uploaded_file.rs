mod common;

use common::mock_db::{mock_recording_postgres_failing, where_clause, RecordingMock};
use coop_data_backend::error::AppError;
use uuid::Uuid;

fn uploaded_file_row(
    id: Uuid,
    submission_id: Uuid,
) -> coop_data_backend::entities::uploaded_file::Model {
    coop_data_backend::entities::uploaded_file::Model {
        id,
        submission_id,
        original_name: "financial_statement.png".to_string(),
        mime_type: Some("image/png".to_string()),
        storage_key: format!("uploads/{id}.png"),
        size_bytes: Some(204800),
        uploaded_by: Some(Uuid::new_v4()),
        created_at: chrono::Utc::now(),
    }
}

#[tokio::test]
async fn uploaded_file_find_by_submission_scopes_to_submission_id() {
    let sub_id = Uuid::new_v4();
    let row = uploaded_file_row(Uuid::new_v4(), sub_id);

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let results = app
        .state
        .uploaded_file_repo
        .find_by_submission(sub_id)
        .await
        .expect("query ok");

    assert_eq!(results.len(), 1);
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
async fn uploaded_file_find_by_submission_id_delegates_to_find_by_submission() {
    let sub_id = Uuid::new_v4();
    let row = uploaded_file_row(Uuid::new_v4(), sub_id);

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let results = app
        .state
        .uploaded_file_repo
        .find_by_submission_id(sub_id)
        .await
        .expect("query ok");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].submission_id, sub_id);
}

#[tokio::test]
async fn uploaded_file_find_by_submission_returns_empty_when_no_files() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let results = app
        .state
        .uploaded_file_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect("query ok");

    assert!(results.is_empty());
}

#[tokio::test]
async fn uploaded_file_find_by_id_returns_row() {
    let id = Uuid::new_v4();
    let row = uploaded_file_row(id, Uuid::new_v4());

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let result = app
        .state
        .uploaded_file_repo
        .find_by_id(id)
        .await
        .expect("query ok");

    assert!(result.is_some());
    assert_eq!(result.unwrap().id, id);
}

#[tokio::test]
async fn uploaded_file_find_by_id_returns_none_when_missing() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .uploaded_file_repo
        .find_by_id(Uuid::new_v4())
        .await
        .expect("query ok");

    assert!(result.is_none());
}

#[tokio::test]
async fn uploaded_file_db_failure_surfaces_as_database_error() {
    let rm = mock_recording_postgres_failing();
    let app = rm.app().await;

    let err = app
        .state
        .uploaded_file_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect_err("injected failure must surface");

    assert!(
        matches!(err, AppError::DatabaseError(_)),
        "wrong error type: {err:?}"
    );
}
