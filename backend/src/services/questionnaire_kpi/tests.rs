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
fn zero_is_reported_but_missing_is_not() {
    let list = compute(json!({ "savings_value_male": 0, "savings_value_female": 0 }));
    assert_eq!(value(&list, "total_deposits"), Some(0.0));
    assert_eq!(status(&list, "total_deposits"), "computed");
    assert_eq!(value(&list, "gross_loan_portfolio"), None);
    assert_eq!(status(&list, "gross_loan_portfolio"), "not_reported");
}

#[test]
fn structure_ratios_use_total_assets() {
    let list = compute(json!({
        "non_current_assets": 300, "total_current_assets": 700,
        "savings_value_male": 400, "savings_value_female": 300,
        "total_share_capital": 60, "borrowed_funds_total": 5,
        "outstanding_value_male": 500, "outstanding_value_female": 300,
        "bank_investment": 50, "share_investment": 20, "other_investments": 30
    }));
    assert_eq!(value(&list, "total_assets"), Some(1000.0));
    assert_eq!(value(&list, "member_savings_ratio"), Some(70.0));
    assert_eq!(value(&list, "member_share_ratio"), Some(6.0));
    assert_eq!(value(&list, "borrowed_funds_ratio"), Some(0.5));
    assert_eq!(value(&list, "earning_asset_ratio"), Some(90.0));
}

#[test]
fn par_buckets_produce_exact_ratios() {
    let list = compute(json!({
        "outstanding_value_male": 600, "outstanding_value_female": 400,
        "par_1_7_value": 10, "par_8_30_value": 20, "par_31_90_value": 30,
        "par_91_180_value": 15, "par_181_360_value": 5, "par_over_360_value": 0
    }));
    assert_eq!(value(&list, "par_gt_30_pct"), Some(5.0));
    assert_eq!(value(&list, "par_gt_90_pct"), Some(2.0));
    assert_eq!(value(&list, "par_30_90_pct"), Some(3.0));
    assert_eq!(value(&list, "par_180_360_pct"), Some(0.5));
    assert_eq!(value(&list, "portfolio_at_risk_pct"), Some(8.0));
    assert_eq!(value(&list, "var_gt_7"), Some(70.0));
    assert_eq!(status(&list, "par_gt_30_pct"), "computed");
}

#[test]
fn legacy_delinquency_fields_give_approximate_par_only() {
    let list = compute(json!({
        "outstanding_value_male": 500, "outstanding_value_female": 500,
        "delinquent_value_0_30": 20, "delinquent_value_31_365": 40
    }));
    assert_eq!(value(&list, "par_gt_30_pct"), Some(4.0));
    assert_eq!(status(&list, "par_gt_30_pct"), "approximate");
    assert_eq!(value(&list, "portfolio_at_risk_pct"), Some(6.0));
    assert_eq!(value(&list, "par_gt_90_pct"), None);
    assert_eq!(status(&list, "par_gt_90_pct"), "not_reported");
}

#[test]
fn members_owed_is_not_added_to_reported_loans() {
    let list = compute(json!({
        "outstanding_value_male": 100, "outstanding_value_female": 50,
        "amount_owed_by_members": 999
    }));
    assert_eq!(value(&list, "gross_loan_portfolio"), Some(150.0));
    let only_nf = compute(json!({ "amount_owed_by_members": 80 }));
    assert_eq!(value(&only_nf, "gross_loan_portfolio"), Some(80.0));
    assert_eq!(status(&only_nf, "gross_loan_portfolio"), "approximate");
}

#[test]
fn liquidity_ratio_and_gap_follow_the_regulatory_minimum() {
    let list = compute(json!({
        "cash_on_hand": 10, "cash_at_bank_current": 20, "bank_investment": 30,
        "savings_value_male": 300, "savings_value_female": 100
    }));
    assert_eq!(value(&list, "liquid_assets"), Some(60.0));
    assert_eq!(value(&list, "liquidity_ratio_pct"), Some(15.0));
    assert_eq!(value(&list, "liquidity_gap_pct"), Some(0.0));
    let low = compute(json!({ "bank_investment": 20, "savings_value_male": 400 }));
    assert_eq!(value(&low, "liquidity_gap_pct"), Some(10.0));
}

