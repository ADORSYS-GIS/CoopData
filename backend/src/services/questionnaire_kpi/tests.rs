use serde_json::json;

use super::*;

fn inputs(answers: serde_json::Value) -> Inputs {
    Inputs::from_answers(&answers)
}

fn value(list: &[crate::api::dto::basic_dashboard::IndicatorValue], key: &str) -> Option<f64> {
    list.iter().find(|i| i.key == key).and_then(|i| i.value)
}

fn status<'a>(list: &'a [crate::api::dto::basic_dashboard::IndicatorValue], key: &str) -> &'a str {
    &list.iter().find(|i| i.key == key).unwrap().status
}

fn compute(answers: serde_json::Value) -> Vec<crate::api::dto::basic_dashboard::IndicatorValue> {
    let i = inputs(answers);
    build_indicators(&i, &Derived::from_inputs(&i))
}

#[test]
fn age_bands_add_male_and_female() {
    let i = inputs(json!({
        "age_18_25_male": 10, "age_18_25_female": 15,
        "age_61plus_male": 3, "age_61plus_female": 4
    }));
    assert_eq!(i.age_18_25, 25.0);
    assert_eq!(i.age_61_plus, 7.0);
}

#[test]
fn age_band_does_not_add_the_aggregate_to_the_split() {
    let both = inputs(json!({
        "age_18_25_male": 10, "age_18_25_female": 15, "registered_members_18_25": 25
    }));
    assert_eq!(both.age_18_25, 25.0);
}

#[test]
fn only_the_nineteen_core_indicators_are_produced() {
    let keys: Vec<String> = compute(json!({})).into_iter().map(|i| i.key).collect();
    let expected = [
        "active_members_pct",
        "women_members_pct",
        "youth_members_pct",
        "female_active_members_pct",
        "board_women_pct",
        "agm_attendance_pct",
        "meetings_held_count",
        "staff_training_coverage_pct",
        "member_training_coverage_pct",
        "leadership_training_coverage_pct",
        "main_activity_operating_margin_pct",
        "total_operating_margin_pct",
        "member_economic_benefit_ratio_pct",
        "savings_account_penetration_pct",
        "avg_savings_per_depositor",
        "avg_savings_per_depositor_male",
        "avg_savings_per_depositor_female",
        "par_gt_30_pct",
        "delinquent_loan_account_rate_pct",
        "loan_recovery_rate_pct",
        "monetary_reserve_coverage_pct",
    ];
    assert_eq!(keys, expected);
}

#[test]
fn membership_rates_follow_the_questionnaire_definitions() {
    let list = compute(json!({
        "total_registered_male": 60, "total_registered_female": 40,
        "total_active_male": 30, "total_active_female": 20,
        "age_18_25_male": 5, "age_18_25_female": 5, "age_26_35_male": 10, "age_26_35_female": 10
    }));
    assert_eq!(value(&list, "active_members_pct"), Some(50.0));
    assert_eq!(value(&list, "women_members_pct"), Some(40.0));
    assert_eq!(value(&list, "youth_members_pct"), Some(30.0));
    assert_eq!(value(&list, "female_active_members_pct"), Some(40.0));
}

#[test]
fn governance_indicators() {
    let list = compute(json!({
        "total_registered_male": 60, "total_registered_female": 40,
        "board_male": 6, "board_female": 4,
        "agm_attendance_male": 25, "agm_attendance_female": 15,
        "meetings_held_count": 11
    }));
    assert_eq!(value(&list, "board_women_pct"), Some(40.0));
    assert_eq!(value(&list, "agm_attendance_pct"), Some(40.0));
    assert_eq!(value(&list, "meetings_held_count"), Some(11.0));
}

