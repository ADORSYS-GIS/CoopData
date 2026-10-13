//! Chart-of-accounts balances and ratios for the MPC financial questionnaire
//! (multipurpose cooperatives only — see migration 51). Parses the
//! `account_grid` answers, one key per Level-1 category
//! (`coa_assets`, `coa_liabilities`, `coa_equity`, `coa_revenue`,
//! `coa_direct_costs`, `coa_operating_expenses`, `coa_finance_costs`), each a
//! map of CoopData account code -> `{activityCode, openingBalance,
//! closingBalance, annualMovement}`, and computes the KPI set from "MPC
//! FINANCE QUESTIONNAIRE.xlsx" (KPI Data Mapping sheet).
//!
//! Asset/liability/equity accounts are balance accounts: `opening`/`closing`
//! matter. Revenue/direct-cost/opex/finance-cost accounts are flow accounts
//! for the period: `movement` is the figure that matters (per the workbook's
//! Instructions sheet: "ANNUAL MOVEMENT / TOTAL — the annual income/expense
//! movement ... where applicable").

use std::collections::HashMap;

use serde_json::Value;

use crate::api::dto::basic_dashboard::IndicatorValue;

const GRID_KEYS: &[&str] = &[
    "coa_assets",
    "coa_liabilities",
    "coa_equity",
    "coa_revenue",
    "coa_direct_costs",
    "coa_operating_expenses",
    "coa_finance_costs",
];

const CURRENT_ASSETS: &[&str] = &["1100", "1200", "1300", "1400", "1500", "1600", "1700"];
const NONCURRENT_ASSETS: &[&str] = &["1800", "1900"];
const CURRENT_LIABILITIES: &[&str] = &["2100", "2200", "2300", "2400"];
const NONCURRENT_LIABILITIES: &[&str] = &["2500", "2600"];
const EQUITY: &[&str] = &["3100", "3200", "3300", "3400", "3500"];
const OPERATING_REVENUE: &[&str] = &["4100", "4200", "4300", "4400", "4500", "4600"];
const ACTIVITY_REVENUE: &[&str] = &["4100", "4200", "4300", "4400"];
const DIRECT_COSTS: &[&str] = &["5100", "5200", "5300"];
const OPEX: &[&str] = &["6100", "6200", "6300", "6400", "6500", "6600", "6700", "6800"];
const FINANCE_COSTS: &[&str] = &["7100", "7200", "7300"];

#[derive(Debug, Clone, Copy, Default)]
struct AccountFigure {
    opening: f64,
    closing: f64,
    movement: f64,
    reported: bool,
}

/// Optional cash-flow and receivables figures of the "cashflow" section.
/// Absent keys mean the cooperative did not provide them: the KPIs that need
/// them are then not generated.
const EXTRA_KEYS: &[&str] = &[
    "cf_operating_cash_flow",
    "cf_principal_repayments",
    "cf_credit_sales",
    "cf_cash_operating_expenses",
    "cf_receivables_over_90",
];

#[derive(Debug, Clone, Default)]
pub struct CoaBalances {
    by_code: HashMap<String, AccountFigure>,
    extras: HashMap<&'static str, f64>,
    /// Cooperatives that filled in each extra figure.
    extras_count: HashMap<&'static str, u32>,
    /// Cooperatives that contributed to these balances.
    cooperatives: u32,
}

fn number(v: &Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.trim().replace(',', "").parse().ok()))
}

impl CoaBalances {
    pub fn from_answers(answers: &Value) -> Self {
        let mut by_code: HashMap<String, AccountFigure> = HashMap::new();
        for grid_key in GRID_KEYS {
            let Some(grid) = answers.get(*grid_key).and_then(Value::as_object) else {
                continue;
            };
            for (code, cell) in grid {
                let Some(cell) = cell.as_object() else {
                    continue;
                };
                let opening = cell.get("openingBalance").and_then(number).unwrap_or(0.0);
                let closing = cell.get("closingBalance").and_then(number).unwrap_or(0.0);
                let movement = cell.get("annualMovement").and_then(number).unwrap_or(0.0);
                if cell.get("openingBalance").and_then(number).is_none()
                    && cell.get("closingBalance").and_then(number).is_none()
                    && cell.get("annualMovement").and_then(number).is_none()
                {
                    continue;
                }
                by_code.insert(
                    code.clone(),
                    AccountFigure {
                        opening,
                        closing,
                        movement,
                        reported: true,
                    },
                );
            }
        }
        let mut extras = HashMap::new();
        let mut extras_count = HashMap::new();
        for key in EXTRA_KEYS {
            if let Some(v) = answers.get(*key).and_then(number) {
                extras.insert(*key, v);
                extras_count.insert(*key, 1);
            }
        }
        let cooperatives = u32::from(!by_code.is_empty() || !extras.is_empty());
        Self {
            by_code,
            extras,
            extras_count,
            cooperatives,
        }
    }

