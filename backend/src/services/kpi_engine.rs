//! KPI Engine — pure computation service.
//!
//! Takes balance sheet line items and computes all financial KPIs.
//! No database access — all computation is done in memory.
//! Mirrors the logic in `frontend/src/lib/kpi-calculations.ts`.

use crate::entities::balance_sheet_line_item::Model as LineItemModel;
use rust_decimal::prelude::ToPrimitive;

// ── Public output types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct KpiValue {
    /// Snake_case identifier matching frontend kpi-calculations.ts keys
    pub name: String,
    pub value: f64,
    pub formatted: String,
    /// "percent" | "currency" | "ratio"
    pub unit: String,
    /// "green" | "amber" | "red"
    pub status: Option<String>,
    pub benchmark: Option<f64>,
    pub description: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComputedKpiSet {
    pub total_assets: KpiValue,
    pub gross_loan_portfolio: KpiValue,
    pub net_loan_portfolio: KpiValue,
    pub total_member_deposits: KpiValue,
    pub total_equity: KpiValue,
    pub par30: KpiValue,
    pub par90: KpiValue,
    pub npl_ratio: KpiValue,
    pub loan_loss_coverage: KpiValue,
    pub roa: KpiValue,
    pub roe: KpiValue,
    pub operating_expense_ratio: KpiValue,
    pub capital_adequacy_ratio: KpiValue,
    pub liquid_funds_ratio: KpiValue,
    pub operational_self_sufficiency: KpiValue,
    pub net_interest_margin: KpiValue,
    pub deposits_to_loans: KpiValue,
    pub net_surplus: KpiValue,
}

impl ComputedKpiSet {
    /// Flatten into a Vec for API responses — preserves order.
    pub fn to_vec(self) -> Vec<KpiValue> {
        vec![
            self.total_assets,
            self.gross_loan_portfolio,
            self.net_loan_portfolio,
            self.total_member_deposits,
            self.total_equity,
            self.net_surplus,
            self.par30,
            self.par90,
            self.npl_ratio,
            self.loan_loss_coverage,
            self.roa,
            self.roe,
            self.operating_expense_ratio,
            self.capital_adequacy_ratio,
            self.liquid_funds_ratio,
            self.operational_self_sufficiency,
            self.net_interest_margin,
            self.deposits_to_loans,
        ]
    }

    /// Look up a single KPI by its snake_case name.
    pub fn get_by_name(&self, name: &str) -> Option<&KpiValue> {
        match name {
            "total_assets" => Some(&self.total_assets),
            "gross_loan_portfolio" => Some(&self.gross_loan_portfolio),
            "net_loan_portfolio" => Some(&self.net_loan_portfolio),
            "total_member_deposits" => Some(&self.total_member_deposits),
            "total_equity" => Some(&self.total_equity),
            "net_surplus" => Some(&self.net_surplus),
            "par30" => Some(&self.par30),
            "par90" => Some(&self.par90),
            "npl_ratio" => Some(&self.npl_ratio),
            "loan_loss_coverage" => Some(&self.loan_loss_coverage),
            "roa" => Some(&self.roa),
            "roe" => Some(&self.roe),
            "operating_expense_ratio" => Some(&self.operating_expense_ratio),
            "capital_adequacy_ratio" => Some(&self.capital_adequacy_ratio),
            "liquid_funds_ratio" => Some(&self.liquid_funds_ratio),
            "operational_self_sufficiency" => Some(&self.operational_self_sufficiency),
            "net_interest_margin" => Some(&self.net_interest_margin),
            "deposits_to_loans" => Some(&self.deposits_to_loans),
            _ => None,
        }
    }
}

// ── Engine ───────────────────────────────────────────────────────────────────

/// Shown instead of a figure when the statement lacks the inputs.
pub const NOT_REPORTED: &str = "—";

pub struct KpiEngine;

