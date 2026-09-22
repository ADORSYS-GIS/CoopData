//! Submission workflow state-machine tests.
//!
//! Every transition is exercised against a SeaORM `MockDatabase`, verifying the
//! guard rules (illegal transitions fail **before** any status update is issued)
//! and the tier routing (apex-created submissions return to apex, coop-created
//! to cooperative).
//!
//! # Expectation counting
//! Repos layer find + UPDATE…RETURNING: `update_status` = 2 query pops,
//! `set_edited_by`/`clear_edited_by` = 2 pops, review `create` (INSERT…
//! RETURNING) = 1 pop — and each RETURNING pop must yield exactly one row or
//! sea-orm maps it to a `RecordNotFound`/`RecordNotInserted` error.

mod common;

use common::mock_db::{
    apex_claims, cooperative_claims, federation_claims, ministry_claims, mock_postgres,
    submission_row, MockDbApp,
};

use coop_data_backend::entities::enums::{
    ReviewAction, ReviewTier, SubmissionCreatedByRole, SubmissionStatus,
};
use coop_data_backend::entities::{
    abnormality_flag, financial_statement, submission_review, submission_section,
};
use coop_data_backend::error::AppError;
use coop_data_backend::services::SubmissionWorkflow;
use uuid::Uuid;

fn workflow(app: &MockDbApp) -> SubmissionWorkflow {
    SubmissionWorkflow::new(
        app.state.submission_repo.clone(),
        app.state.review_repo.clone(),
        app.state.flag_repo.clone(),
        app.state.section_repo.clone(),
        app.state.financial_statement_repo.clone(),
        app.state.line_item_repo.clone(),
        app.state.kpi_record_repo.clone(),
        app.state.db.clone(),
    )
}

