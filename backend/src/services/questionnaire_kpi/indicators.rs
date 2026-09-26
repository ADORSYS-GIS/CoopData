//! Builds the ordered indicator list shown on the Basic Analytics dashboard.

use super::derived::{
    ratio_pct, Derived, INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT,
};
use super::inputs::Inputs;
use crate::api::dto::basic_dashboard::IndicatorValue;

const COMPUTED: &str = "computed";
const APPROXIMATE: &str = "approximate";
const NOT_REPORTED: &str = "not_reported";

struct Spec<'a> {
    group: &'static str,
    unit: &'static str,
    formula: &'static str,
    sources: &'static [&'static str],
    note: Option<&'static str>,
    out: &'a mut Vec<IndicatorValue>,
}

impl Spec<'_> {
    fn push(&mut self, key: &str, value: Option<f64>, approximate: bool) {
        let status = match (value, approximate) {
            (None, _) => NOT_REPORTED,
            (Some(_), true) => APPROXIMATE,
            (Some(_), false) => COMPUTED,
        };
        self.out.push(IndicatorValue {
            key: key.to_string(),
            group: self.group.to_string(),
            value: value.filter(|v| v.is_finite()),
            unit: self.unit.to_string(),
            status: status.to_string(),
            previous: None,
            change_pct: None,
            formula: self.formula.to_string(),
            sources: self.sources.iter().map(|s| s.to_string()).collect(),
            note: self.note.map(str::to_string),
        });
    }
}

// One call per indicator row; a struct would only restate the same nine fields.
#[allow(clippy::too_many_arguments)]
fn add(
    out: &mut Vec<IndicatorValue>,
    group: &'static str,
    unit: &'static str,
    key: &str,
    value: Option<f64>,
    approximate: bool,
    formula: &'static str,
    sources: &'static [&'static str],
    note: Option<&'static str>,
) {
    Spec {
        group,
        unit,
        formula,
        sources,
        note,
        out,
    }
    .push(key, value, approximate);
}

fn only_if(cond: bool, v: Option<f64>) -> Option<f64> {
    if cond {
        v
    } else {
        None
    }
}