impl KpiEngine {
    /// Compute all financial KPIs from statement line items.
    /// Balance-sheet figures use the latest month reported; income and expense
    /// figures are summed over every reported month (month 0 is ignored when
    /// monthly rows exist).
    pub fn compute(line_items: &[LineItemModel]) -> ComputedKpiSet {
        let max_month = line_items.iter().map(|item| item.month).max().unwrap_or(0);
        let filtered_items: Vec<_> = line_items
            .iter()
            .filter(|item| item.month == max_month)
            .cloned()
            .collect();
        let items = &filtered_items;
        let flow_items: Vec<_> = line_items
            .iter()
            .filter(|item| max_month == 0 || item.month > 0)
            .cloned()
            .collect();
        let flows = &flow_items;

        // ── Aggregate by account code ────────────────────────────────────────
        let liquid_assets = {
            let parent = Self::sum_code(items, 1100);
            if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_codes(items, &[1101, 1102, 1103, 1104])
            }
        };

        // GLP components (needed individually for PAR calculation)
        let glp_performing = Self::sum_code(items, 1201);
        let glp_arrears_1_30 = Self::sum_code(items, 1202);
        let glp_arrears_31_60 = Self::sum_code(items, 1203);
        let glp_arrears_61_90 = Self::sum_code(items, 1204);
        let glp_npl = Self::sum_code(items, 1205);