#[test]
fn institutional_capital_excludes_member_shares() {
    let list = compute(json!({
        "non_current_assets": 400, "total_current_assets": 600,
        "retained_earnings": 40, "accumulated_statutory_reserves": 60,
        "donations_grants": 20, "total_share_capital": 500
    }));
    assert_eq!(value(&list, "institutional_capital"), Some(120.0));
    assert_eq!(value(&list, "institutional_capital_ratio_pct"), Some(12.0));
    assert_eq!(value(&list, "institutional_capital_excess_pct"), Some(4.0));
}

#[test]
fn consolidated_ratio_is_weighted_by_totals_not_averaged() {
    let mut a = inputs(json!({ "outstanding_value_male": 100, "par_31_90_value": 50 }));
    let b = inputs(json!({ "outstanding_value_male": 900, "par_31_90_value": 0 }));
    a.add(&b);
    let list = build_indicators(&a, &Derived::from_inputs(&a));
    assert_eq!(value(&list, "par_gt_30_pct"), Some(5.0));
}

#[test]
fn money_scaling_leaves_ratios_and_counts_unchanged() {
    let mut i = inputs(json!({
        "non_current_assets": 185, "total_current_assets": 185,
        "savings_value_male": 111, "savings_accounts_male": 7
    }));
    i.scale_money(1.0 / 18.5);
    let list = build_indicators(&i, &Derived::from_inputs(&i));
    assert_eq!(value(&list, "total_assets"), Some(20.0));
    assert_eq!(value(&list, "deposit_accounts"), Some(7.0));
    assert_eq!(value(&list, "member_savings_ratio"), Some(30.0));
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
fn previous_period_gives_relative_and_point_changes() {
    let cur = compute(
        json!({ "savings_value_male": 120, "non_current_assets": 300, "total_current_assets": 300 }),
    );
    let prev = compute(
        json!({ "savings_value_male": 100, "non_current_assets": 200, "total_current_assets": 300 }),
    );
    let mut cur = cur;
    with_previous(&mut cur, &prev);
    let deposits = cur.iter().find(|i| i.key == "total_deposits").unwrap();
    assert_eq!(deposits.previous, Some(100.0));
    assert!((deposits.change_pct.unwrap() - 20.0).abs() < 1e-9);
    let ratio = cur
        .iter()
        .find(|i| i.key == "member_savings_ratio")
        .unwrap();
    assert!((ratio.change_pct.unwrap() - (20.0 - 20.0)).abs() < 1e-9);
}

#[test]
fn projected_interest_is_an_estimate_with_method_factor() {
    let flat = compute(json!({
        "outstanding_value_male": 1000, "avg_interest_rate": 2, "avg_loan_term_months": 12
    }));
    assert_eq!(value(&flat, "projected_interest_earnings"), Some(240.0));
    assert_eq!(status(&flat, "projected_interest_earnings"), "approximate");
    let reducing = compute(json!({
        "outstanding_value_male": 1000, "avg_interest_rate": 2, "avg_loan_term_months": 12,
        "interest_rate_method": "Reducing balance"
    }));
    assert_eq!(value(&reducing, "projected_interest_earnings"), Some(120.0));
}

#[test]
fn series_values_only_include_reported_measures() {
    let i = inputs(json!({
        "non_current_assets": 100, "total_current_assets": 100,
        "savings_value_male": 50, "bank_investment": 10
    }));
    let s = series_values(&i, &Derived::from_inputs(&i));
    assert_eq!(s["asset_evolution"]["total_assets"], 200.0);
    assert_eq!(s["liquidity"]["maintained_pct"], 20.0);
    assert!(!s.contains_key("profitability"));
    assert!(!s.contains_key("par_trend"));
}