fn section_row(submission_id: Uuid, section: &str, status: &str) -> submission_section::Model {
    submission_section::Model {
        id: Uuid::new_v4(),
        submission_id,
        section: section.to_string(),
        status: status.to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

fn review_row(submission_id: Uuid) -> submission_review::Model {
    submission_review::Model {
        id: Uuid::new_v4(),
        submission_id,
        tier: ReviewTier::Cooperative,
        reviewer_id: None,
        action: ReviewAction::Comment,
        comment: None,
        target_tier: None,
        created_at: chrono::Utc::now(),
    }
}

fn error_flag(submission_id: Uuid, coop_id: Uuid) -> abnormality_flag::Model {
    abnormality_flag::Model {
        id: Uuid::new_v4(),
        submission_id,
        cooperative_id: coop_id,
        rule_id: "CRIT-001".to_string(),
        severity: "error".to_string(),
        message: "does not balance".to_string(),
        field_ref: Some("1999".to_string()),
        created_at: chrono::Utc::now(),
    }
}

// ─── Submit guards ──────────────────────────────────────────────────────────

#[tokio::test]
async fn submit_fails_when_not_draft() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    // find_by_id returns an already-submitted row → guard trips before any
    // other query (exactly 1 pop).
    let db = mock_postgres().append_query_results(vec![vec![submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    )]]);

    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .submit(sub_id, &cooperative_claims("any"))
        .await
        .expect_err("double submit must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("cannot be submitted"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn submit_fails_when_error_flags_exist() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let db = mock_postgres()
        .append_query_results(vec![vec![submission_row(
            sub_id,
            coop_id,
            SubmissionStatus::Draft,
            ReviewTier::Cooperative,
        )]])
        .append_query_results(vec![vec![error_flag(sub_id, coop_id)]]);

    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .submit(sub_id, &cooperative_claims("any"))
        .await
        .expect_err("error-severity flags must block submission");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("error-severity"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn submit_fails_when_section_not_ready() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    // Pops: find, flags, financial q, non-financial q, sections.
    let db = mock_postgres()
        .append_query_results(vec![vec![submission_row(
            sub_id,
            coop_id,
            SubmissionStatus::Draft,
            ReviewTier::Cooperative,
        )]])
        .append_query_results(vec![Vec::<abnormality_flag::Model>::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![vec![
            section_row(sub_id, "financial", "ready"),
            section_row(sub_id, "members", "pending"),
        ]]);

    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .submit(sub_id, &cooperative_claims("any"))
        .await
        .expect_err("pending section must block submission");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("All sections must be ready"), "got: {msg}");
            assert!(msg.contains("members (pending)"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn submit_fails_when_upload_method_without_financial_statement() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    // Pops: find, flags, financial q, non-financial q, sections, FS lookup
    // (None) → upload method without FS or financial questionnaire → reject.
    let db = mock_postgres()
        .append_query_results(vec![vec![submission_row(
            sub_id,
            coop_id,
            SubmissionStatus::Draft,
            ReviewTier::Cooperative,
        )]])
        .append_query_results(vec![Vec::<abnormality_flag::Model>::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![vec![
            section_row(sub_id, "financial", "ready"),
            section_row(sub_id, "members", "ready"),
        ]])
        .append_query_results(vec![Vec::<financial_statement::Model>::new()]);

    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .submit(sub_id, &cooperative_claims("any"))
        .await
        .expect_err("upload-method submission without FS must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("financial statement"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn submit_fails_when_submission_missing() {
    let db = mock_postgres().append_query_results(vec![Vec::<
        coop_data_backend::entities::submission::Model,
    >::new()]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .submit(Uuid::new_v4(), &cooperative_claims("any"))
        .await
        .expect_err("missing submission must 404");
    assert!(matches!(err, AppError::NotFound(_)));
}

// ─── Submit happy path ──────────────────────────────────────────────────────

#[tokio::test]
async fn submit_happy_path_routes_cooperative_tier_to_apex() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let mut draft = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Draft,
        ReviewTier::Cooperative,
    );
    draft.submission_method = "questionnaire".to_string(); // skips FS check + KPI compute
    let mut submitted = draft.clone();
    submitted.status = SubmissionStatus::Submitted;
    submitted.current_tier = ReviewTier::Apex;

    // Pops: find, flags, fin q, nonfin q, sections,
    //       update_status (find + UPDATE RETURNING),
    //       clear_edited_by (find + UPDATE RETURNING), INSERT review.
    let db = mock_postgres()
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![Vec::<abnormality_flag::Model>::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![Vec::<
            coop_data_backend::entities::questionnaire_response::Model,
        >::new()])
        .append_query_results(vec![vec![
            section_row(sub_id, "financial", "ready"),
            section_row(sub_id, "members", "ready"),
        ]])
        .append_query_results(vec![vec![draft]])
        .append_query_results(vec![vec![submitted.clone()]])
        .append_query_results(vec![vec![submitted.clone()]])
        .append_query_results(vec![vec![submitted]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .submit(sub_id, &cooperative_claims("any"))
        .await
        .expect("questionnaire-method submit must succeed");
}

// ─── Apex tier transitions ──────────────────────────────────────────────────

#[tokio::test]
async fn apex_approve_moves_submitted_to_approved_at_apex() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let submitted = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    );
    let approved = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Approved,
        ReviewTier::Apex,
    );

    // transition: find, update_status (find + UPDATE RETURNING), INSERT review.
    let db = mock_postgres()
        .append_query_results(vec![vec![submitted.clone()]])
        .append_query_results(vec![vec![submitted]])
        .append_query_results(vec![vec![approved]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .apex_approve(sub_id, &apex_claims("any"), Some("ok".into()))
        .await
        .expect("apex approve must succeed");
}

#[tokio::test]
async fn apex_approve_fails_when_not_submitted() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let db = mock_postgres().append_query_results(vec![vec![submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Draft,
        ReviewTier::Cooperative,
    )]]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .apex_approve(sub_id, &apex_claims("any"), None)
        .await
        .expect_err("approving a draft must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("Expected status 'submitted'"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn apex_return_sends_coop_created_submission_back_to_cooperative() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let submitted = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    );
    let mut draft = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Draft,
        ReviewTier::Cooperative,
    );
    draft.created_by_role = SubmissionCreatedByRole::Cooperative;
    let financial = section_row(sub_id, "financial", "ready");
    let mut reset = financial.clone();
    reset.status = "in_progress".to_string();

    // Pops: routing find, transition find, update_status (find + UPDATE),
    // INSERT review, reset SELECT, section UPDATE, clear_edited_by (find + UPDATE).
    let db = mock_postgres()
        .append_query_results(vec![vec![submitted.clone()]])
        .append_query_results(vec![vec![submitted]])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![review_row(sub_id)]])
        .append_query_results(vec![vec![financial]])
        .append_query_results(vec![vec![reset]])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![draft]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .apex_return(sub_id, &apex_claims("any"), Some("fix this".into()))
        .await
        .expect("apex return must succeed");
}

#[tokio::test]
async fn apex_return_sends_apex_created_submission_back_to_apex_tier() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let mut apex_created = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Federation,
    );
    apex_created.created_by_role = SubmissionCreatedByRole::Apex;
    let mut draft = submission_row(sub_id, coop_id, SubmissionStatus::Draft, ReviewTier::Apex);
    draft.created_by_role = SubmissionCreatedByRole::Apex;

    let db = mock_postgres()
        .append_query_results(vec![vec![apex_created.clone()]])
        .append_query_results(vec![vec![apex_created]])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![review_row(sub_id)]])
        .append_query_results(vec![Vec::<submission_section::Model>::new()])
        .append_query_results(vec![vec![draft.clone()]])
        .append_query_results(vec![vec![draft]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .apex_return(sub_id, &apex_claims("any"), None)
        .await
        .expect("apex return of apex-created submission must route back to apex tier");
}

#[tokio::test]
async fn apex_return_fails_when_not_submitted() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    // Pops: apex_return routing find, then transition's own find — both return
    // the same row; the status guard then trips.
    let db = mock_postgres()
        .append_query_results(vec![vec![submission_row(
            sub_id,
            coop_id,
            SubmissionStatus::InReview,
            ReviewTier::Federation,
        )]])
        .append_query_results(vec![vec![submission_row(
            sub_id,
            coop_id,
            SubmissionStatus::InReview,
            ReviewTier::Federation,
        )]]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .apex_return(sub_id, &apex_claims("any"), None)
        .await
        .expect_err("returning an in-review submission at apex tier must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("Expected status 'submitted'"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

// ─── Federation tier transitions ────────────────────────────────────────────

#[tokio::test]
async fn federation_approve_fails_when_not_at_federation_tier() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let db = mock_postgres().append_query_results(vec![vec![submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Apex,
    )]]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .federation_approve(sub_id, &federation_claims("org"), None)
        .await
        .expect_err("federation approve at apex tier must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("not at federation tier"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn federation_approve_moves_in_review_to_ministry() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let in_review = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Federation,
    );
    let at_ministry = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Ministry,
    );

    let db = mock_postgres()
        .append_query_results(vec![vec![in_review.clone()]])
        .append_query_results(vec![vec![in_review]])
        .append_query_results(vec![vec![at_ministry]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .federation_approve(sub_id, &federation_claims("org"), None)
        .await
        .expect("federation approve must succeed");
}

#[tokio::test]
async fn federation_return_moves_back_to_apex_and_sets_editor() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let in_review = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Federation,
    );
    let mut back_at_apex = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    );
    back_at_apex.created_by_user_id = Some(Uuid::new_v4());
    back_at_apex.created_by_name = Some("creator".to_string());

    // Pops: find, update_status (find + UPDATE), explicit find_by_id,
    // set_edited_by (find + UPDATE), INSERT review.
    let db = mock_postgres()
        .append_query_results(vec![vec![in_review.clone()]])
        .append_query_results(vec![vec![in_review]])
        .append_query_results(vec![vec![back_at_apex.clone()]])
        .append_query_results(vec![vec![back_at_apex.clone()]])
        .append_query_results(vec![vec![back_at_apex.clone()]])
        .append_query_results(vec![vec![back_at_apex]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .federation_return(sub_id, &federation_claims("org"), Some("rework".into()))
        .await
        .expect("federation return must succeed");
}

#[tokio::test]
async fn federation_return_fails_when_not_at_federation_tier() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let db = mock_postgres().append_query_results(vec![vec![submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    )]]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .federation_return(sub_id, &federation_claims("org"), None)
        .await
        .expect_err("federation return at apex tier must fail");
    assert!(matches!(err, AppError::BadRequest(_)));
}

// ─── Ministry terminal transitions ──────────────────────────────────────────

#[tokio::test]
async fn ministry_approve_fails_when_not_in_review() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let db = mock_postgres().append_query_results(vec![vec![submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Submitted,
        ReviewTier::Federation,
    )]]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .ministry_approve(sub_id, &ministry_claims(), None)
        .await
        .expect_err("ministry approve of submitted (not in_review) must fail");
    match err {
        AppError::BadRequest(msg) => {
            assert!(msg.contains("Expected status 'in_review'"), "got: {msg}");
        }
        other => panic!("expected BadRequest, got {other:?}"),
    }
}