#[test]
fn training_coverage_divides_trained_by_the_right_base() {
    let list = compute(json!({
        "total_registered_male": 60, "total_registered_female": 40,
        "board_male": 6, "board_female": 4,
        "staff_manager_male": 1, "staff_other_support_female": 3,
        "members_trained_last_year": 20, "leaders_trained_last_year": 5, "staff_trained_last_year": 2
    }));
    assert_eq!(value(&list, "member_training_coverage_pct"), Some(20.0));
    assert_eq!(value(&list, "leadership_training_coverage_pct"), Some(50.0));
    assert_eq!(value(&list, "staff_training_coverage_pct"), Some(50.0));
}

#[test]
fn staff_training_is_not_reported_without_the_staff_table() {
    let list = compute(json!({ "staff_trained_last_year": 2 }));
    assert_eq!(value(&list, "staff_training_coverage_pct"), None);
}

#[test]
fn main_activity_margin_total_margin_and_member_benefit() {
    let list = compute(json!({
        "main_activity_1_income": 1000, "main_activity_1_expenses": 600,
        "main_activity_1_distrib_members": 100,
        "current_total_income": 2000, "current_total_expenditure": 1500
    }));
    assert_eq!(
        value(&list, "main_activity_operating_margin_pct"),
        Some(40.0)
    );
    assert_eq!(value(&list, "total_operating_margin_pct"), Some(25.0));
    assert_eq!(status(&list, "total_operating_margin_pct"), "computed");
    assert_eq!(
        value(&list, "member_economic_benefit_ratio_pct"),
        Some(25.0)
    );
}

#[test]
fn total_margin_falls_back_to_activities_and_is_flagged_approximate() {
    let list = compute(json!({
        "main_activity_1_income": 1000, "main_activity_1_expenses": 600,
        "other_activities_income": 500, "other_activities_expenditure": 400
    }));
    assert!((value(&list, "total_operating_margin_pct").unwrap() - 100.0 / 3.0).abs() < 1e-9);
    assert_eq!(status(&list, "total_operating_margin_pct"), "approximate");
}

#[test]
fn member_benefit_ratio_is_not_reported_when_main_activity_runs_a_deficit() {
    let list = compute(json!({
        "main_activity_1_income": 100, "main_activity_1_expenses": 300,
        "main_activity_1_distrib_members": 10
    }));
    assert_eq!(value(&list, "member_economic_benefit_ratio_pct"), None);
}

#[test]
fn savings_penetration_and_average_balance_by_sex() {
    let list = compute(json!({
        "total_registered_male": 60, "total_registered_female": 40,
        "savings_accounts_male": 30, "savings_accounts_female": 20,
        "savings_value_male": 3000, "savings_value_female": 4000
    }));
    assert_eq!(value(&list, "savings_account_penetration_pct"), Some(50.0));
    assert_eq!(value(&list, "avg_savings_per_depositor"), Some(140.0));
    assert_eq!(value(&list, "avg_savings_per_depositor_male"), Some(100.0));
    assert_eq!(
        value(&list, "avg_savings_per_depositor_female"),
        Some(200.0)
    );
}

#[test]
fn par_30_uses_buckets_over_30_days_against_the_outstanding_portfolio() {
    let list = compute(json!({
        "loans_outstanding_value_male": 600, "loans_outstanding_value_female": 400,
        "par_8_30_value": 90,
        "par_31_90_value": 30, "par_91_180_value": 20, "par_181_360_value": 10, "par_over_360_value": 10
    }));
    assert!((value(&list, "par_gt_30_pct").unwrap() - 7.0).abs() < 1e-9);
    assert_eq!(status(&list, "par_gt_30_pct"), "computed");
}

#[test]
fn par_30_is_approximate_from_the_legacy_delinquency_total() {
    let list = compute(json!({
        "loans_outstanding_value_male": 1000, "delinquent_value_31_365": 50
    }));
    assert_eq!(value(&list, "par_gt_30_pct"), Some(5.0));
    assert_eq!(status(&list, "par_gt_30_pct"), "approximate");
}

