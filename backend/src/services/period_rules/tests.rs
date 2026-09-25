use chrono::{Duration, Utc};
use uuid::Uuid;

use super::*;
use crate::entities::enums::{ReviewTier, SubmissionCreatedByRole};

fn sub(
    period_type: PeriodType,
    value: &str,
    status: SubmissionStatus,
    method: &str,
    age_days: i64,
) -> submission::Model {
    submission::Model {
        id: Uuid::new_v4(),
        reference: None,
        cooperative_id: Uuid::nil(),
        reporting_year: 2017,
        period_type,
        period_value: value.to_string(),
        fiscal_start_month: 1,
        status,
        current_tier: ReviewTier::Cooperative,
        submitted_by: None,
        submitted_at: None,
        last_reviewed_by: None,
        last_reviewed_at: None,
        rejection_reason: None,
        priority: "Routine".into(),
        metadata: serde_json::json!({}),
        submission_method: method.to_string(),
        created_at: Utc::now() - Duration::days(age_days),
        updated_at: Utc::now(),
        created_by_role: SubmissionCreatedByRole::Cooperative,
        created_by_user_id: None,
        created_by_name: None,
        edited_by: None,
        edited_by_name: None,
        rate_to_usd: None,
        rate_effective_date: None,
        rate_source: None,
    }
}

#[test]
fn frequency_allows_same_frequency() {
    let existing = [sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Approved,
        "questionnaire",
        2,
    )];

    assert!(check_frequency(&existing, PeriodType::Quarterly, None).is_ok());
}

#[test]
fn frequency_rejects_other_frequency_and_tells_to_delete_drafts() {
    let existing = [sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Draft,
        "questionnaire",
        2,
    )];

    let err = check_frequency(&existing, PeriodType::Monthly, None).unwrap_err();

    assert!(err.contains("Delete your draft"));
}

#[test]
fn frequency_rejects_other_frequency_when_not_draft() {
    let existing = [sub(
        PeriodType::Yearly,
        "2017",
        SubmissionStatus::Approved,
        "questionnaire",
        2,
    )];

    let err = check_frequency(&existing, PeriodType::Quarterly, None).unwrap_err();

    assert!(err.contains("Only one reporting frequency"));
}

#[test]
fn frequency_ignores_the_submission_being_changed() {
    let only = sub(
        PeriodType::Yearly,
        "2017",
        SubmissionStatus::Draft,
        "manual",
        1,
    );
    let id = only.id;

    assert!(check_frequency(&[only], PeriodType::Quarterly, Some(id)).is_ok());
}

#[test]
fn method_ignores_drafts() {
    let existing = [sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Draft,
        "manual_grid",
        2,
    )];

    assert!(check_method(&existing, "upload", None).is_ok());
}

#[test]
fn method_rejects_change_after_non_draft_submission() {
    let existing = [sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Approved,
        "upload",
        2,
    )];

    assert!(check_method(&existing, "manual", None).is_err());
    assert!(check_method(&existing, "upload", None).is_ok());
}

#[test]
fn locked_method_prefers_non_draft() {
    let existing = [
        sub(
            PeriodType::Quarterly,
            "Q1",
            SubmissionStatus::Approved,
            "upload",
            5,
        ),
        sub(
            PeriodType::Quarterly,
            "Q2",
            SubmissionStatus::Draft,
            "manual_grid",
            1,
        ),
    ];

    assert_eq!(locked_method(&existing).as_deref(), Some("upload"));
}
