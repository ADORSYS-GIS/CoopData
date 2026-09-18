mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use tower::util::ServiceExt;
use uuid::Uuid;

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// ─── Questionnaire response auth guards ──────────────────────────────────────

#[tokio::test]
async fn get_questionnaire_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{id}/questionnaire"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn save_questionnaire_answers_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{id}/questionnaire"
                ))
                .header("Content-Type", "application/json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── Questionnaire template auth guards (cooperative active template) ─────────

#[tokio::test]
async fn get_active_template_cooperative_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/cooperative/questionnaire-templates/active")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── QuestionnaireRepository: find_by_submission filters on submission_id ────

#[tokio::test]
async fn questionnaire_repo_find_by_submission_issues_select_with_submission_id_filter() {
    use common::mock_db::RecordingMock;
    let sub_id = Uuid::new_v4();

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_repo
        .find_by_submission(sub_id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("submission_id"),
        "must filter by submission_id: {sql}"
    );
    assert!(
        rm.binds(0).contains(&sub_id.to_string()),
        "submission_id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn questionnaire_repo_find_by_submission_and_type_applies_both_filters() {
    use common::mock_db::RecordingMock;
    let sub_id = Uuid::new_v4();

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_repo
        .find_by_submission_and_type(sub_id, "governance")
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("submission_id"),
        "submission_id filter missing: {sql}"
    );
    assert!(
        sql.contains("questionnaire_type"),
        "type filter missing: {sql}"
    );
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"governance".to_string()),
        "type bound: {binds:?}"
    );
}

#[tokio::test]
async fn questionnaire_repo_find_by_cooperative_and_year_filters_correctly() {
    use common::mock_db::RecordingMock;
    let coop_id = Uuid::new_v4();

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_repo
        .find_by_cooperative_and_year(coop_id, 2026)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("cooperative_id"),
        "cooperative_id filter missing: {sql}"
    );
    assert!(
        rm.binds(0).contains(&coop_id.to_string()),
        "coop_id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn questionnaire_repo_empty_approved_subs_returns_empty_without_query() {
    // find_responses_with_filters short-circuits with Ok([]) when there are
    // no approved submissions — the query for responses must never fire.
    use common::mock_db::RecordingMock;

    // First query (approved submissions) returns empty → early return
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .questionnaire_repo
        .find_responses_with_filters(Some(2026), None, None, None, None)
        .await
        .expect("ok");

    assert!(result.is_empty());
    // Only one SELECT was issued (the approved-subs guard), not two
    assert_eq!(
        rm.sql().len(),
        1,
        "should only issue approved-sub guard query: {:?}",
        rm.sql()
    );
}

// ─── QuestionnaireTemplateRepository tests ────────────────────────────────────

#[tokio::test]
async fn questionnaire_template_repo_find_by_id_issues_select() {
    use common::mock_db::RecordingMock;
    let id = Uuid::new_v4();

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_template_repo
        .find_by_id(id)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must issue SELECT: {sql}");
    assert!(
        sql.contains("questionnaire_templates"),
        "must target template table: {sql}"
    );
    assert!(
        rm.binds(0).contains(&id.to_string()),
        "id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn questionnaire_template_repo_find_all_orders_by_updated_at() {
    use common::mock_db::RecordingMock;

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_template_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("updated_at"),
        "must order by updated_at: {sql}"
    );
    assert!(sql.contains("desc"), "must be descending: {sql}");
}

#[tokio::test]
async fn questionnaire_template_repo_find_active_filters_by_type_and_active_flag() {
    use common::mock_db::RecordingMock;

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .questionnaire_template_repo
        .find_active("governance")
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("questionnaire_type"),
        "type filter missing: {sql}"
    );
    assert!(sql.contains("is_active"), "active flag filter missing: {sql}");
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"governance".to_string()),
        "type bound: {binds:?}"
    );
}

#[tokio::test]
async fn questionnaire_template_repo_find_by_id_returns_none_on_empty() {
    use common::mock_db::RecordingMock;

    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let result = app
        .state
        .questionnaire_template_repo
        .find_by_id(Uuid::new_v4())
        .await
        .expect("ok");

    assert!(result.is_none());
}

#[tokio::test]
async fn questionnaire_template_repo_delete_missing_returns_not_found() {
    use common::mock_db::RecordingMock;
    use coop_data_backend::error::AppError;

    // find_by_id returns empty → not found error before DELETE is issued
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .questionnaire_template_repo
        .delete(Uuid::new_v4())
        .await
        .expect_err("must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
}

