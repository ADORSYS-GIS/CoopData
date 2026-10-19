use chrono::Utc;
use uuid::Uuid;

use super::*;
use crate::entities::enums::{ReviewTier, SubmissionCreatedByRole};

fn coop() -> Uuid {
    Uuid::from_u128(1)
}

fn sub(
    year: i32,
    period_type: PeriodType,
    value: &str,
    status: SubmissionStatus,
) -> submission::Model {
    submission::Model {
        id: Uuid::new_v4(),
        reference: None,
        cooperative_id: coop(),
        reporting_year: year,
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
        submission_method: "manual".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        created_by_role: SubmissionCreatedByRole::Cooperative,
        created_by_user_id: None,
        created_by_name: None,
        edited_by: None,
        edited_by_name: None,
    }
}

fn approved(year: i32, period_type: PeriodType, value: &str) -> submission::Model {
    sub(year, period_type, value, SubmissionStatus::Approved)
}

#[test]
fn an_approved_yearly_return_is_a_complete_year() {
    let yearly = approved(2025, PeriodType::Yearly, "2025");

    let progress = year_progress(std::slice::from_ref(&yearly));

    assert_eq!(progress.len(), 1);
    assert!(progress[0].complete);
    assert_eq!(progress[0].approved, vec!["2025"]);
    assert_eq!(progress[0].anchor_id, Some(yearly.id));
}

#[test]
fn a_quarterly_year_needs_all_four_quarters_approved_in_any_order() {
    let q3 = approved(2026, PeriodType::Quarterly, "Q3");
    let q1 = approved(2026, PeriodType::Quarterly, "Q1");
    let q2 = sub(
        2026,
        PeriodType::Quarterly,
        "Q2",
        SubmissionStatus::Submitted,
    );

    let progress = year_progress(&[q3.clone(), q1.clone(), q2]);

    let year = &progress[0];
    assert!(!year.complete);
    assert_eq!(year.expected, vec!["Q1", "Q2", "Q3", "Q4"]);
    assert_eq!(year.approved, vec!["Q1", "Q3"]);
    assert_eq!(year.in_review, vec!["Q2"]);
    assert_eq!(year.missing, vec!["Q4"]);
    assert_eq!(year.anchor_id, None);
}

#[test]
fn four_approved_quarters_make_a_complete_year_anchored_on_q4() {
    let quarters: Vec<_> = ["Q4", "Q2", "Q1", "Q3"]
        .iter()
        .map(|q| approved(2026, PeriodType::Quarterly, q))
        .collect();

    let progress = year_progress(&quarters);

    let year = &progress[0];
    assert!(year.complete);
    assert_eq!(year.anchor_id, Some(quarters[0].id));
    assert_eq!(year.submission_ids.len(), 4);
    assert_eq!(year.submission_ids.last(), Some(&quarters[0].id));
}

#[test]
fn halves_and_months_follow_the_same_rule() {
    let halves = [
        approved(2025, PeriodType::SemiAnnual, "H1"),
        approved(2025, PeriodType::SemiAnnual, "H2"),
    ];
    let eleven_months: Vec<_> = (1..=11)
        .map(|m| approved(2024, PeriodType::Monthly, &format!("{m:02}")))
        .collect();

    assert!(year_progress(&halves)[0].complete);
    let monthly = &year_progress(&eleven_months)[0];
    assert!(!monthly.complete);
    assert_eq!(monthly.missing, vec!["12"]);
}

#[test]
fn a_full_year_monthly_return_is_a_complete_year() {
    let full = approved(2025, PeriodType::Monthly, "FULL_YEAR");

    let year = &year_progress(std::slice::from_ref(&full))[0];

    assert!(year.complete);
    assert_eq!(year.anchor_id, Some(full.id));
}

#[test]
fn rejected_and_draft_periods_do_not_count() {
    let subs = [
        approved(2025, PeriodType::SemiAnnual, "H1"),
        sub(
            2025,
            PeriodType::SemiAnnual,
            "H2",
            SubmissionStatus::Rejected,
        ),
    ];

    let year = &year_progress(&subs)[0];

    assert!(!year.complete);
    assert_eq!(year.missing, vec!["H2"]);
}

#[test]
fn counted_years_keep_only_complete_years() {
    let subs = [
        approved(2024, PeriodType::Yearly, "2024"),
        approved(2025, PeriodType::Quarterly, "Q1"),
        approved(2025, PeriodType::Quarterly, "Q2"),
    ];

    let counted = counted_years(&subs);

    assert_eq!(counted.len(), 1);
    assert_eq!(counted[0].year, 2024);
    assert!(!counted[0].is_multi_period());
}

#[test]
fn counted_submission_ids_list_every_period_of_complete_years() {
    let quarters: Vec<_> = ["Q1", "Q2", "Q3", "Q4"]
        .iter()
        .map(|q| approved(2026, PeriodType::Quarterly, q))
        .collect();
    let incomplete = approved(2027, PeriodType::Quarterly, "Q1");
    let mut subs = quarters.clone();
    subs.push(incomplete.clone());

    let ids = counted_submission_ids(&subs);

    assert_eq!(ids.len(), 4);
    assert!(!ids.contains(&incomplete.id));
}

#[test]
fn years_are_kept_apart_per_cooperative() {
    let mut other = approved(2025, PeriodType::Quarterly, "Q1");
    other.cooperative_id = Uuid::from_u128(2);
    let subs = [approved(2025, PeriodType::Yearly, "2025"), other];

    let progress = year_progress(&subs);

    assert_eq!(progress.len(), 2);
    assert_eq!(progress.iter().filter(|p| p.complete).count(), 1);
}
