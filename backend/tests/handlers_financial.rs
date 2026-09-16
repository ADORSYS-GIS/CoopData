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

// ─── Financial Statement handler auth guards ──────────────────────────────────

#[tokio::test]
async fn get_financial_statement_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!(
                    "/api/v1/cooperative/financial-statements/{id}"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_manual_financial_statement_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!(
                    "/api/v1/cooperative/submissions/{id}/manual-financial-statement"
                ))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"accounting_year":"calendar","currency":"SZL","line_items":[]}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_submission_kpis_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/cooperative/submissions/{id}/kpis"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_line_items_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!(
                    "/api/v1/cooperative/financial-statements/{id}/line-items"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── FinancialStatementResponse DTO ──────────────────────────────────────────

#[tokio::test]
async fn financial_statement_response_from_model_maps_fields() {
    use coop_data_backend::api::dto::financial::FinancialStatementResponse;

    let id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let model = common::mock_db::fs_row(id, sub_id, coop_id);
    let resp = FinancialStatementResponse::from(model);

    assert_eq!(resp.id, id);
    assert_eq!(resp.submission_id, sub_id);
    assert_eq!(resp.cooperative_id, coop_id);
    assert_eq!(resp.reporting_year, 2026);
    assert_eq!(resp.currency, "SZL");
    assert_eq!(resp.accounting_year, "calendar");
    assert!(!resp.is_validated);
    assert!(resp.validation_errors.is_none());
}

// ─── AbnormalityFlagResponse DTO ─────────────────────────────────────────────

#[tokio::test]
async fn abnormality_flag_response_from_model_maps_fields() {
    use coop_data_backend::api::dto::upload::AbnormalityFlagResponse;
    use coop_data_backend::entities::abnormality_flag;

    let id = Uuid::new_v4();
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let model = abnormality_flag::Model {
        id,
        submission_id: sub_id,
        cooperative_id: coop_id,
        rule_id: "SUM_CHECK_001".to_string(),
        severity: "error".to_string(),
        message: "Assets do not equal Liabilities + Equity".to_string(),
        field_ref: Some("total_assets".to_string()),
        created_at: chrono::Utc::now(),
    };

    let resp = AbnormalityFlagResponse::from(model);

    assert_eq!(resp.id, id);
    assert_eq!(resp.submission_id, sub_id);
    assert_eq!(resp.rule_id, "SUM_CHECK_001");
    assert_eq!(resp.severity, "error");
    assert_eq!(resp.message, "Assets do not equal Liabilities + Equity");
    assert!(resp.field_ref.is_some());
}
