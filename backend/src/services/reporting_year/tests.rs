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

mod year_figures {
    use std::collections::HashMap;

    use rust_decimal::Decimal;

    use super::*;
    use crate::entities::balance_sheet_line_item::Model as LineItem;
    use crate::entities::enums::AccountCategory;
    use crate::services::KpiEngine;

    fn item(code: i32, month: i16, value: f64) -> LineItem {
        LineItem {
            id: Uuid::new_v4(),
            financial_statement_id: Uuid::nil(),
            account_code: Some(code),
            account_name: format!("Account {code}"),
            account_category: AccountCategory::Assets,
            account_subcategory: "test".into(),
            month,
            value: Decimal::from_f64_retain(value),
            ai_confidence: None,
            ai_flagged: false,
            manually_edited: false,
            raw_label: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// One quarter: total assets at the end of each month and the month's surplus.
    fn quarter(
        q: &str,
        start: i32,
        months: [i16; 3],
        assets: f64,
        surplus: f64,
    ) -> (submission::Model, Vec<LineItem>) {
        let mut s = approved(2026, PeriodType::Quarterly, q);
        s.fiscal_start_month = start;
        let items = months
            .iter()
            .flat_map(|m| [item(1999, *m, assets), item(6999, *m, surplus)])
            .collect();
        (s, items)
    }

    fn year_of(quarters: Vec<(submission::Model, Vec<LineItem>)>) -> Vec<LineItem> {
        let subs: Vec<submission::Model> = quarters.iter().map(|(s, _)| s.clone()).collect();
        let items: HashMap<Uuid, Vec<LineItem>> =
            quarters.into_iter().map(|(s, i)| (s.id, i)).collect();
        let progress = counted_years(&subs).remove(0);
        let by_id: HashMap<Uuid, submission::Model> = subs.into_iter().map(|s| (s.id, s)).collect();
        year_line_items(&progress, &by_id, &items)
    }

    #[test]
    fn a_quarterly_year_sums_the_surplus_and_keeps_q4_assets() {
        let items = year_of(vec![
            quarter("Q3", 1, [7, 8, 9], 300.0, 3.0),
            quarter("Q1", 1, [1, 2, 3], 100.0, 1.0),
            quarter("Q4", 1, [10, 11, 12], 400.0, 4.0),
            quarter("Q2", 1, [4, 5, 6], 200.0, 2.0),
        ]);

        let kpis = KpiEngine::compute(&items);

        assert_eq!(kpis.total_assets.value, 400.0);
        assert_eq!(kpis.net_surplus.value, 30.0);
        assert!(items.iter().all(|i| i.month == 0));
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn a_year_starting_in_october_keeps_the_september_assets() {
        let items = year_of(vec![
            quarter("Q1", 10, [10, 11, 12], 100.0, 1.0),
            quarter("Q2", 10, [1, 2, 3], 200.0, 2.0),
            quarter("Q3", 10, [4, 5, 6], 300.0, 3.0),
            quarter("Q4", 10, [7, 8, 9], 400.0, 4.0),
        ]);

        let kpis = KpiEngine::compute(&items);

        assert_eq!(kpis.total_assets.value, 400.0);
        assert_eq!(kpis.net_surplus.value, 30.0);
    }

    #[test]
    fn months_outside_a_period_are_left_out() {
        let (mut q1, mut q1_items) = quarter("Q1", 1, [1, 2, 3], 100.0, 1.0);
        q1_items.push(item(6999, 7, 999.0));
        q1.fiscal_start_month = 1;
        let items = year_of(vec![
            (q1, q1_items),
            quarter("Q2", 1, [4, 5, 6], 200.0, 2.0),
            quarter("Q3", 1, [7, 8, 9], 300.0, 3.0),
            quarter("Q4", 1, [10, 11, 12], 400.0, 4.0),
        ]);

        assert_eq!(KpiEngine::compute(&items).net_surplus.value, 30.0);
    }

    #[test]
    fn period_lines_keep_each_month_of_a_quarterly_year() {
        let quarters = vec![
            quarter("Q1", 1, [1, 2, 3], 100.0, 1.0),
            quarter("Q2", 1, [4, 5, 6], 200.0, 2.0),
            quarter("Q3", 1, [7, 8, 9], 300.0, 3.0),
            quarter("Q4", 1, [10, 11, 12], 400.0, 4.0),
        ];
        let subs: Vec<submission::Model> = quarters.iter().map(|(s, _)| s.clone()).collect();
        let items: HashMap<Uuid, Vec<LineItem>> =
            quarters.into_iter().map(|(s, i)| (s.id, i)).collect();
        let progress = counted_years(&subs).remove(0);
        let by_id: HashMap<Uuid, submission::Model> = subs.into_iter().map(|s| (s.id, s)).collect();

        let lines = period_line_items(&progress, &by_id, &items);

        let months: std::collections::BTreeSet<i16> = lines.iter().map(|l| l.month).collect();
        assert_eq!(months, (1..=12).collect());
        assert_eq!(lines.len(), 24);
    }

    #[test]
    fn a_yearly_return_is_used_as_it_is() {
        let yearly = approved(2025, PeriodType::Yearly, "2025");
        let items = vec![item(1999, 0, 500.0), item(6999, 0, 50.0)];
        let progress = counted_years(std::slice::from_ref(&yearly)).remove(0);
        let by_id = HashMap::from([(yearly.id, yearly.clone())]);
        let by_sub = HashMap::from([(yearly.id, items.clone())]);

        assert_eq!(year_line_items(&progress, &by_id, &by_sub), items);
    }
}

mod incomplete_cooperatives {
    use super::*;
    use crate::services::year_figures::incomplete_cooperatives;

    #[test]
    fn counts_cooperatives_whose_year_is_not_complete() {
        let mut other = approved(2026, PeriodType::Quarterly, "Q1");
        other.cooperative_id = Uuid::from_u128(2);
        let subs = vec![
            approved(2025, PeriodType::Yearly, "2025"),
            approved(2026, PeriodType::Yearly, "2026"),
            other,
        ];

        assert_eq!(incomplete_cooperatives(&subs, Some(2026)), 1);
        assert_eq!(incomplete_cooperatives(&subs, Some(2025)), 0);
        assert_eq!(incomplete_cooperatives(&subs, None), 1);
    }
}

mod report_submission {
    use super::*;

    #[test]
    fn a_yearly_return_is_its_own_report_whatever_its_status() {
        let yearly = sub(
            2025,
            PeriodType::Yearly,
            "2025",
            SubmissionStatus::Submitted,
        );

        assert_eq!(
            report_submission(std::slice::from_ref(&yearly), &yearly),
            Ok(yearly.id)
        );
    }

    #[test]
    fn every_quarter_of_a_complete_year_shares_the_q4_report() {
        let quarters: Vec<_> = ["Q1", "Q2", "Q3", "Q4"]
            .iter()
            .map(|q| approved(2026, PeriodType::Quarterly, q))
            .collect();

        assert_eq!(
            report_submission(&quarters, &quarters[1]),
            Ok(quarters[3].id)
        );
    }

    #[test]
    fn a_quarter_of_an_incomplete_year_has_no_report_yet() {
        let quarters = vec![
            approved(2026, PeriodType::Quarterly, "Q1"),
            approved(2026, PeriodType::Quarterly, "Q2"),
        ];

        let pending = report_submission(&quarters, &quarters[0]).unwrap_err();

        assert_eq!(pending.missing, vec!["Q3", "Q4"]);
    }

    #[test]
    fn the_last_quarter_under_review_completes_its_year_for_the_report() {
        let mut quarters: Vec<_> = ["Q1", "Q2", "Q3"]
            .iter()
            .map(|q| approved(2026, PeriodType::Quarterly, q))
            .collect();
        quarters.push(sub(
            2026,
            PeriodType::Quarterly,
            "Q4",
            SubmissionStatus::Submitted,
        ));

        assert_eq!(
            report_submission(&quarters, &quarters[3]),
            Ok(quarters[3].id)
        );
    }
}
