//! Builds the ordered indicator list shown on the Basic Analytics dashboard.

use super::derived::{ratio_pct, Derived};
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
    let mut o: Vec<IndicatorValue> = Vec::with_capacity(24);
    let have_members = i.has_any(&["reg_m", "reg_f"]);
    let registered = have_members.then_some(d.registered);
    let exact = d.buckets_exact;
    let ratio_unless_zero = |n: Option<f64>, base: Option<f64>| -> Option<f64> {
        base.filter(|b| *b > 0.0)
            .and_then(|b| n.map(|v| v / b * 100.0))
    };

    // ── A. membership and inclusion (indicators 01-04) ──
    add(
        &mut o,
        "membership",
        "percent",
        "active_members_pct",
        only_if(
            have_members && i.has_any(&["act_m", "act_f"]),
            ratio_pct(Some(d.active), Some(d.registered)),
        ),
        false,
        "Active members / registered members x 100",
        &[
            "total_active_male",
            "total_active_female",
            "total_registered_male",
            "total_registered_female",
        ],
        None,
    );
    add(
        &mut o,
        "membership",
        "percent",
        "women_members_pct",
        only_if(have_members, ratio_pct(Some(i.reg_f), Some(d.registered))),
        false,
        "Female registered members / registered members x 100",
        &["total_registered_male", "total_registered_female"],
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
        "Members aged 18-35 (18-25 + 26-35, both sexes) / registered members x 100",
        &[
            "age_18_25_male",
            "age_18_25_female",
            "age_26_35_male",
            "age_26_35_female",
        ],
        None,
    );
    add(
        &mut o,
        "membership",
        "percent",
        "female_active_members_pct",
        only_if(
            i.has_any(&["act_m", "act_f"]),
            ratio_pct(Some(i.act_f), Some(d.active)),
        ),
        false,
        "Female active members / active members x 100",
        &["total_active_male", "total_active_female"],
        None,
    );

    // ── B. democratic governance (indicators 05-07) ──
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
        "Female board / management committee members / all members x 100",
        &["board_male", "board_female"],
        None,
    );
    let agm = i.has_any(&["agm_m", "agm_f"]).then_some(i.agm_m + i.agm_f);
    add(
        &mut o,
        "governance",
        "percent",
        "agm_attendance_pct",
        ratio_pct(agm, registered),
        false,
        "Members who attended the last AGM / registered members x 100",
        &["agm_attendance_male", "agm_attendance_female"],
        None,
    );
    add(
        &mut o,
        "governance",
        "count",
        "meetings_held_count",
        i.has("meetings_held").then_some(i.meetings_held),
        false,
        "Actual number of management committee meetings held in the last 12 months",
        &["meetings_held_count"],
        Some(
            "The selected meeting-frequency category is not treated as proof meetings took place.",
        ),
    );

    // ── C. training coverage (indicators 08-10) ──
    let staff_base = i
        .has_any(&["staff_total_m", "staff_total_f"])
        .then_some(i.staff_total_m + i.staff_total_f);
    add(
        &mut o,
        "training",
        "percent",
        "staff_training_coverage_pct",
        ratio_unless_zero(
            i.has("staff_trained").then_some(i.staff_trained),
            staff_base,
        ),
        false,
        "Staff trained last year / total staff x 100",
        &[
            "staff_trained_last_year",
            "staff_manager_male",
            "staff_manager_female",
        ],
        Some("Total staff comes from the staff table (Q16)."),
    );
    add(
        &mut o,
        "training",
        "percent",
        "member_training_coverage_pct",
        ratio_unless_zero(
            i.has("members_trained").then_some(i.members_trained),
            registered,
        ),
        false,
        "Members trained last year / registered members x 100",
        &[
            "members_trained_last_year",
            "total_registered_male",
            "total_registered_female",
        ],
        None,
    );
    let leaders_base = i
        .has_any(&["board_m", "board_f"])
        .then_some(i.board_m + i.board_f);
    add(
        &mut o,
        "training",
        "percent",
        "leadership_training_coverage_pct",
        ratio_unless_zero(
            i.has("leaders_trained").then_some(i.leaders_trained),
            leaders_base,
        ),
        false,
        "Leaders trained last year / management committee members x 100",
        &["leaders_trained_last_year", "board_male", "board_female"],
        Some("Uses the management committee as the leadership body, consistently across periods."),
    );

    // ── D. operational and economic performance (indicators 11-13) ──
    let main_income = i
        .has_any(&["main_act_1_income", "main_act_2_income"])
        .then_some(i.main_act_1_income + i.main_act_2_income);
    let main_expenses = i
        .has_any(&["main_act_1_expenses", "main_act_2_expenses"])
        .then_some(i.main_act_1_expenses + i.main_act_2_expenses);
    let main_surplus = main_income.zip(main_expenses).map(|(inc, exp)| inc - exp);
    add(
        &mut o,
        "profitability",
        "percent",
        "main_activity_operating_margin_pct",
        ratio_unless_zero(main_surplus, main_income),
        false,
        "(Main activity income - main activity expenses) / main activity income x 100",
        &[
            "main_activity_1_income",
            "main_activity_1_expenses",
            "main_activity_2_income",
            "main_activity_2_expenses",
        ],
        Some("Q25 main activities 1 and 2 are taken together."),
    );

    // Q46 totals are reported excluding donations; fall back to Q25 + Q26.
    let q46 = i.has("income") && i.has("expenditure");
    let other_income = i.has("other_income").then_some(i.other_income);
    let other_expenses = i.has("other_expenditure").then_some(i.other_expenditure);
    let (op_income, op_surplus, op_approx) = if q46 {
        (Some(i.income), Some(i.income - i.expenditure), false)
    } else if let (Some(mi), Some(me)) = (main_income, main_expenses) {
        let income = mi + other_income.unwrap_or(0.0);
        (
            Some(income),
            Some(income - me - other_expenses.unwrap_or(0.0)),
            true,
        )
    } else {
        (None, None, false)
    };
    add(
        &mut o,
        "profitability",
        "percent",
        "total_operating_margin_pct",
        ratio_unless_zero(op_surplus, op_income),
        op_approx,
        "(Total operating income - total operating expenditure) / total operating income x 100",
        &["current_total_income", "current_total_expenditure"],
        Some("Income excludes donations (Q46). Falls back to Q25 + Q26 when Q46 is empty."),
    );
    let main_distrib = i
        .has_any(&["main_act_1_distrib", "main_act_2_distrib"])
        .then_some(i.main_act_1_distrib + i.main_act_2_distrib);
    add(
        &mut o,
        "profitability",
        "percent",
        "member_economic_benefit_ratio_pct",
        only_if(
            main_surplus.is_some_and(|s| s > 0.0),
            ratio_pct(main_distrib, main_surplus),
        ),
        false,
        "Main activity surplus distributed to members / main activity net surplus x 100",
        &[
            "main_activity_1_distrib_members",
            "main_activity_2_distrib_members",
        ],
        Some("Only calculated when the main activity net surplus is positive."),
    );

    // ── E. savings mobilisation (indicators 14-15) ──
    let savings_accounts = i
        .has_any(&["sav_acc_m", "sav_acc_f"])
        .then_some(i.sav_acc_m + i.sav_acc_f);
    add(
        &mut o,
        "savings",
        "percent",
        "savings_account_penetration_pct",
        ratio_unless_zero(savings_accounts, registered),
        false,
        "Savings accounts / registered members x 100",
        &["savings_accounts_male", "savings_accounts_female"],
        Some("Account penetration: one member may hold several accounts."),
    );
    let avg = |value: Option<f64>, accounts: Option<f64>| -> Option<f64> {
        accounts.filter(|n| *n > 0.0).zip(value).map(|(n, v)| v / n)
    };
    add(
        &mut o,
        "savings",
        "currency",
        "avg_savings_per_depositor",
        avg(d.deposits, d.deposit_accounts),
        false,
        "Total net savings value / number of savings accounts",
        &[
            "savings_value_male",
            "savings_value_female",
            "savings_accounts_male",
            "savings_accounts_female",
        ],
        None,
    );
    add(
        &mut o,
        "savings",
        "currency",
        "avg_savings_per_depositor_male",
        avg(
            i.has("sav_val_m").then_some(i.sav_val_m),
            i.has("sav_acc_m").then_some(i.sav_acc_m),
        ),
        false,
        "Male net savings value / male savings accounts",
        &["savings_value_male", "savings_accounts_male"],
        None,
    );
    add(
        &mut o,
        "savings",
        "currency",
        "avg_savings_per_depositor_female",
        avg(
            i.has("sav_val_f").then_some(i.sav_val_f),
            i.has("sav_acc_f").then_some(i.sav_acc_f),
        ),
        false,
        "Female net savings value / female savings accounts",
        &["savings_value_female", "savings_accounts_female"],
        None,
    );

    // ── F. loan portfolio quality (indicators 16-18) ──
    add(
        &mut o,
        "risk",
        "percent",
        "par_gt_30_pct",
        d.par_pct(d.overdue_gt_30),
        !exact,
        "Outstanding balance of loans overdue more than 30 days / total outstanding loan portfolio x 100",
        &[
            "par_31_90_value",
            "par_91_180_value",
            "par_181_360_value",
            "par_over_360_value",
            "loans_outstanding_value_male",
            "loans_outstanding_value_female",
        ],
        Some("Approximate when only the 31-365 day delinquency total is available."),
    );
    add(
        &mut o,
        "risk",
        "percent",
        "delinquent_loan_account_rate_pct",
        ratio_unless_zero(
            i.has("loans_arrears_count")
                .then_some(i.loans_arrears_count),
            i.has("loans_out_count").then_some(i.loans_out_count),
        ),
        false,
        "Delinquent loan accounts / outstanding loan accounts x 100",
        &[
            "loans_delinquent_accounts_male",
            "loans_delinquent_accounts_female",
            "loans_outstanding_accounts_male",
            "loans_outstanding_accounts_female",
        ],
        Some("Account-based measure, not the same as PAR."),
    );
    add(
        &mut o,
        "risk",
        "percent",
        "loan_recovery_rate_pct",
        ratio_unless_zero(
            i.has("recovered").then_some(i.recovered),
            i.has("written_off").then_some(i.written_off),
        ),
        false,
        "Loans recovered in the last 12 months / written-off loans x 100",
        &["recovered_loans_last_12mo", "written_off_loans_value"],
        Some("Not applicable when the written-off balance is zero."),
    );

    // ── G. institutional resilience (indicator 19) ──
    add(
        &mut o,
        "capital",
        "percent",
        "monetary_reserve_coverage_pct",
        only_if(
            i.has("statutory_reserves") && i.statutory_reserves > 0.0,
            ratio_pct(
                i.has("actual_reserves_bank")
                    .then_some(i.actual_reserves_bank),
                Some(i.statutory_reserves),
            ),
        ),
        false,
        "Actual monetary reserves in the bank / accumulated book reserves x 100",
        &["actual_monetary_reserves_bank", "accumulated_book_reserves"],
        Some(
            "Only calculated when accumulated reserves are positive, for the same reporting date.",
        ),
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
