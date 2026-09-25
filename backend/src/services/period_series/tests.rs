use super::*;

fn raw(pairs: &[(i32, f64)]) -> HashMap<i32, f64> {
    pairs.iter().copied().collect()
}

#[test]
fn period_index_parses_each_frequency() {
    assert_eq!(period_index(PeriodType::Quarterly, "q3"), Some(3));
    assert_eq!(period_index(PeriodType::SemiAnnual, "H2"), Some(2));
    assert_eq!(period_index(PeriodType::Monthly, "07"), Some(7));
    assert_eq!(period_index(PeriodType::Monthly, "13"), None);
    assert_eq!(period_index(PeriodType::Yearly, "2026"), Some(0));
}

#[test]
fn select_periods_ends_at_the_chosen_period_and_keeps_the_last_ones() {
    let available = [(2025, 1), (2025, 2), (2025, 3), (2025, 4), (2026, 1)];

    let series = select_periods(&available, Some((2025, Some(3))), 8);

    assert_eq!(series, vec![(2025, 1), (2025, 2), (2025, 3)]);
}

#[test]
fn select_periods_uses_the_latest_period_of_a_year_when_none_is_chosen() {
    let available = [(2025, 1), (2025, 4), (2026, 2)];

    assert_eq!(
        select_periods(&available, Some((2025, None)), 8),
        vec![(2025, 1), (2025, 4)]
    );
}

#[test]
fn select_periods_defaults_to_the_newest_period() {
    let available = [(2024, 0), (2025, 0), (2026, 0)];

    assert_eq!(
        select_periods(&available, None, 2),
        vec![(2025, 0), (2026, 0)]
    );
}

#[test]
fn select_periods_is_empty_without_data() {
    assert!(select_periods(&[], None, 8).is_empty());
}

#[test]
fn labels_follow_the_frequency() {
    assert_eq!(period_label(PeriodType::Yearly, 2026, "2026"), "2026");
    assert_eq!(period_label(PeriodType::Quarterly, 2026, "q2"), "Q2 2026");
    assert_eq!(period_label(PeriodType::Monthly, 2026, "03"), "Mar 2026");
}

#[test]
fn annual_statement_reads_month_zero() {
    let mut by_month = BTreeMap::new();
    by_month.insert(
        0,
        raw(&[(1999, 1000.0), (2999, 700.0), (3999, 300.0), (6999, 40.0)]),
    );

    let totals = statement_totals(&by_month, &[]);

    assert_eq!(totals.assets, 1000.0);
    assert_eq!(totals.net_income, 40.0);
}

#[test]
fn monthly_statement_takes_balances_from_the_last_month_and_sums_income() {
    let mut by_month = BTreeMap::new();
    by_month.insert(1, raw(&[(1999, 900.0), (4999, 10.0), (5999, 4.0)]));
    by_month.insert(2, raw(&[(1999, 1000.0), (4999, 12.0), (5999, 5.0)]));

    let totals = statement_totals(&by_month, &[]);

    assert_eq!(totals.assets, 1000.0);
    assert_eq!(totals.total_income, 22.0);
    assert_eq!(totals.net_income, 13.0);
}

#[test]
fn month_zero_is_ignored_when_months_are_reported() {
    let mut by_month = BTreeMap::new();
    by_month.insert(0, raw(&[(1999, 5.0)]));
    by_month.insert(3, raw(&[(1999, 1000.0)]));

    assert_eq!(statement_totals(&by_month, &[]).assets, 1000.0);
}

#[test]
fn empty_statement_has_zero_totals() {
    assert_eq!(
        statement_totals(&BTreeMap::new(), &[]),
        StatementTotals::default()
    );
}

#[test]
fn statement_totals_reads_loan_quality_capital_and_income_components() {
    let mut by_month = BTreeMap::new();
    by_month.insert(
        0,
        raw(&[
            (1202, 10.0),
            (1203, 20.0),
            (1204, 5.0),
            (1205, 15.0),
            (1250, 8.0),
            (3100, 300.0),
            (3200, 120.0),
            (3300, 60.0),
            (4100, 90.0),
            (5200, 40.0),
        ]),
    );

    let totals = statement_totals(&by_month, &[]);

    assert_eq!(totals.arrears_31_60, 20.0);
    assert_eq!(totals.non_performing, 15.0);
    assert_eq!(totals.provisions, 8.0);
    assert_eq!(totals.share_capital, 300.0);
    assert_eq!(totals.retained_earnings, 60.0);
    assert_eq!(totals.financial_income, 90.0);
    assert_eq!(totals.operating_expenses, 40.0);
}
