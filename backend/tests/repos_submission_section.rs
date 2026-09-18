mod common;

use common::mock_db::{mock_recording_postgres, where_clause, RecordingMock};
use coop_data_backend::error::AppError;
use uuid::Uuid;

fn section_row(
    id: Uuid,
    submission_id: Uuid,
    section: &str,
    status: &str,
) -> coop_data_backend::entities::submission_section::Model {
    coop_data_backend::entities::submission_section::Model {
        id,
        submission_id,
        section: section.to_string(),
        status: status.to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

#[tokio::test]
async fn section_find_by_submission_scopes_to_submission_id() {
    let sub_id = Uuid::new_v4();
    let row = section_row(Uuid::new_v4(), sub_id, "financial", "pending");

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let results = app
        .state
        .section_repo
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
async fn section_find_by_submission_ids_empty_list_short_circuits() {
    let rm = mock_recording_postgres();
    let app = rm.app().await;

    let results = app
        .state
        .section_repo
        .find_by_submission_ids(vec![])
        .await
        .expect("empty guard ok");

    assert!(results.is_empty());
    assert!(
        rm.sql().is_empty(),
        "must not query the DB for an empty list: {:?}",
        rm.sql()
    );
}

#[tokio::test]
async fn section_update_status_issues_find_then_update() {
    let id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();
    let before = section_row(id, sub_id, "financial", "pending");
    let mut after = before.clone();
    after.status = "ready".to_string();

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .section_repo
        .update_status(id, "ready")
        .await
        .expect("update ok");

    assert_eq!(updated.status, "ready");
    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2, "expect find + UPDATE: {sqls:?}");
    assert!(sqls[0].contains("select"), "first is the find: {}", sqls[0]);
    assert!(sqls[1].contains("update"), "second is UPDATE: {}", sqls[1]);
    let binds = rm.binds(1);
    assert!(
        binds.contains(&"ready".to_string()),
        "new status must be bound: {binds:?}"
    );
}

#[tokio::test]
async fn section_update_status_missing_row_maps_to_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .section_repo
        .update_status(Uuid::new_v4(), "ready")
        .await
        .expect_err("missing row must be NotFound");

    assert!(
        matches!(err, AppError::NotFound(_)),
        "wrong error type: {err:?}"
    );
}

#[tokio::test]
async fn section_new_section_models_questionnaire_creates_single_section() {
    use sea_orm::ActiveValue;

    let sub_id = Uuid::new_v4();
    let models = coop_data_backend::repositories::SubmissionSectionRepository::new_section_models(
        sub_id,
        "questionnaire",
    );

    assert_eq!(models.len(), 1, "questionnaire method = one section only");
    if let ActiveValue::Set(ref name) = models[0].section {
        assert_eq!(name, "questionnaire");
    } else {
        panic!("section field should be Set");
    }
}

#[tokio::test]
async fn section_new_section_models_upload_creates_six_sections() {
    use sea_orm::ActiveValue;

    let sub_id = Uuid::new_v4();
    let models = coop_data_backend::repositories::SubmissionSectionRepository::new_section_models(
        sub_id, "upload",
    );

    assert_eq!(models.len(), 6, "upload method = 6 sections");
    let names: Vec<String> = models
        .iter()
        .filter_map(|m| {
            if let ActiveValue::Set(ref s) = m.section {
                Some(s.clone())
            } else {
                None
            }
        })
        .collect();
    assert!(names.contains(&"financial".to_string()));
    assert!(names.contains(&"members".to_string()));
    assert!(names.contains(&"loans".to_string()));
}

#[tokio::test]
async fn section_new_section_models_all_start_as_pending() {
    use sea_orm::ActiveValue;

    let sub_id = Uuid::new_v4();
    let models = coop_data_backend::repositories::SubmissionSectionRepository::new_section_models(
        sub_id, "upload",
    );

    for model in &models {
        if let ActiveValue::Set(ref status) = model.status {
            assert_eq!(status, "pending", "all sections must start as pending");
        }
    }
}