pub fn build(i: &Inputs, d: &Derived) -> Vec<IndicatorValue> {
    let mut o: Vec<IndicatorValue> = Vec::with_capacity(70);
    let have_members = i.has_any(&["reg_m", "reg_f"]);
    let registered = have_members.then_some(d.registered);
    let exact = d.buckets_exact;
    let note_buckets = Some("Needs the overdue-days buckets in the Loan Quality section.");

    // ── membership ──
    add(
        &mut o,
        "membership",
        "count",
        "registered_members",
        registered,
        false,
        "Registered members male + female",
        &["registered_members_male", "registered_members_female"],
        None,
    );
    add(
        &mut o,
        "membership",
        "count",
        "active_members",
        i.has_any(&["act_m", "act_f"]).then_some(d.active),
        false,
        "Active members male + female",
        &["active_members_male", "active_members_female"],
        None,
    );
    let inactive = (have_members && i.has_any(&["act_m", "act_f"]))
        .then_some((d.registered - d.active).max(0.0));
    add(
        &mut o,
        "membership",
        "count",
        "inactive_members",
        inactive,
        false,
        "Registered - active members",
        &["registered_members_*", "active_members_*"],
        None,
    );
    add(
        &mut o,
        "membership",
        "percent",
        "active_members_pct",
        only_if(have_members, ratio_pct(Some(d.active), Some(d.registered))),
        false,
        "Active / registered x 100",
        &["active_members_*", "registered_members_*"],
        None,
    );
    add(
        &mut o,
        "membership",
        "percent",
        "women_members_pct",
        only_if(have_members, ratio_pct(Some(i.reg_f), Some(d.registered))),
        false,
        "Female registered / registered x 100",
        &["registered_members_female"],
        None,
    );
    let youth = i
        .has_any(&["age_18_25", "age_26_35"])
        .then_some(i.age_18_25 + i.age_26_35);
    add(
        &mut o,
        "membership",
        "percent",
        "youth_members_pct",
        ratio_pct(youth, registered),
        false,
        "Members aged 18-35 / registered x 100",
        &["age_18_25_*", "age_26_35_*"],
        None,
    );
    add(
        &mut o,
        "membership",
        "count",
        "number_of_groups",
        i.has("groups").then_some(i.groups),
        false,
        "Number of member groups",
        &["number_of_groups"],
        None,
    );

    // ── savings ──
    add(
        &mut o,
        "savings",
        "currency",
        "total_deposits",
        d.deposits,
        false,
        "Net savings value male + female",
        &["savings_value_male", "savings_value_female"],
        None,
    );
    add(
        &mut o,
        "savings",
        "count",
        "deposit_accounts",
        d.deposit_accounts,
        false,
        "Savings accounts male + female",
        &["savings_accounts_male", "savings_accounts_female"],
        None,
    );
    let avg_savings = d
        .deposits
        .zip(d.deposit_accounts)
        .and_then(|(v, n)| (n > 0.0).then_some(v / n));
    add(
        &mut o,
        "savings",
        "currency",
        "avg_savings_per_account",
        avg_savings,
        false,
        "Total deposits / deposit accounts",
        &["savings_value_*", "savings_accounts_*"],
        None,
    );

    // ── loans ──
    add(
        &mut o,
        "loans",
        "currency",
        "gross_loan_portfolio",
        d.gross_loans,
        !i.has_any(&["out_val_m", "out_val_f"]),
        "Outstanding loans male + female",
        &["outstanding_value_male", "outstanding_value_female"],
        None,
    );
    add(
        &mut o,
        "loans",
        "count",
        "loans_outstanding_count",
        d.loans_out_count,
        !d.loans_out_count_exact,
        "Number of loans outstanding",
        &["loans_outstanding_count", "loans_issued_*"],
        Some("Falls back to loan accounts issued when the outstanding count is not entered."),
    );
    let avg_loan = d
        .gross_loans
        .zip(d.loans_out_count)
        .and_then(|(v, n)| (n > 0.0).then_some(v / n));
    add(
        &mut o,
        "loans",
        "currency",
        "avg_loan_balance",
        avg_loan,
        !d.loans_out_count_exact,
        "Gross loan portfolio / loans outstanding",
        &["outstanding_value_*", "loans_outstanding_count"],
        None,
    );
    add(
        &mut o,
        "loans",
        "currency",
        "total_disbursed_active",
        i.has("total_disbursed").then_some(i.total_disbursed),
        false,
        "Total disbursed on active loans",
        &["total_disbursed_active"],
        None,
    );
    add(
        &mut o,
        "loans",
        "count",
        "loans_awaiting_approval",
        i.has("loans_awaiting").then_some(i.loans_awaiting),
        false,
        "Loans awaiting approval",
        &["loans_awaiting_approval"],
        None,
    );
    add(
        &mut o,
        "loans",
        "count",
        "loans_in_arrears_count",
        i.has("loans_arrears_count")
            .then_some(i.loans_arrears_count),
        false,
        "Number of loans in arrears",
        &["loans_in_arrears_count"],
        None,
    );
    add(
        &mut o,
        "loans",
        "currency",
        "projected_interest_earnings",
        d.projected_interest,
        true,
        "Gross loans x monthly rate x average term (halved for reducing balance)",
        &[
            "avg_interest_rate",
            "avg_loan_term_months",
            "interest_rate_method",
        ],
        Some("Estimate only; actual earnings depend on repayment schedules."),
    );
    let female_pct = if i.has("female_borrowers") {
        ratio_pct(Some(i.female_borrowers), d.loans_out_count)
    } else {
        ratio_pct(Some(i.loan_acc_f), Some(i.loan_acc_m + i.loan_acc_f))
            .filter(|_| i.has_any(&["loan_acc_m", "loan_acc_f"]))
    };
    add(
        &mut o,
        "loans",
        "percent",
        "female_borrowers_pct",
        female_pct,
        !i.has("female_borrowers"),
        "Female borrowers / loans outstanding x 100",
        &["female_borrowers_count", "loans_issued_female"],
        None,
    );
    add(
        &mut o,
        "loans",
        "currency",
        "total_overdrafts",
        i.has("overdrafts").then_some(i.overdrafts),
        false,
        "Total overdrafts",
        &["total_overdrafts"],
        None,
    );

    // ── risk ──
    let par = |amount: Option<f64>| d.par_pct(amount);
    add(
        &mut o,
        "risk",
        "percent",
        "par_gt_7_pct",
        par(only_if(exact, d.overdue_gt_7)),
        false,
        "Balance overdue > 7 days / gross loans x 100",
        &[
            "par_8_30_value",
            "par_31_90_value",
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
        ],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "percent",
        "par_gt_30_pct",
        par(d.overdue_gt_30),
        !exact,
        "Balance overdue > 30 days / gross loans x 100",
        &[
            "par_31_90_value",
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
            "delinquent_value_31_365",
        ],
        Some("Falls back to the 31-365 day delinquency field when the buckets are empty."),
    );
    add(
        &mut o,
        "risk",
        "percent",
        "par_gt_90_pct",
        par(only_if(exact, d.overdue_gt_90)),
        false,
        "Balance overdue > 90 days / gross loans x 100",
        &[
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
        ],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "percent",
        "par_30_90_pct",
        par(only_if(exact, d.overdue_30_90)),
        false,
        "Balance overdue 31-90 days / gross loans x 100",
        &["par_31_90_value"],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "percent",
        "par_180_360_pct",
        par(only_if(exact, d.overdue_180_360)),
        false,
        "Balance overdue 181-360 days / gross loans x 100",
        &["par_181_360_value"],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "percent",
        "portfolio_at_risk_pct",
        par(d.overdue_total),
        !exact,
        "All overdue balance / gross loans x 100",
        &[
            "par_1_7_value",
            "par_8_30_value",
            "delinquent_value_0_30",
            "delinquent_value_31_365",
        ],
        None,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "value_at_risk",
        d.overdue_total,
        !exact,
        "Balance of all overdue loans",
        &["par_*_value", "delinquent_value_*"],
        None,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "var_gt_7",
        only_if(exact, d.overdue_gt_7),
        false,
        "Balance overdue > 7 days",
        &[
            "par_8_30_value",
            "par_31_90_value",
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
        ],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "var_gt_30",
        d.overdue_gt_30,
        !exact,
        "Balance overdue > 30 days",
        &[
            "par_31_90_value",
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
            "delinquent_value_31_365",
        ],
        None,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "var_gt_90",
        only_if(exact, d.overdue_gt_90),
        false,
        "Balance overdue > 90 days",
        &[
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
        ],
        note_buckets,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "interest_in_suspense",
        i.has("interest_suspense").then_some(i.interest_suspense),
        false,
        "Interest in suspense",
        &["interest_in_suspense"],
        None,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "interest_payable",
        i.has("interest_payable").then_some(i.interest_payable),
        false,
        "Interest payable",
        &["interest_payable"],
        None,
    );
    add(
        &mut o,
        "risk",
        "currency",
        "written_off_loans",
        i.has("written_off").then_some(i.written_off),
        false,
        "Written-off loans",
        &["written_off_loans"],
        None,
    );

    // ── liquidity ──
    let liq = d.liquidity_ratio_pct();
    add(
        &mut o,
        "liquidity",
        "currency",
        "liquid_assets",
        d.liquid_assets,
        false,
        "Cash on hand + cash at bank + money in bank",
        &["cash_on_hand", "cash_at_bank_current", "bank_investment"],
        None,
    );
    add(
        &mut o,
        "liquidity",
        "percent",
        "liquidity_ratio_pct",
        liq,
        false,
        "Liquid assets / member savings x 100",
        &[
            "cash_on_hand",
            "cash_at_bank_current",
            "bank_investment",
            "savings_value_*",
        ],
        None,
    );
    add(
        &mut o,
        "liquidity",
        "percent",
        "liquidity_minimum_pct",
        Some(LIQUIDITY_MINIMUM_PCT),
        false,
        "Regulatory minimum liquidity to member savings",
        &[],
        Some("Regulatory constant."),
    );
    add(
        &mut o,
        "liquidity",
        "percent",
        "liquidity_gap_pct",
        liq.map(|v| LIQUIDITY_MINIMUM_PCT - v),
        false,
        "Minimum - maintained liquidity (positive = shortfall)",
        &[],
        None,
    );

    // ── structure ──
    add(
        &mut o,
        "structure",
        "currency",
        "total_assets",
        d.total_assets,
        false,
        "Non-current assets + total current assets",
        &["non_current_assets", "total_current_assets"],
        None,
    );
    add(
        &mut o,
        "structure",
        "percent",
        "earning_asset_ratio",
        ratio_pct(d.earning_assets, d.total_assets),
        false,
        "(Loans + investments) / total assets x 100",
        &[
            "outstanding_value_*",
            "bank_investment",
            "share_investment",
            "other_investments",
        ],
        None,
    );
    add(
        &mut o,
        "structure",
        "percent",
        "member_savings_ratio",
        ratio_pct(d.deposits, d.total_assets),
        false,
        "Member savings / total assets x 100",
        &["savings_value_*"],
        None,
    );
    add(
        &mut o,
        "structure",
        "percent",
        "member_share_ratio",
        ratio_pct(
            i.has("share_capital").then_some(i.share_capital),
            d.total_assets,
        ),
        false,
        "Member share capital / total assets x 100",
        &["total_share_capital"],
        None,
    );
    add(
        &mut o,
        "structure",
        "percent",
        "borrowed_funds_ratio",
        ratio_pct(i.has("borrowed").then_some(i.borrowed), d.total_assets),
        false,
        "Borrowed funds / total assets x 100",
        &["borrowed_funds_total"],
        None,
    );
    add(
        &mut o,
        "structure",
        "percent",
        "loans_to_savings_ratio",
        ratio_pct(d.gross_loans, d.deposits),
        false,
        "Gross loans / member savings x 100",
        &["outstanding_value_*", "savings_value_*"],
        None,
    );

    // ── capital ──
    let cap_ratio = d.institutional_capital_ratio_pct();
    add(
        &mut o,
        "capital",
        "currency",
        "institutional_capital",
        d.institutional_capital,
        false,
        "Retained earnings + statutory reserves + donations",
        &[
            "retained_earnings",
            "accumulated_statutory_reserves",
            "donations_grants",
        ],
        Some("Excludes member share capital."),
    );
    add(
        &mut o,
        "capital",
        "percent",
        "institutional_capital_ratio_pct",
        cap_ratio,
        false,
        "Institutional capital / total assets x 100",
        &[
            "retained_earnings",
            "accumulated_statutory_reserves",
            "donations_grants",
            "non_current_assets",
            "total_current_assets",
        ],
        None,
    );
    add(
        &mut o,
        "capital",
        "percent",
        "institutional_capital_minimum_pct",
        Some(INSTITUTIONAL_CAPITAL_MINIMUM_PCT),
        false,
        "Regulatory minimum institutional capital to assets",
        &[],
        Some("Regulatory constant."),
    );
    add(
        &mut o,
        "capital",
        "percent",
        "institutional_capital_excess_pct",
        cap_ratio.map(|v| v - INSTITUTIONAL_CAPITAL_MINIMUM_PCT),
        false,
        "Ratio - minimum (negative = deficiency)",
        &[],
        None,
    );
    add(
        &mut o,
        "capital",
        "currency",
        "total_equity",
        d.total_equity,
        !i.has("total_equity"),
        "Total equity",
        &["total_equity"],
        Some("Derived as assets - liabilities when not entered."),
    );
    add(
        &mut o,
        "capital",
        "currency",
        "share_capital",
        i.has("share_capital").then_some(i.share_capital),
        false,
        "Total share capital",
        &["total_share_capital"],
        None,
    );
    add(
        &mut o,
        "capital",
        "currency",
        "retained_earnings",
        i.has("retained_earnings").then_some(i.retained_earnings),
        false,
        "Retained earnings",
        &["retained_earnings"],
        None,
    );
    add(
        &mut o,
        "capital",
        "currency",
        "statutory_reserves",
        i.has("statutory_reserves").then_some(i.statutory_reserves),
        false,
        "Accumulated statutory reserves",
        &["accumulated_statutory_reserves"],
        None,
    );

    // ── profitability ──
    add(
        &mut o,
        "profitability",
        "currency",
        "total_income",
        i.has("income").then_some(i.income),
        false,
        "Current year total income",
        &["current_total_income"],
        None,
    );
    add(
        &mut o,
        "profitability",
        "currency",
        "total_expenditure",
        i.has("expenditure").then_some(i.expenditure),
        false,
        "Current year total expenditure",
        &["current_total_expenditure"],
        None,
    );
    add(
        &mut o,
        "profitability",
        "currency",
        "net_income",
        d.net_income,
        false,
        "Net income (or income - expenditure)",
        &[
            "current_net_income",
            "current_total_income",
            "current_total_expenditure",
        ],
        None,
    );
    add(
        &mut o,
        "profitability",
        "percent",
        "return_on_assets_pct",
        ratio_pct(d.net_income, d.total_assets),
        false,
        "Net income / total assets x 100",
        &[
            "current_net_income",
            "non_current_assets",
            "total_current_assets",
        ],
        None,
    );
    add(
        &mut o,
        "profitability",
        "percent",
        "operating_expense_ratio_pct",
        ratio_pct(
            i.has("expenditure").then_some(i.expenditure),
            i.has("income").then_some(i.income),
        ),
        false,
        "Expenditure / income x 100",
        &["current_total_expenditure", "current_total_income"],
        None,
    );

    // ── governance ──
    let women = |f: f64, m: f64, k: &[&'static str]| -> Option<f64> {
        i.has_any(k)
            .then(|| ratio_pct(Some(f), Some(f + m)))
            .flatten()
    };
    add(
        &mut o,
        "governance",
        "percent",
        "board_women_pct",
        women(i.board_f, i.board_m, &["board_m", "board_f"]),
        false,
        "Female board members / board",
        &["board_male", "board_female"],
        None,
    );
    add(
        &mut o,
        "governance",
        "percent",
        "executive_women_pct",
        women(i.exec_f, i.exec_m, &["exec_m", "exec_f"]),
        false,
        "Female executive members / executive",
        &["exec_male", "exec_female"],
        None,
    );
    add(
        &mut o,
        "governance",
        "percent",
        "credit_committee_women_pct",
        women(i.credit_f, i.credit_m, &["credit_m", "credit_f"]),
        false,
        "Female credit committee members / committee",
        &["credit_committee_male", "credit_committee_female"],
        None,
    );
    let agm = i.has_any(&["agm_m", "agm_f"]).then_some(i.agm_m + i.agm_f);
    add(
        &mut o,
        "governance",
        "percent",
        "agm_attendance_pct",
        ratio_pct(agm, i.has_any(&["act_m", "act_f"]).then_some(d.active)),
        false,
        "Last AGM attendance / active members x 100",
        &["agm_attendance_male", "agm_attendance_female"],
        None,
    );
    o
}

/// Fills `previous` and `change_pct` from another period's indicators.
/// `change_pct` is the relative change for counts and currency, and the point
/// difference for percentages.
pub fn with_previous(current: &mut [IndicatorValue], previous: &[IndicatorValue]) {
    for c in current.iter_mut() {
        let Some(p) = previous.iter().find(|p| p.key == c.key) else {
            continue;
        };
        let (Some(cv), Some(pv)) = (c.value, p.value) else {
            continue;
        };
        c.previous = Some(pv);
        c.change_pct = match c.unit.as_str() {
            "percent" | "ratio" => Some(cv - pv),
            _ => (pv.abs() > f64::EPSILON).then_some((cv - pv) / pv.abs() * 100.0),
        };
    }
}
