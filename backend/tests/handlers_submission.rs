mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::dto::submission::{
    CreateSubmissionRequest, SubmissionPeriodRequest, SubmissionResponse, SubmissionSectionResponse,
};
use coop_data_backend::api::routes::api::create_app;
use coop_data_backend::entities::enums::{PeriodType, ReviewTier, SubmissionCreatedByRole, SubmissionStatus};
use tower::util::ServiceExt;
use uuid::Uuid;

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// ─── Auth guard tests: endpoints that require a valid bearer token ───────────

#[tokio::test]
async fn create_submission_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/cooperative/submissions")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"reporting_year":2026,"period_type":"yearly","submission_method":"upload","fiscal_start_month":1,"priority":"normal"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_cooperative_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/cooperative/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_cooperative_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/cooperative/submissions/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn submit_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/cooperative/submissions/{id}/submit"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn update_section_status_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/v1/cooperative/submissions/{id}/sections/financial"))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"status":"ready"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn apex_submit_submission_no_auth_returns_401() {
    let id = Uuid::new_v4();
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/apex/submissions/{id}/submit"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_apex_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/apex/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_federation_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/federation/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_ministry_submissions_no_auth_returns_401() {
    let response = app()
        .await
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/ministry/submissions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── SubmissionResponse DTO conversion ──────────────────────────────────────

#[tokio::test]
async fn submission_response_from_model_maps_all_required_fields() {
    use coop_data_backend::entities::enums::PeriodType;

    let id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let model = common::mock_db::submission_row(id, coop_id, SubmissionStatus::Draft, ReviewTier::Cooperative);

    let resp = SubmissionResponse::from(model);

    assert_eq!(resp.id, id);
    assert_eq!(resp.cooperative_id, coop_id);
    assert_eq!(resp.reporting_year, 2026);
    // DTO uses String for status/tier/period_type (for API serialization)
    assert_eq!(resp.status, SubmissionStatus::Draft.as_str());
    assert_eq!(resp.current_tier, ReviewTier::Cooperative.as_str());
    assert_eq!(resp.period_type, PeriodType::Yearly.as_str());
    assert!(resp.financial_statement_id.is_none());
    assert!(resp.extraction_job_id.is_none());
}

#[tokio::test]
async fn submission_response_with_fs_sets_financial_ids() {
    let id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();
    let model = common::mock_db::submission_row(id, coop_id, SubmissionStatus::Draft, ReviewTier::Cooperative);

    let fs_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();

    let resp = SubmissionResponse::from(model).with_fs(Some(fs_id), Some(job_id), Some(file_id));

    assert_eq!(resp.financial_statement_id, Some(fs_id));
    assert_eq!(resp.extraction_job_id, Some(job_id));
    // DTO uses file_id field name
    assert_eq!(resp.file_id, Some(file_id));
}

#[tokio::test]
async fn submission_response_with_sections_adds_sections() {
    let id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();
    let model = common::mock_db::submission_row(id, coop_id, SubmissionStatus::Draft, ReviewTier::Cooperative);

    let section = coop_data_backend::entities::submission_section::Model {
        id: Uuid::new_v4(),
        submission_id: id,
        section: "financial".to_string(),
        status: "pending".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let section_resp = SubmissionSectionResponse::from(section);
    let resp = SubmissionResponse::from(model).with_sections(vec![section_resp]);

    assert_eq!(resp.sections.len(), 1);
    assert_eq!(resp.sections[0].section, "financial");
    assert_eq!(resp.sections[0].status, "pending");
}

// ─── CreateSubmissionRequest validation ──────────────────────────────────────

#[tokio::test]
async fn create_submission_request_validate_period_yearly_accepts_annual() {
    let req = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: None, // defaults to yearly
        period_value: None,
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    assert!(
        req.validate_period().is_ok(),
        "yearly with no period_value should be valid"
    );
}

#[tokio::test]
async fn create_submission_request_validate_period_quarterly_requires_q_value() {
    let req_valid = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: Some("quarterly".to_string()),
        period_value: Some("Q1".to_string()),
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    let req_invalid = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: Some("quarterly".to_string()),
        period_value: Some("INVALID".to_string()),
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    assert!(req_valid.validate_period().is_ok());
    assert!(
        req_invalid.validate_period().is_err(),
        "non-Q1..Q4 quarterly value should fail"
    );
}

#[tokio::test]
async fn create_submission_request_validate_period_monthly_requires_valid_month() {
    let req_valid = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: Some("monthly".to_string()),
        period_value: Some("06".to_string()),
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    let req_invalid = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: Some("monthly".to_string()),
        period_value: Some("13".to_string()),
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    assert!(req_valid.validate_period().is_ok());
    assert!(
        req_invalid.validate_period().is_err(),
        "13 is not a valid month (only 01–12)"
    );
}

#[tokio::test]
async fn create_submission_request_resolved_period_yearly_uses_year() {
    let req = CreateSubmissionRequest {
        id: None,
        reporting_year: 2026,
        period_type: Some("yearly".to_string()),
        period_value: None,
        submission_method: "upload".to_string(),
        fiscal_start_month: 1,
        priority: "normal".to_string(),
    };

    let (period_type, period_value) = req.resolved_period();
    assert_eq!(period_type, PeriodType::Yearly);
    assert_eq!(period_value, "2026");
}

// ─── SubmissionSectionResponse DTO ──────────────────────────────────────────

#[tokio::test]
async fn section_response_from_model_maps_fields() {
    let sub_id = Uuid::new_v4();
    let section_id = Uuid::new_v4();

    let model = coop_data_backend::entities::submission_section::Model {
        id: section_id,
        submission_id: sub_id,
        section: "members".to_string(),
        status: "ready".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let resp = SubmissionSectionResponse::from(model);

    assert_eq!(resp.id, section_id);
    assert_eq!(resp.submission_id, sub_id);
    assert_eq!(resp.section, "members");
    assert_eq!(resp.status, "ready");
}

// ─── SubmissionCreatedByRole enum ────────────────────────────────────────────

#[tokio::test]
async fn submission_created_by_role_serde_roundtrip() {
    let role = SubmissionCreatedByRole::Apex;
    let serialized = serde_json::to_string(&role).unwrap();
    let deserialized: SubmissionCreatedByRole = serde_json::from_str(&serialized).unwrap();
    assert_eq!(role, deserialized);
}

#[tokio::test]
async fn submission_status_as_str_matches_db_values() {
    assert_eq!(SubmissionStatus::Draft.as_str(), "draft");
    assert_eq!(SubmissionStatus::Submitted.as_str(), "submitted");
    assert_eq!(SubmissionStatus::Approved.as_str(), "approved");
    assert_eq!(SubmissionStatus::Rejected.as_str(), "rejected");
}