    pub fn has_any(&self) -> bool {
        !self.by_code.is_empty()
    }

    fn extra(&self, key: &str) -> Option<f64> {
        self.extras.get(key).copied()
    }

    pub fn add(&mut self, other: &Self) {
        for (code, fig) in &other.by_code {
            let entry = self.by_code.entry(code.clone()).or_default();
            entry.opening += fig.opening;
            entry.closing += fig.closing;
            entry.movement += fig.movement;
            entry.reported = entry.reported || fig.reported;
        }
        for (key, v) in &other.extras {
            *self.extras.entry(key).or_insert(0.0) += v;
        }
        for (key, n) in &other.extras_count {
            *self.extras_count.entry(key).or_insert(0) += n;
        }
        self.cooperatives += other.cooperatives;
    }

    /// Caveat for a KPI built from an optional figure, when some of the
    /// cooperatives in a consolidated view did not provide it.
    fn coverage_note(&self, key: &str, base: &str) -> String {
        let provided = self.extras_count.get(key).copied().unwrap_or(0);
        if self.cooperatives > 1 && provided < self.cooperatives {
            format!(
                "{base} Some cooperatives did not provide this data, so the value may be incomplete ({provided} of {} provided it).",
                self.cooperatives
            )
        } else {
            base.to_string()
        }
    }

    fn any_reported(&self, codes: &[&str]) -> bool {
        codes.iter().any(|c| self.by_code.get(*c).is_some_and(|f| f.reported))
    }

    fn sum_closing(&self, codes: &[&str]) -> f64 {
        codes.iter().filter_map(|c| self.by_code.get(*c)).map(|f| f.closing).sum()
    }

    fn sum_opening(&self, codes: &[&str]) -> f64 {
        codes.iter().filter_map(|c| self.by_code.get(*c)).map(|f| f.opening).sum()
    }

    fn sum_movement(&self, codes: &[&str]) -> f64 {
        codes.iter().filter_map(|c| self.by_code.get(*c)).map(|f| f.movement).sum()
    }

    fn avg_balance(&self, codes: &[&str]) -> f64 {
        (self.sum_opening(codes) + self.sum_closing(codes)) / 2.0
    }
}

fn pct(numerator: f64, denominator: f64) -> Option<f64> {
    (denominator.abs() > f64::EPSILON).then_some(numerator / denominator * 100.0)
}

fn ratio(numerator: f64, denominator: f64) -> Option<f64> {
    (denominator.abs() > f64::EPSILON).then_some(numerator / denominator)
}

#[allow(clippy::too_many_arguments)]
fn push(
    out: &mut Vec<IndicatorValue>,
    unit: &str,
    key: &str,
    value: Option<f64>,
    approximate: bool,
    formula: &str,
    sources: &[&str],
    note: Option<&str>,
) {
    let status = match (value, approximate) {
        (None, _) => "not_reported",
        (Some(_), true) => "approximate",
        (Some(_), false) => "computed",
    };
    out.push(IndicatorValue {
        key: key.to_string(),
        group: "coa".to_string(),
        value: value.filter(|v| v.is_finite()),
        unit: unit.to_string(),
        status: status.to_string(),
        previous: None,
        change_pct: None,
        formula: formula.to_string(),
        sources: sources.iter().map(|s| s.to_string()).collect(),
        note: note.map(str::to_string),
    });
}