#[test]
fn delinquent_account_rate_is_account_based() {
    let list = compute(json!({
        "loans_outstanding_accounts_male": 60, "loans_outstanding_accounts_female": 40,
        "loans_delinquent_accounts_male": 6, "loans_delinquent_accounts_female": 4
    }));
    assert_eq!(value(&list, "delinquent_loan_account_rate_pct"), Some(10.0));
}

#[test]
fn recovery_rate_is_not_applicable_when_nothing_was_written_off() {
    let list = compute(json!({ "written_off_loans_value": 200, "recovered_loans_last_12mo": 50 }));
    assert_eq!(value(&list, "loan_recovery_rate_pct"), Some(25.0));
    let none = compute(json!({ "written_off_loans_value": 0, "recovered_loans_last_12mo": 50 }));
    assert_eq!(value(&none, "loan_recovery_rate_pct"), None);
}

#[test]
fn monetary_reserve_coverage_needs_positive_accumulated_reserves() {
    let list = compute(json!({
        "accumulated_book_reserves": 1000, "actual_monetary_reserves_bank": 800
    }));
    assert_eq!(value(&list, "monetary_reserve_coverage_pct"), Some(80.0));
    let zero = compute(json!({
        "accumulated_book_reserves": 0, "actual_monetary_reserves_bank": 800
    }));
    assert_eq!(value(&zero, "monetary_reserve_coverage_pct"), None);
}

#[test]
fn zero_is_reported_but_missing_is_not() {
    let list = compute(json!({
        "total_registered_male": 10, "total_registered_female": 0,
        "total_active_male": 0, "total_active_female": 0
    }));
    assert_eq!(value(&list, "active_members_pct"), Some(0.0));
    assert_eq!(status(&list, "active_members_pct"), "computed");
    assert_eq!(value(&list, "board_women_pct"), None);
    assert_eq!(status(&list, "board_women_pct"), "not_reported");
}

#[test]
fn consolidated_ratio_is_weighted_by_totals_not_averaged() {
    let mut a = inputs(json!({ "loans_outstanding_value_male": 100, "par_31_90_value": 50 }));
    let b = inputs(json!({ "loans_outstanding_value_male": 900, "par_31_90_value": 0 }));
    a.add(&b);
    let list = build_indicators(&a, &Derived::from_inputs(&a));
    assert_eq!(value(&list, "par_gt_30_pct"), Some(5.0));
}

#[test]
fn financial_answers_override_non_financial_ones() {
    let merged = merge_answers(
        Some(&json!({ "current_total_income": 500 })),
        Some(&json!({ "current_total_income": 100, "last_agm_date": "2026-01-01" })),
    );
    assert_eq!(merged["current_total_income"], 500);
    assert_eq!(merged["last_agm_date"], "2026-01-01");
}

#[test]
fn previous_period_gives_point_changes_for_percentages() {
    let mut cur = compute(json!({ "total_registered_male": 100, "total_active_male": 60 }));
    let prev = compute(json!({ "total_registered_male": 100, "total_active_male": 50 }));
    with_previous(&mut cur, &prev);
    let active = cur.iter().find(|i| i.key == "active_members_pct").unwrap();
    assert_eq!(active.previous, Some(50.0));
    assert!((active.change_pct.unwrap() - 10.0).abs() < 1e-9);
}

/// A cooperative answers membership in both questionnaires: the financial one
/// (`registered_members_*`, `active_members_*`) and the non-financial one
/// (`total_registered_*`, `total_active_*`). The same members must not be counted twice.
fn membership_in_both_questionnaires() -> serde_json::Value {
    let financial = json!({
        "registered_members_male": 98, "registered_members_female": 122,
        "active_members_male": 74, "active_members_female": 98,
        "age_18_25_male": 8, "age_18_25_female": 12,
        "age_26_35_male": 20, "age_26_35_female": 28,
        "savings_accounts_male": 70, "savings_accounts_female": 91
    });
    let non_financial = json!({
        "total_registered_male": 98, "total_registered_female": 122,
        "total_active_male": 74, "total_active_female": 98,
        "agm_attendance_male": 61, "agm_attendance_female": 79,
        "members_trained_last_year": 45
    });
    merge_answers(Some(&financial), Some(&non_financial))
}