        let gross_lp = {
            let parent = Self::sum_code(items, 1200);
            if parent.abs() > 0.001 {
                parent
            } else {
                glp_performing + glp_arrears_1_30 + glp_arrears_31_60 + glp_arrears_61_90 + glp_npl
            }
        };
        let arrears_30_plus = glp_arrears_31_60 + glp_arrears_61_90 + glp_npl;
        let provisions = {
            let parent = Self::sum_code(items, 1250);
            let stored = if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_codes(items, &[1251, 1252])
            };
            stored.abs()
        };
        let net_lp = gross_lp - provisions;

        let total_assets = {
            let parent = Self::sum_code(items, 1999);
            if parent.abs() > 0.001 {
                parent
            } else {
                liquid_assets + gross_lp - provisions + Self::sum_code(items, 1300)
            }
        };
        let member_deposits = {
            let parent = Self::sum_code(items, 2100);
            if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_codes(items, &[2101, 2102, 2103])
            }
        };
        let total_equity = {
            let parent = Self::sum_code(items, 3999);
            if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_codes(items, &[3101, 3102, 3201, 3202, 3203, 3301, 3302])
            }
        };

        let financial_income = Self::sum_codes(flows, &[4101, 4102]);
        let other_income = Self::sum_code(flows, 4201);
        let total_income = {
            let parent = Self::sum_code(flows, 4999);
            if parent.abs() > 0.001 {
                parent
            } else {
                financial_income + other_income
            }
        };

        let financial_expenses = Self::sum_codes(flows, &[5101, 5102]);
        let operating_expenses = Self::sum_codes(flows, &[5201, 5202, 5203, 5204]);
        let credit_loss_expense = Self::sum_code(flows, 5301);
        let total_expenses = {
            let parent = Self::sum_code(flows, 5999);
            if parent.abs() > 0.001 {
                parent
            } else {
                financial_expenses + operating_expenses + credit_loss_expense
            }
        };

        let net_surplus = {
            let parent = Self::sum_code(flows, 6999);
            if parent.abs() > 0.001 {
                parent
            } else if total_income.abs() > 0.001 || total_expenses.abs() > 0.001 {
                total_income - total_expenses
            } else {
                Self::sum_code(items, 3302)
            }
        };

        // ── Compute ratios: None when the inputs were not reported ───────────
        let has_income_statement =
            total_income.abs() > 0.001 || total_expenses.abs() > 0.001 || net_surplus.abs() > 0.001;
        let flow = |value: Option<f64>| value.filter(|_| has_income_statement);
        let par30_val = Self::ratio_pct(arrears_30_plus, gross_lp);
        let par90_val = Self::ratio_pct(glp_npl, gross_lp);
        let llc_val = Self::ratio_pct(provisions, arrears_30_plus);
        let roa_val = flow(Self::ratio_pct(net_surplus, total_assets));
        let roe_val = flow(Self::ratio_pct(net_surplus, total_equity));
        let oer_val = flow(Self::ratio_pct(operating_expenses, total_assets));
        let car_val = Self::ratio_pct(total_equity, total_assets);
        let lfr_val = Self::ratio_pct(liquid_assets, total_assets);
        let oss_val = flow(Self::ratio_pct(total_income, total_expenses));
        let nim_val = flow(Self::ratio_pct(
            financial_income - financial_expenses,
            total_assets,
        ));
        let dtl_val = Self::ratio_pct(member_deposits, gross_lp);

        let mut set = ComputedKpiSet {
            total_assets: Self::kpi_currency(
                total_assets,
                "total_assets",
                "Everything the cooperative owns. It shows the overall size of the cooperative. Taken from the approved financial statement at the latest month reported. Formula: total assets (1999).",
                None,
                None,
            ),
            gross_loan_portfolio: Self::kpi_currency(
                gross_lp,
                "gross_loan_portfolio",
                "The amount members still owe on loans, including overdue loans, before provisions. It is the main earning asset. Taken from the approved financial statement at the latest month reported. Formula: loans and advances (1200).",
                None,
                None,
            ),
            net_loan_portfolio: Self::kpi_currency(
                net_lp,
                "net_loan_portfolio",
                "The loan book after setting aside money for expected losses, a more prudent view of what will be recovered. Taken from the approved financial statement. Formula: gross loan portfolio minus provisions.",
                None,
                None,
            ),
            total_member_deposits: Self::kpi_currency(
                member_deposits,
                "total_member_deposits",
                "The money members hold as savings with the cooperative. It is the main source of funds for lending. Taken from the approved financial statement at the latest month reported. Formula: member deposits and savings (2100).",
                None,
                None,
            ),
            total_equity: Self::kpi_currency(
                total_equity,
                "total_equity",
                "What is left for members after all debts are paid: shares, reserves and retained earnings. It shows net worth. Taken from the approved financial statement at the latest month reported. Formula: total equity (3999).",
                None,
                None,
            ),
            net_surplus: Self::kpi_currency(
                if has_income_statement {
                    net_surplus
                } else {
                    0.0
                },
                "net_surplus",
                "What is left after all expenses. Positive is a surplus, negative a loss. Shown as not reported when the statement has no income lines. Taken from the approved financial statement, summed over the months reported. Formula: net surplus (6999), otherwise total income minus total expenses.",
                None,
                None,
            ),
            par30: Self::kpi_percent(
                par30_val,
                "par30",
                "The share of the loan book that is more than 30 days late. A high value means many loans may not be repaid, so lower is better. Loans only 1 to 30 days late are not counted. Taken from the approved financial statement at the latest month reported. Formula: loans overdue more than 30 days divided by gross loans (1203, 1204, 1205 over 1200).",
                par30_val.map(|v| Self::status_lower_better(v, 5.0, 10.0)),
                Some(5.0),
            ),
            par90: Self::kpi_percent(
                par90_val,
                "par90",
                "The share of the loan book that is more than 90 days late. These loans are unlikely to be recovered, so lower is better. Taken from the approved financial statement at the latest month reported. Formula: non-performing loans divided by gross loans (1205 over 1200).",
                par90_val.map(|v| Self::status_lower_better(v, 2.0, 5.0)),
                Some(2.0),
            ),
            npl_ratio: Self::kpi_percent(
                par90_val,
                "npl_ratio",
                "The share of the loan book that is non-performing, meaning more than 90 days late. Lower is better. Taken from the approved financial statement at the latest month reported. Formula: non-performing loans divided by gross loans (1205 over 1200).",
                par90_val.map(|v| Self::status_lower_better(v, 2.0, 5.0)),
                Some(2.0),
            ),
            loan_loss_coverage: Self::kpi_percent(
                llc_val,
                "loan_loss_coverage",
                "How much of the seriously late loans is covered by provisions. Around 100 percent or more means expected losses are fully set aside; higher is safer. Shown as not reported when there are no loans over 30 days late. Formula: provisions divided by loans overdue more than 30 days.",
                llc_val.map(|v| Self::status_higher_better(v, 100.0, 80.0)),
                Some(100.0),
            ),
            roa: Self::kpi_percent(
                roa_val,
                "roa",
                "How much surplus is made for each unit of assets. Higher means assets are used more profitably. Shown as not reported when the statement has no income lines. Taken from the approved statement, for the period covered and not annualised. Formula: net surplus divided by total assets.",
                roa_val.map(|v| Self::status_higher_better(v, 3.0, 1.0)),
                Some(3.0),
            ),
            roe: Self::kpi_percent(
                roe_val,
                "roe",
                "How much surplus is made for each unit of members' equity. Higher is better. Shown as not reported when the statement has no income lines. Taken from the approved statement, for the period covered and not annualised. Formula: net surplus divided by total equity.",
                roe_val.map(|v| Self::status_higher_better(v, 8.0, 4.0)),
                Some(8.0),
            ),
            operating_expense_ratio: Self::kpi_percent(
                oer_val,
                "operating_expense_ratio",
                "The running costs of the cooperative compared with its size. Lower means a leaner operation. Shown as not reported when the statement has no income lines. Taken from the approved statement, for the period covered and not annualised. Formula: operating expenses divided by total assets.",
                oer_val.map(|v| Self::status_lower_better(v, 5.0, 8.0)),
                Some(5.0),
            ),
            capital_adequacy_ratio: Self::kpi_percent(
                car_val,
                "capital_adequacy_ratio",
                "How much of the assets belongs to members rather than creditors. Higher means a stronger cushion against losses. Taken from the approved financial statement at the latest month reported. Formula: total equity divided by total assets.",
                car_val.map(|v| Self::status_higher_better(v, 10.0, 8.0)),
                Some(10.0),
            ),
            liquid_funds_ratio: Self::kpi_percent(
                lfr_val,
                "liquid_funds_ratio",
                "The share of assets held as cash and bank balances, available at short notice. Higher is safer. This is measured against total assets, not against member savings. Taken from the approved financial statement at the latest month reported. Formula: liquid assets divided by total assets.",
                lfr_val.map(|v| Self::status_higher_better(v, 15.0, 10.0)),
                Some(15.0),
            ),
            operational_self_sufficiency: Self::kpi_percent(
                oss_val,
                "operational_self_sufficiency",
                "Whether income covers costs. Above 100 percent the cooperative covers its costs from its own income; higher is better. Shown as not reported when the statement has no income lines. Taken from the approved statement, summed over the months reported. Formula: total income divided by total expenses.",
                oss_val.map(|v| Self::status_higher_better(v, 110.0, 100.0)),
                Some(110.0),
            ),
            net_interest_margin: Self::kpi_percent(
                nim_val,
                "net_interest_margin",
                "What the cooperative earns from lending and investing after paying interest, compared with its size. Higher is better. Shown as not reported when the statement has no income lines. Taken from the approved statement, for the period covered and not annualised. Formula: financial income minus financial expenses, divided by total assets.",
                None,
                None,
            ),
            deposits_to_loans: Self::kpi_percent(
                dtl_val,
                "deposits_to_loans",
                "How much members have saved for each unit lent. Below 100 percent means loans exceed savings and are funded by other sources. Taken from the approved financial statement at the latest month reported. Formula: member savings divided by gross loan portfolio.",
                None,
                None,
            ),
        };
        if !has_income_statement {
            set.net_surplus.formatted = NOT_REPORTED.to_string();
        }
        if total_assets.abs() < f64::EPSILON {
            set.total_assets.formatted = NOT_REPORTED.to_string();
        }
        set
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /// Sum values for a single account code across all months.
    fn sum_code(items: &[LineItemModel], code: i32) -> f64 {
        items
            .iter()
            .filter(|item| item.account_code == Some(code))
            .filter_map(|item| item.value.as_ref().and_then(|v| v.to_f64()))
            .sum()
    }

    /// Sum values for a slice of account codes across all months.
    fn sum_codes(items: &[LineItemModel], codes: &[i32]) -> f64 {
        codes.iter().map(|&code| Self::sum_code(items, code)).sum()
    }

    /// Percentage, or None when the denominator is zero or missing.
    #[inline]
    fn ratio_pct(numerator: f64, denominator: f64) -> Option<f64> {
        (denominator.abs() >= f64::EPSILON).then(|| numerator / denominator * 100.0)
    }

    /// Status threshold where lower values are better (e.g. PAR, OER).
    fn status_lower_better(value: f64, green_max: f64, amber_max: f64) -> String {
        if value <= green_max {
            "green".to_string()
        } else if value <= amber_max {
            "amber".to_string()
        } else {
            "red".to_string()
        }
    }

    /// Status threshold where higher values are better (e.g. ROA, CAR).
    fn status_higher_better(value: f64, green_min: f64, amber_min: f64) -> String {
        if value >= green_min {
            "green".to_string()
        } else if value >= amber_min {
            "amber".to_string()
        } else {
            "red".to_string()
        }
    }

    fn format_currency(value: f64) -> String {
        let abs = value.abs();
        let sign = if value < 0.0 { "-" } else { "" };
        if abs >= 1_000_000_000.0 {
            format!("{sign}{:.2}B", abs / 1_000_000_000.0)
        } else if abs >= 1_000_000.0 {
            format!("{sign}{:.1}M", abs / 1_000_000.0)
        } else if abs >= 1_000.0 {
            format!("{sign}{:.0}K", abs / 1_000.0)
        } else {
            format!("{sign}{abs:.0}")
        }
    }

    fn kpi_currency(
        value: f64,
        name: &str,
        description: &str,
        status: Option<String>,
        benchmark: Option<f64>,
    ) -> KpiValue {
        KpiValue {
            name: name.to_string(),
            value,
            formatted: Self::format_currency(value),
            unit: "currency".to_string(),
            status,
            benchmark,
            description: description.to_string(),
        }
    }

    fn kpi_percent(
        value: Option<f64>,
        name: &str,
        description: &str,
        status: Option<String>,
        benchmark: Option<f64>,
    ) -> KpiValue {
        KpiValue {
            name: name.to_string(),
            value: value.unwrap_or(0.0),
            formatted: value.map_or_else(|| NOT_REPORTED.to_string(), |v| format!("{v:.1}%")),
            unit: "percent".to_string(),
            status: value.and(status),
            benchmark,
            description: description.to_string(),
        }
    }

    /// Retrieve the standard benchmark for a given KPI name.
    pub fn get_benchmark(name: &str) -> Option<f64> {
        match name {
            "par30" => Some(5.0),
            "par90" => Some(2.0),
            "npl_ratio" => Some(2.0),
            "loan_loss_coverage" => Some(100.0),
            "roa" => Some(3.0),
            "roe" => Some(8.0),
            "operating_expense_ratio" => Some(5.0),
            "capital_adequacy_ratio" => Some(10.0),
            "liquid_funds_ratio" => Some(15.0),
            "operational_self_sufficiency" => Some(110.0),
            _ => None,
        }
    }
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    fn make_item(code: i32, value: f64) -> LineItemModel {
        LineItemModel {
            id: Uuid::new_v4(),
            financial_statement_id: Uuid::new_v4(),
            account_code: Some(code),
            account_name: format!("Account {code}"),
            account_category: crate::entities::enums::AccountCategory::Assets,
            account_subcategory: "test".to_string(),
            month: 12,
            value: Some(Decimal::from_f64_retain(value).unwrap()),
            ai_confidence: None,
            ai_flagged: false,
            manually_edited: false,
            raw_label: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_empty_line_items_returns_zero_kpis() {
        let result = KpiEngine::compute(&[]);
        assert_eq!(result.total_assets.value, 0.0);
        assert_eq!(result.par30.value, 0.0);
        assert_eq!(result.roa.value, 0.0);
        assert_eq!(result.capital_adequacy_ratio.value, 0.0);
    }

    #[test]
    fn test_par30_computed_correctly() {
        let items = vec![
            make_item(1201, 1000.0),
            make_item(1203, 100.0),
            make_item(1205, 50.0),
            make_item(1999, 5000.0), // total assets
            make_item(3999, 1000.0), // equity
            make_item(6999, 100.0),  // net surplus
        ];
        let result = KpiEngine::compute(&items);
        let par30 = 150.0 / 1150.0 * 100.0;
        assert!(
            (result.par30.value - par30).abs() < 0.001,
            "PAR30 was {}",
            result.par30.value
        );
    }

    #[test]
    fn test_income_is_summed_over_reported_months() {
        let mut items = Vec::new();
        for month in 1..=3_i16 {
            let mut assets = make_item(1999, 10_000.0);
            assets.month = month;
            let mut income = make_item(4999, 100.0);
            income.month = month;
            let mut expenses = make_item(5999, 70.0);
            expenses.month = month;
            items.extend([assets, income, expenses]);
        }
        let mut annual_total = make_item(6999, 9_999.0);
        annual_total.month = 0;
        items.push(annual_total);

        let result = KpiEngine::compute(&items);

        assert!((result.net_surplus.value - 90.0).abs() < 0.001);
        assert!((result.roa.value - 0.9).abs() < 0.001);
    }

    #[test]
    fn test_provisions_stored_negative_reduce_net_loans_and_cover_arrears() {
        let items = vec![
            make_item(1200, 1000.0),
            make_item(1203, 100.0),
            make_item(1250, -50.0),
        ];
        let result = KpiEngine::compute(&items);
        assert!((result.net_loan_portfolio.value - 950.0).abs() < 0.001);
        assert!((result.loan_loss_coverage.value - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_total_assets_fallback_subtracts_provisions() {
        let items = vec![
            make_item(1100, 200.0),
            make_item(1200, 1000.0),
            make_item(1250, -50.0),
            make_item(1300, 100.0),
        ];
        let result = KpiEngine::compute(&items);
        assert!((result.total_assets.value - 1250.0).abs() < 0.001);
    }

    #[test]
    fn test_ratios_without_inputs_are_not_reported_instead_of_zero() {
        let items = vec![make_item(1999, 1000.0), make_item(3999, 200.0)];
        let result = KpiEngine::compute(&items);
        assert_eq!(result.roa.formatted, NOT_REPORTED);
        assert_eq!(result.roa.status, None);
        assert_eq!(result.par30.formatted, NOT_REPORTED);
        assert_eq!(result.loan_loss_coverage.status, None);
        assert_eq!(result.net_surplus.formatted, NOT_REPORTED);
        assert_eq!(result.capital_adequacy_ratio.formatted, "20.0%");
    }

    #[test]
    fn test_par30_excludes_one_to_thirty_day_bucket() {
        let items = vec![
            make_item(1201, 800.0),
            make_item(1202, 100.0),
            make_item(1203, 40.0),
            make_item(1204, 40.0),
            make_item(1205, 20.0),
            make_item(1250, 50.0),
        ];
        let result = KpiEngine::compute(&items);
        assert!((result.par30.value - 10.0).abs() < 0.001);
        assert!((result.par90.value - 2.0).abs() < 0.001);
        assert!((result.loan_loss_coverage.value - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_capital_adequacy_status_thresholds() {
        // CAR >= 10% → green
        let items_green = vec![make_item(3999, 1000.0), make_item(1999, 9000.0)];
        let r = KpiEngine::compute(&items_green);
        assert_eq!(r.capital_adequacy_ratio.status, Some("green".to_string()));

        // CAR = 9% → amber (>=8 but <10)
        let items_amber = vec![make_item(3999, 900.0), make_item(1999, 10000.0)];
        let r = KpiEngine::compute(&items_amber);
        assert_eq!(r.capital_adequacy_ratio.status, Some("amber".to_string()));

        // CAR = 5% → red
        let items_red = vec![make_item(3999, 500.0), make_item(1999, 10000.0)];
        let r = KpiEngine::compute(&items_red);
        assert_eq!(r.capital_adequacy_ratio.status, Some("red".to_string()));
    }

    #[test]
    fn test_currency_formatting() {
        assert_eq!(KpiEngine::format_currency(1_500_000_000.0), "$1.50B");
        assert_eq!(KpiEngine::format_currency(6_400_000.0), "$6.4M");
        assert_eq!(KpiEngine::format_currency(420_000.0), "$420K");
        assert_eq!(KpiEngine::format_currency(500.0), "$500");
        assert_eq!(KpiEngine::format_currency(-2_000_000.0), "-$2.0M");
    }

    #[test]
    fn test_division_by_zero_guard() {
        // All codes zero → no panics, all ratio KPIs = 0
        let result = KpiEngine::compute(&[]);
        assert_eq!(result.par30.value, 0.0);
        assert_eq!(result.roa.value, 0.0);
        assert_eq!(result.operational_self_sufficiency.value, 0.0);
        assert_eq!(result.net_interest_margin.value, 0.0);
    }

    #[test]
    fn test_roa_computed_correctly() {
        // Net surplus = 300, Total assets = 10_000 → ROA = 3.0%
        let items = vec![make_item(6999, 300.0), make_item(1999, 10_000.0)];
        let r = KpiEngine::compute(&items);
        assert!((r.roa.value - 3.0).abs() < 0.001);
        assert_eq!(r.roa.status, Some("green".to_string()));
    }

    #[test]
    fn test_to_vec_contains_all_kpis() {
        let result = KpiEngine::compute(&[]);
        let v = result.to_vec();
        assert_eq!(v.len(), 18);
        // All KPI names are unique
        let names: std::collections::HashSet<_> = v.iter().map(|k| &k.name).collect();
        assert_eq!(names.len(), 18);
    }

    #[test]
    fn test_get_by_name_returns_correct_kpi() {
        let items = vec![make_item(1999, 5000.0), make_item(3999, 500.0)];
        let result = KpiEngine::compute(&items);
        let car = result.get_by_name("capital_adequacy_ratio");
        assert!(car.is_some());
        assert!((car.unwrap().value - 10.0).abs() < 0.001);
        assert!(result.get_by_name("nonexistent").is_none());
    }

    #[test]
    fn test_compute_filters_latest_month() {
        let mut item1_m1 = make_item(1999, 1000.0);
        item1_m1.month = 1;
        let mut item2_m1 = make_item(3999, 100.0);
        item2_m1.month = 1;

        let mut item1_m2 = make_item(1999, 5000.0);
        item1_m2.month = 2;
        let mut item2_m2 = make_item(3999, 500.0);
        item2_m2.month = 2;

        let items = vec![item1_m1, item2_m1, item1_m2, item2_m2];
        let result = KpiEngine::compute(&items);

        assert_eq!(result.total_assets.value, 5000.0);
        assert_eq!(result.total_equity.value, 500.0);

        let car = result.get_by_name("capital_adequacy_ratio").unwrap();
        assert!((car.value - 10.0).abs() < 0.001);
    }
}
