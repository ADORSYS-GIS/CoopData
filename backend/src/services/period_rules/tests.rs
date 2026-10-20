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

#[test]
fn multipurpose_is_forced_to_questionnaire() {
    assert_eq!(
        forced_method_for_type(Some("multipurpose")),
        Some("questionnaire")
    );
    assert_eq!(forced_method_for_type(Some("sacco")), None);
    assert_eq!(forced_method_for_type(None), None);
}

#[test]
fn sacco_cannot_use_questionnaire() {
    assert!(check_method_allowed_for_type(Some("sacco"), "questionnaire").is_err());
    assert!(check_method_allowed_for_type(Some("sacco"), "upload").is_ok());
    assert!(check_method_allowed_for_type(Some("sacco"), "manual").is_ok());
}

#[test]
fn multipurpose_cannot_use_upload_or_manual() {
    assert!(check_method_allowed_for_type(Some("multipurpose"), "upload").is_err());
    assert!(check_method_allowed_for_type(Some("multipurpose"), "manual").is_err());
    assert!(check_method_allowed_for_type(Some("multipurpose"), "questionnaire").is_ok());
}

#[test]
fn unrecognised_type_is_unrestricted() {
    assert!(check_method_allowed_for_type(None, "upload").is_ok());
    assert!(check_method_allowed_for_type(None, "questionnaire").is_ok());
}

#[test]
fn period_months_follow_the_fiscal_start() {
    assert_eq!(period_months(PeriodType::Yearly, "2025", 1), Some(vec![0]));
    assert_eq!(
        period_months(PeriodType::Quarterly, "Q2", 1),
        Some(vec![4, 5, 6])
    );
    assert_eq!(
        period_months(PeriodType::Quarterly, "Q1", 11),
        Some(vec![11, 12, 1])
    );
    assert_eq!(
        period_months(PeriodType::SemiAnnual, "H2", 7),
        Some(vec![1, 2, 3, 4, 5, 6])
    );
    assert_eq!(period_months(PeriodType::Monthly, "03", 7), Some(vec![3]));
    assert_eq!(
        period_months(PeriodType::Monthly, "FULL_YEAR", 4),
        Some(vec![4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3])
    );
    assert_eq!(period_months(PeriodType::Quarterly, "Q5", 1), None);
}

#[test]
fn statement_save_keeps_the_submission_period() {
    let existing = sub(
        PeriodType::Quarterly,
        "Q2",
        SubmissionStatus::Draft,
        "manual",
        0,
    );

    assert!(check_statement_period(&existing, None, None, &[4, 5, 6]).is_ok());
    assert!(check_statement_period(
        &existing,
        Some(PeriodType::Quarterly),
        Some("q2"),
        &[4, 5, 6]
    )
    .is_ok());
}

#[test]
fn statement_save_rejects_another_frequency_or_period() {
    let existing = sub(
        PeriodType::Quarterly,
        "Q2",
        SubmissionStatus::Draft,
        "manual",
        0,
    );

    let other_frequency =
        check_statement_period(&existing, Some(PeriodType::Yearly), Some("2017"), &[0]);
    let other_quarter =
        check_statement_period(&existing, Some(PeriodType::Quarterly), Some("Q3"), &[7]);

    assert!(other_frequency.unwrap_err().contains("Q2 2017"));
    assert!(other_quarter.unwrap_err().contains("Q2 2017"));
}

#[test]
fn statement_save_rejects_months_outside_the_period() {
    let existing = sub(
        PeriodType::Quarterly,
        "Q2",
        SubmissionStatus::Draft,
        "manual",
        0,
    );

    let result = check_statement_period(&existing, None, None, &[4, 5, 6, 7]);

    assert!(result.unwrap_err().contains("Jul"));
}

#[test]
fn full_year_monthly_conflicts_with_single_months() {
    let single_month = [sub(
        PeriodType::Monthly,
        "03",
        SubmissionStatus::Approved,
        "manual",
        1,
    )];
    let full_year = [sub(
        PeriodType::Monthly,
        "FULL_YEAR",
        SubmissionStatus::Draft,
        "manual",
        1,
    )];

    assert!(check_period_overlap(&single_month, PeriodType::Monthly, "FULL_YEAR", None).is_err());
    assert!(check_period_overlap(&full_year, PeriodType::Monthly, "04", None).is_err());
    assert!(check_period_overlap(&single_month, PeriodType::Monthly, "04", None).is_ok());
}

#[test]
fn a_year_keeps_the_start_month_of_its_periods() {
    let mut q1 = sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Approved,
        "manual",
        1,
    );
    q1.fiscal_start_month = 7;
    let existing = [q1];

    assert!(check_fiscal_start(&existing, PeriodType::Quarterly, 7, None).is_ok());
    let err = check_fiscal_start(&existing, PeriodType::Quarterly, 1, None).unwrap_err();
    assert!(err.contains("Jul"), "{err}");
}

#[test]
fn the_start_month_is_free_for_a_new_year_or_a_yearly_return() {
    let mut q1 = sub(
        PeriodType::Quarterly,
        "Q1",
        SubmissionStatus::Draft,
        "manual",
        1,
    );
    q1.fiscal_start_month = 7;

    assert!(check_fiscal_start(&[], PeriodType::Quarterly, 3, None).is_ok());
    assert!(check_fiscal_start(&[q1.clone()], PeriodType::Yearly, 1, None).is_ok());
    assert!(check_fiscal_start(&[q1.clone()], PeriodType::Quarterly, 1, Some(q1.id)).is_ok());
}