#[tokio::test]
async fn ministry_approve_terminal() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let in_review = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Ministry,
    );
    let approved = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Approved,
        ReviewTier::Ministry,
    );

    let db = mock_postgres()
        .append_query_results(vec![vec![in_review.clone()]])
        .append_query_results(vec![vec![in_review]])
        .append_query_results(vec![vec![approved]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .ministry_approve(sub_id, &ministry_claims(), Some("final".into()))
        .await
        .expect("ministry approve must succeed");
}

#[tokio::test]
async fn ministry_reject_terminal() {
    let sub_id = Uuid::new_v4();
    let coop_id = Uuid::new_v4();

    let in_review = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::InReview,
        ReviewTier::Ministry,
    );
    let rejected = submission_row(
        sub_id,
        coop_id,
        SubmissionStatus::Rejected,
        ReviewTier::Ministry,
    );

    let db = mock_postgres()
        .append_query_results(vec![vec![in_review.clone()]])
        .append_query_results(vec![vec![in_review]])
        .append_query_results(vec![vec![rejected]])
        .append_query_results(vec![vec![review_row(sub_id)]]);

    let app = MockDbApp::new(db).await;
    workflow(&app)
        .ministry_reject(
            sub_id,
            &ministry_claims(),
            Some("data inconsistency".into()),
        )
        .await
        .expect("ministry reject must succeed");
}

#[tokio::test]
async fn approve_missing_submission_is_not_found() {
    let db = mock_postgres().append_query_results(vec![Vec::<
        coop_data_backend::entities::submission::Model,
    >::new()]);
    let app = MockDbApp::new(db).await;

    let err = workflow(&app)
        .apex_approve(Uuid::new_v4(), &apex_claims("any"), None)
        .await
        .expect_err("missing submission must 404");
    assert!(matches!(err, AppError::NotFound(_)));
}
