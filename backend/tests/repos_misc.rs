mod common;

use common::mock_db::RecordingMock;
use coop_data_backend::entities::ministry_report_narratives;
use coop_data_backend::repositories::AssessmentRepository;
use uuid::Uuid;

fn narrative_row(year: i32) -> ministry_report_narratives::Model {
    ministry_report_narratives::Model {
        reporting_year: year,
        narratives_json: serde_json::json!({}),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

// ─── AssessmentRepository ──────────────────────────────────────────────────────

#[tokio::test]
async fn assessment_find_by_id_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let repo = AssessmentRepository::new(rm.db.clone());

    repo.find_by_id(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("select"), "must SELECT: {sql}");
    assert!(sql.contains("assessment"), "must target table: {sql}");
}

#[tokio::test]
async fn assessment_find_by_organization_filters_by_org_id() {
    let rm = RecordingMock::postgres().query_empty().build();
    let repo = AssessmentRepository::new(rm.db.clone());

    repo.find_by_organization(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("organization_id"), "must filter org_id");
}

// ─── ChartOfAccountsRepository ────────────────────────────────────────────────

#[tokio::test]
async fn chart_of_accounts_find_all_issues_select_ordered() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .coa_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("order by"),
        "must order by display_order: {sql}"
    );
    assert!(sql.contains("chart_of_accounts"), "must target table: {sql}");
}

#[tokio::test]
async fn chart_of_accounts_find_by_code_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .coa_repo
        .find_by_code(1000)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("account_code"), "must filter by code: {sql}");
}

#[tokio::test]
async fn chart_of_accounts_find_with_formula_filters_not_null() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .coa_repo
        .find_with_formula()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("is not null"),
        "must filter non-null formula: {sql}"
    );
}

// ─── AccountAliasRepository ───────────────────────────────────────────────────

#[tokio::test]
async fn account_alias_find_all_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .account_alias_repo
        .find_all()
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("account_alias"), "must target table: {sql}");
}

// ─── AbnormalityFlagRepository ────────────────────────────────────────────────

#[tokio::test]
async fn flag_find_by_submission_issues_select() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .flag_repo
        .find_by_submission(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("submission_id"), "must filter by submission: {sql}");
}

#[tokio::test]
async fn flag_find_errors_by_submission_filters_severity() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .flag_repo
        .find_errors_by_submission(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("severity"), "must filter severity: {sql}");
    assert!(rm.binds(0).contains(&"error".to_string()));
}

#[tokio::test]
async fn flag_delete_by_submission_issues_delete() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .flag_repo
        .delete_by_submission(Uuid::new_v4())
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("delete"), "must DELETE: {sql}");
}

#[tokio::test]
async fn flag_bulk_create_empty_short_circuits() {
    use coop_data_backend::entities::abnormality_flag::ActiveModel;

    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    app.state
        .flag_repo
        .bulk_create(Vec::<ActiveModel>::new())
        .await
        .expect("bulk create ok");

    assert!(rm.sql().is_empty());
}

// ─── MinistryReportNarrativesRepository ───────────────────────────────────────

#[tokio::test]
async fn narrative_upsert_inserts_if_missing() {
    let rm = RecordingMock::postgres()
        .query_empty()
        .query_rows(vec![narrative_row(2024)])
        .build();
    let app = rm.app().await;

    app.state
        .ministry_narratives_repo
        .upsert_narratives(2024, serde_json::json!({}))
        .await
        .expect("upsert ok");

    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2);
    assert!(sqls[0].contains("select"), "first check existing");
    assert!(sqls[1].contains("insert"), "then insert: {}", sqls[1]);
}

#[tokio::test]
async fn narrative_upsert_updates_if_exists() {
    let existing = narrative_row(2024);
    let updated = narrative_row(2024);

    let rm = RecordingMock::postgres()
        .query_rows(vec![existing])
        .query_rows(vec![updated])
        .build();
    let app = rm.app().await;

    app.state
        .ministry_narratives_repo
        .upsert_narratives(2024, serde_json::json!({}))
        .await
        .expect("upsert ok");

    let sqls = rm.sql();
    assert_eq!(sqls.len(), 2);
    assert!(sqls[0].contains("select"), "first check existing");
    assert!(sqls[1].contains("update"), "then update: {}", sqls[1]);
}
