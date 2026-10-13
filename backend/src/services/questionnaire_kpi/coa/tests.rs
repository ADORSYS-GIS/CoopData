use serde_json::json;

use super::*;

fn value(list: &[IndicatorValue], key: &str) -> Option<f64> {
    list.iter().find(|i| i.key == key).and_then(|i| i.value)
}

fn status<'a>(list: &'a [IndicatorValue], key: &str) -> &'a str {
    &list.iter().find(|i| i.key == key).unwrap().status
}

fn cell(opening: f64, closing: f64, movement: f64) -> serde_json::Value {
    json!({ "openingBalance": opening, "closingBalance": closing, "annualMovement": movement })
}

#[test]
fn empty_answers_report_every_indicator_as_not_reported() {
    let b = CoaBalances::from_answers(&json!({}));
    assert!(!b.has_any());
    let list = build(&b);
    assert_eq!(list.len(), 15);
    assert!(list.iter().all(|i| i.status == "not_reported" && i.value.is_none()));
}

#[test]
fn current_ratio_and_working_capital() {
    let answers = json!({
        "coa_assets": { "1100": cell(0.0, 5000.0, 0.0), "1600": cell(0.0, 3000.0, 0.0) },
        "coa_liabilities": { "2100": cell(0.0, 4000.0, 0.0) },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    assert_eq!(value(&list, "current_ratio"), Some(2.0));
    assert_eq!(value(&list, "working_capital"), Some(4000.0));
}

#[test]
fn operating_profit_margin_uses_movement_not_balance() {
    let answers = json!({
        "coa_revenue": { "4100": cell(0.0, 0.0, 10000.0) },
        "coa_direct_costs": { "5100": cell(0.0, 0.0, 4000.0) },
        "coa_operating_expenses": { "6100": cell(0.0, 0.0, 2000.0) },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    // (10000 - 4000 - 2000) / 10000 = 40%
    assert_eq!(value(&list, "operating_profit_margin_pct"), Some(40.0));
}

#[test]
fn net_profit_margin_uses_3500_closing_balance() {
    let answers = json!({
        "coa_equity": { "3500": cell(0.0, 2000.0, 0.0) },
        "coa_revenue": { "4100": cell(0.0, 0.0, 10000.0) },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    assert_eq!(value(&list, "net_profit_margin_pct"), Some(20.0));
}

#[test]
fn roa_and_roe_use_average_balances() {
    let answers = json!({
        "coa_equity": {
            "3500": cell(0.0, 500.0, 0.0),
            "3100": cell(2000.0, 4000.0, 0.0)
        },
        "coa_assets": { "1100": cell(8000.0, 12000.0, 0.0) },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    // avg assets = (8000+12000)/2 = 10000; 500/10000 = 5%
    assert_eq!(value(&list, "coa_return_on_assets_pct"), Some(5.0));
    // avg equity = (opening 3100+3500=2000, closing 3100+3500=4500) -> (2000+4500)/2=3250
    // 500 / 3250 * 100 ≈ 15.3846%
    let roe = value(&list, "coa_return_on_equity_pct").unwrap();
    assert!((roe - 15.3846).abs() < 0.01);
}

#[test]
fn debt_to_equity_and_interest_coverage() {
    let answers = json!({
        "coa_liabilities": { "2100": cell(0.0, 3000.0, 0.0) },
        "coa_equity": { "3100": cell(0.0, 1500.0, 0.0) },
        "coa_revenue": { "4100": cell(0.0, 0.0, 10000.0) },
        "coa_direct_costs": { "5100": cell(0.0, 0.0, 4000.0) },
        "coa_operating_expenses": { "6100": cell(0.0, 0.0, 1000.0) },
        "coa_finance_costs": { "7100": cell(0.0, 0.0, 500.0) },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    assert_eq!(value(&list, "debt_to_equity_ratio"), Some(2.0));
    // operating profit = 10000-4000-1000 = 5000; / 500 = 10
    assert_eq!(value(&list, "interest_coverage"), Some(10.0));
}

#[test]
fn cash_flow_kpis_use_the_reported_cash_flow_figures() {
    let answers = json!({
        "coa_assets": {
            "1100": cell(0.0, 600.0, 0.0), "1200": cell(0.0, 400.0, 0.0),
            "1400": cell(1000.0, 3000.0, 0.0)
        },
        "coa_liabilities": { "2100": cell(0.0, 2000.0, 0.0) },
        "coa_finance_costs": { "7100": cell(0.0, 0.0, 500.0) },
        "cf_operating_cash_flow": 3000,
        "cf_principal_repayments": 1500,
        "cf_credit_sales": 10000,
        "cf_cash_operating_expenses": 6000,
        "cf_receivables_over_90": 600
    });
    let list = build(&CoaBalances::from_answers(&answers));
    assert_eq!(value(&list, "operating_cash_flow_ratio"), Some(1.5));
    assert_eq!(value(&list, "dscr"), Some(1.5));
    // (1000 + 3000) / 2 / 10000 * 365
    assert_eq!(value(&list, "days_sales_outstanding"), Some(73.0));
    // 1000 / (6000 / 12)
    assert_eq!(value(&list, "cash_liquidity_coverage"), Some(2.0));
    // 600 / 3000
    assert_eq!(value(&list, "receivables_risk_ratio_pct"), Some(20.0));
    assert_eq!(status(&list, "dscr"), "computed");
}

#[test]
fn cash_flow_kpis_are_not_generated_without_the_cash_flow_section() {
    let answers = json!({
        "coa_assets": { "1100": cell(0.0, 600.0, 0.0), "1400": cell(0.0, 3000.0, 0.0) },
        "coa_liabilities": { "2100": cell(0.0, 2000.0, 0.0) },
        "coa_finance_costs": { "7100": cell(0.0, 0.0, 500.0) },
        "coa_equity": { "3500": cell(0.0, 1000.0, 0.0) },
    });
    let list = build(&CoaBalances::from_answers(&answers));
    for key in [
        "operating_cash_flow_ratio",
        "dscr",
        "days_sales_outstanding",
        "cash_liquidity_coverage",
        "receivables_risk_ratio_pct",
    ] {
        assert_eq!(value(&list, key), None, "{key}");
        assert_eq!(status(&list, key), "not_reported", "{key}");
    }
}

#[test]
fn dscr_needs_both_operating_cash_flow_and_principal_repayments() {
    let answers = json!({
        "coa_finance_costs": { "7100": cell(0.0, 0.0, 500.0) },
        "cf_operating_cash_flow": 3000
    });
    let list = build(&CoaBalances::from_answers(&answers));
    assert_eq!(value(&list, "dscr"), None);
}

#[test]
fn consolidation_sums_balances_before_computing_ratios() {
    let a = CoaBalances::from_answers(&json!({
        "coa_assets": { "1100": cell(0.0, 1000.0, 0.0) },
        "coa_liabilities": { "2100": cell(0.0, 500.0, 0.0) },
    }));
    let c = CoaBalances::from_answers(&json!({
        "coa_assets": { "1100": cell(0.0, 3000.0, 0.0) },
        "coa_liabilities": { "2100": cell(0.0, 500.0, 0.0) },
    }));
    let mut total = CoaBalances::default();
    total.add(&a);
    total.add(&c);
    let list = build(&total);
    // (1000+3000) / (500+500) = 4.0, not the average of the two individual ratios (2.0 and 6.0)
    assert_eq!(value(&list, "current_ratio"), Some(4.0));
}

#[test]
fn activity_concentration_picks_the_largest_single_activity() {
    let answers = json!({
        "coa_revenue": {
            "4100": cell(0.0, 0.0, 7000.0),
            "4200": cell(0.0, 0.0, 2000.0),
            "4600": cell(0.0, 0.0, 1000.0)
        },
    });
    let b = CoaBalances::from_answers(&answers);
    let list = build(&b);
    // operating revenue = 7000+2000+1000=10000; largest activity = 7000 -> 70%
    assert_eq!(value(&list, "activity_concentration_risk_pct"), Some(70.0));
}