#[test]
fn members_answered_in_both_questionnaires_are_counted_once() {
    let i = inputs(membership_in_both_questionnaires());
    let d = Derived::from_inputs(&i);

    assert_eq!(d.registered, 220.0);
    assert_eq!(d.active, 172.0);
}

#[test]
fn indicators_per_member_use_the_real_member_count() {
    let list = compute(membership_in_both_questionnaires());

    let pct = |key: &str| (value(&list, key).unwrap() * 100.0).round() / 100.0;
    assert_eq!(pct("youth_members_pct"), 30.91);
    assert_eq!(pct("agm_attendance_pct"), 63.64);
    assert_eq!(pct("member_training_coverage_pct"), 20.45);
    assert_eq!(pct("savings_account_penetration_pct"), 73.18);
    assert_eq!(pct("active_members_pct"), 78.18);
    assert_eq!(pct("women_members_pct"), 55.45);
}

#[test]
fn either_questionnaire_alone_still_gives_the_member_count() {
    let financial_only =
        inputs(json!({ "registered_members_male": 98, "registered_members_female": 122 }));
    let non_financial_only =
        inputs(json!({ "total_registered_male": 98, "total_registered_female": 122 }));

    assert_eq!(Derived::from_inputs(&financial_only).registered, 220.0);
    assert_eq!(Derived::from_inputs(&non_financial_only).registered, 220.0);
}

#[test]
fn a_year_of_quarters_sums_income_and_keeps_year_end_counts() {
    let q1 = json!({"current_total_income": 100.0, "current_total_expenditure": 60.0,
        "registered_members_male": 10, "total_share_capital": 1000.0});
    let q2 = json!({"current_total_income": 150.0, "current_total_expenditure": 70.0,
        "registered_members_male": 12, "total_share_capital": 1100.0});

    let year = merge_period_answers(&[&q1, &q2]);

    assert_eq!(year["current_total_income"], json!(250.0));
    assert_eq!(year["current_total_expenditure"], json!(130.0));
    assert_eq!(year["registered_members_male"], json!(12));
    assert_eq!(year["total_share_capital"], json!(1100.0));
}

#[test]
fn a_year_of_quarters_rolls_the_accounts_grid_forward() {
    let q1 = json!({"coa_revenue": {"4100": {"openingBalance": 0, "annualMovement": 40, "closingBalance": 40}},
        "coa_assets": {"1100": {"openingBalance": 500, "annualMovement": 20, "closingBalance": 520}}});
    let q2 = json!({"coa_revenue": {"4100": {"openingBalance": 40, "annualMovement": 35, "closingBalance": 75}},
        "coa_assets": {"1100": {"openingBalance": 520, "annualMovement": -5, "closingBalance": 515}}});

    let year = merge_period_answers(&[&q1, &q2]);

    assert_eq!(year["coa_revenue"]["4100"]["openingBalance"], json!(0.0));
    assert_eq!(year["coa_revenue"]["4100"]["annualMovement"], json!(75.0));
    assert_eq!(year["coa_revenue"]["4100"]["closingBalance"], json!(75.0));
    assert_eq!(year["coa_assets"]["1100"]["openingBalance"], json!(500.0));
    assert_eq!(year["coa_assets"]["1100"]["closingBalance"], json!(515.0));
}

#[test]
fn a_flow_answered_in_only_some_periods_sums_what_was_given() {
    let q1 = json!({"other_activities_income": 30.0});
    let q2 = json!({"registered_members_male": 5});

    let year = merge_period_answers(&[&q1, &q2]);

    assert_eq!(year["other_activities_income"], json!(30.0));
    assert_eq!(year["registered_members_male"], json!(5));
}

#[test]
fn a_single_period_is_returned_as_is() {
    let only = json!({"current_total_income": "1,200", "note": "x"});

    assert_eq!(merge_period_answers(&[&only]), only);
}
