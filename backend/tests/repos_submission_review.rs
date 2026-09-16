mod common;

use common::mock_db::{where_clause, RecordingMock};
use coop_data_backend::entities::enums::{ReviewAction, ReviewTier};
use uuid::Uuid;

fn review_row(
    id: Uuid,
    submission_id: Uuid,
    tier: ReviewTier,
    action: ReviewAction,
) -> coop_data_backend::entities::submission_review::Model {
    coop_data_backend::entities::submission_review::Model {
        id,
        submission_id,
        tier,
        reviewer_id: Some(Uuid::new_v4()),
        action,
        comment: None,
        target_tier: None,
        created_at: chrono::Utc::now(),
    }
}

#[tokio::test]
async fn review_find_by_submission_scopes_to_submission_id() {
    let sub_id = Uuid::new_v4();
    let row = review_row(
        Uuid::new_v4(),
        sub_id,
        ReviewTier::Apex,
        ReviewAction::Approve,
    );

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let results = app
        .state
        .review_repo
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
        "submission_id must be bound: {binds:?}"
    );
}

#[tokio::test]
async fn review_find_by_submission_returns_empty_for_no_rows() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let results = app
        .state
        .review_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect("query ok");

    assert!(results.is_empty());
}

#[tokio::test]
async fn review_find_by_submission_ordered_by_created_at_asc() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let _ = app
        .state
        .review_repo
        .find_by_submission(Uuid::new_v4())
        .await;

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("order by") && sql.contains("created_at") && sql.contains("asc"),
        "must order by created_at ASC for chronological review history: {sql}"
    );
}

#[tokio::test]
async fn review_find_by_submission_for_tier_filters_on_tier_and_action() {
    let sub_id = Uuid::new_v4();
    let row = review_row(
        Uuid::new_v4(),
        sub_id,
        ReviewTier::Federation,
        ReviewAction::Approve,
    );

    let rm = RecordingMock::postgres().query_rows(vec![row]).build();
    let app = rm.app().await;

    let results = app
        .state
        .review_repo
        .find_by_submission_for_tier(sub_id, ReviewTier::Federation)
        .await
        .expect("query ok");

    assert_eq!(results.len(), 1);
    let binds = rm.binds(0);
    assert!(
        binds.contains(&sub_id.to_string()),
        "submission_id bound: {binds:?}"
    );
}