/// Builds the chart-of-accounts KPI set. Always returns all 15 rows — value
/// is `None` ("not_reported") for any ratio whose accounts were never filled
/// in, same convention as the rest of the questionnaire KPI engine.
pub fn build(b: &CoaBalances) -> Vec<IndicatorValue> {
    let mut o = Vec::with_capacity(15);

    let current_assets = b.sum_closing(CURRENT_ASSETS);
    let avg_total_assets = b.avg_balance(CURRENT_ASSETS) + b.avg_balance(NONCURRENT_ASSETS);
    let current_liabilities = b.sum_closing(CURRENT_LIABILITIES);
    let noncurrent_liabilities = b.sum_closing(NONCURRENT_LIABILITIES);
    let total_liabilities = current_liabilities + noncurrent_liabilities;
    let total_equity = b.sum_closing(EQUITY);
    let avg_equity = b.avg_balance(EQUITY);
    let net_surplus = b.by_code.get("3500").map(|f| f.closing).unwrap_or(0.0);
    let has_3500 = b.any_reported(&["3500"]);

    let op_revenue = b.sum_movement(OPERATING_REVENUE);
    let has_op_revenue = b.any_reported(OPERATING_REVENUE);
    let direct_costs = b.sum_movement(DIRECT_COSTS);
    let opex = b.sum_movement(OPEX);
    let operating_profit = op_revenue - direct_costs - opex;
    let total_revenue = op_revenue + b.sum_movement(&["4700", "4800"]);
    let finance_costs = b.sum_movement(FINANCE_COSTS);

    // 1. Operating Profit Margin
    push(
        &mut o,
        "percent",
        "operating_profit_margin_pct",
        (has_op_revenue || b.any_reported(DIRECT_COSTS) || b.any_reported(OPEX))
            .then(|| pct(operating_profit, op_revenue))
            .flatten(),
        false,
        "(Operating revenue - direct costs - operating expenses) / operating revenue x 100",
        &["coa_revenue", "coa_direct_costs", "coa_operating_expenses"],
        None,
    );

    // 2. Net Profit Margin
    push(
        &mut o,
        "percent",
        "net_profit_margin_pct",
        has_3500.then(|| pct(net_surplus, total_revenue)).flatten(),
        false,
        "Net surplus (account 3500) / total revenue x 100",
        &["coa_equity", "coa_revenue"],
        None,
    );

    // 3. ROA
    push(
        &mut o,
        "percent",
        "coa_return_on_assets_pct",
        has_3500.then(|| pct(net_surplus, avg_total_assets)).flatten(),
        false,
        "Net surplus / average total assets x 100",
        &["coa_equity", "coa_assets"],
        None,
    );

    // 4. ROE
    push(
        &mut o,
        "percent",
        "coa_return_on_equity_pct",
        has_3500.then(|| pct(net_surplus, avg_equity)).flatten(),
        false,
        "Net surplus / average members' equity x 100",
        &["coa_equity"],
        None,
    );

    // 5. Current Ratio
    push(
        &mut o,
        "ratio",
        "current_ratio",
        (b.any_reported(CURRENT_ASSETS) || b.any_reported(CURRENT_LIABILITIES))
            .then(|| ratio(current_assets, current_liabilities))
            .flatten(),
        false,
        "Current assets / current liabilities",
        &["coa_assets", "coa_liabilities"],
        None,
    );

    // 6. Debt-to-Equity
    push(
        &mut o,
        "ratio",
        "debt_to_equity_ratio",
        (b.any_reported(CURRENT_LIABILITIES) || b.any_reported(NONCURRENT_LIABILITIES))
            .then(|| ratio(total_liabilities, total_equity))
            .flatten(),
        false,
        "Total liabilities / total equity",
        &["coa_liabilities", "coa_equity"],
        None,
    );

    // 7. Working Capital
    push(
        &mut o,
        "currency",
        "working_capital",
        (b.any_reported(CURRENT_ASSETS) || b.any_reported(CURRENT_LIABILITIES))
            .then_some(current_assets - current_liabilities),
        false,
        "Current assets - current liabilities",
        &["coa_assets", "coa_liabilities"],
        None,
    );

    // 8. Days Sales Outstanding (needs credit sales)
    let avg_receivables = b.avg_balance(&["1400"]);
    push(
        &mut o,
        "ratio",
        "days_sales_outstanding",
        b.extra("cf_credit_sales")
            .filter(|_| b.any_reported(&["1400"]))
            .and_then(|credit_sales| ratio(avg_receivables, credit_sales).map(|r| r * 365.0)),
        false,
        "Average trade receivables / credit sales x 365",
        &["coa_assets", "cf_credit_sales"],
        Some(&b.coverage_note("cf_credit_sales", "Needs credit sales for the year (cash-flow section); not generated without it.")),
    );

    // 9. Inventory Turnover
    let cogs = b.sum_movement(&["5100"]);
    let avg_inventory = b.avg_balance(&["1600"]);
    push(
        &mut o,
        "ratio",
        "inventory_turnover",
        b.any_reported(&["5100"])
            .then(|| ratio(cogs, avg_inventory))
            .flatten(),
        false,
        "Cost of goods sold / average inventory",
        &["coa_direct_costs", "coa_assets"],
        None,
    );

    // 10. Operating Cash Flow Ratio (needs reported operating cash flow)
    let operating_cash_flow = b.extra("cf_operating_cash_flow");
    push(
        &mut o,
        "ratio",
        "operating_cash_flow_ratio",
        operating_cash_flow
            .filter(|_| b.any_reported(CURRENT_LIABILITIES))
            .and_then(|ocf| ratio(ocf, current_liabilities)),
        false,
        "Operating cash flow / current liabilities",
        &["cf_operating_cash_flow", "coa_liabilities"],
        Some(&b.coverage_note("cf_operating_cash_flow", "Needs net cash from operating activities (cash-flow section); not generated without it.")),
    );

    // 11. Activity Concentration Risk
    let largest_activity = ACTIVITY_REVENUE
        .iter()
        .map(|c| b.sum_movement(&[c]))
        .fold(0.0_f64, f64::max);
    push(
        &mut o,
        "percent",
        "activity_concentration_risk_pct",
        has_op_revenue
            .then(|| pct(largest_activity, op_revenue))
            .flatten(),
        false,
        "Largest activity revenue / total operating revenue x 100",
        &["coa_revenue"],
        None,
    );

    // 12. DSCR (needs reported operating cash flow and principal repayments)
    let interest_expense = b.sum_movement(&["7100"]);
    push(
        &mut o,
        "ratio",
        "dscr",
        operating_cash_flow
            .zip(b.extra("cf_principal_repayments"))
            .filter(|_| b.any_reported(&["7100"]))
            .and_then(|(ocf, principal)| ratio(ocf, principal + interest_expense)),
        false,
        "Operating cash flow / (principal repayments + interest payments)",
        &["cf_operating_cash_flow", "cf_principal_repayments", "coa_finance_costs"],
        Some(&b.coverage_note("cf_principal_repayments", "Needs operating cash flow and principal repayments (cash-flow section); not generated without them.")),
    );

    // 13. Cash Liquidity Coverage (needs cash operating expenses)
    let cash_and_bank = b.sum_closing(&["1100", "1200"]);
    push(
        &mut o,
        "ratio",
        "cash_liquidity_coverage",
        b.extra("cf_cash_operating_expenses")
            .filter(|_| b.any_reported(&["1100", "1200"]))
            .and_then(|cash_opex| ratio(cash_and_bank, cash_opex / 12.0)),
        false,
        "(Cash + bank) / average monthly cash operating expenses",
        &["coa_assets", "cf_cash_operating_expenses"],
        Some(&b.coverage_note("cf_cash_operating_expenses", "Needs cash operating expenses for the year (cash-flow section); not generated without it.")),
    );

    // 14. Interest Coverage
    push(
        &mut o,
        "ratio",
        "interest_coverage",
        b.any_reported(FINANCE_COSTS)
            .then(|| ratio(operating_profit, finance_costs))
            .flatten(),
        false,
        "Operating profit / interest and finance costs",
        &["coa_revenue", "coa_direct_costs", "coa_operating_expenses", "coa_finance_costs"],
        None,
    );

    // 15. Receivables Risk Ratio (needs the over-90-day receivables)
    push(
        &mut o,
        "percent",
        "receivables_risk_ratio_pct",
        b.extra("cf_receivables_over_90")
            .filter(|_| b.any_reported(&["1400"]))
            .and_then(|over_90| pct(over_90, b.sum_closing(&["1400"]))),
        false,
        ">90-day receivables / total receivables x 100",
        &["cf_receivables_over_90", "coa_assets"],
        Some(&b.coverage_note("cf_receivables_over_90", "Needs receivables over 90 days (cash-flow section); not generated without it.")),
    );

    o
}

#[cfg(test)]
mod tests;
