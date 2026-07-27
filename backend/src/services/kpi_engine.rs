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

pub struct KpiEngine;

impl KpiEngine {
    /// Compute all financial KPIs from balance sheet line items.
    /// Filters to only use items matching the latest month present in the input.
    pub fn compute(line_items: &[LineItemModel]) -> ComputedKpiSet {
        let max_month = line_items.iter().map(|item| item.month).max().unwrap_or(0);
        let filtered_items: Vec<_> = line_items
            .iter()
            .filter(|item| item.month == max_month)
            .cloned()
            .collect();
        let items = &filtered_items;

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
        let arrears_30_plus = glp_arrears_31_60 + glp_arrears_61_90 + glp_npl + glp_arrears_1_30;
        let provisions = {
            let parent = Self::sum_code(items, 1250);
            if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_codes(items, &[1251, 1252])
            }
        };
        let net_lp = gross_lp - provisions;

        let total_assets = {
            let parent = Self::sum_code(items, 1999);
            if parent.abs() > 0.001 {
                parent
            } else {
                liquid_assets + gross_lp + provisions + Self::sum_code(items, 1300)
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

        let financial_income = Self::sum_codes(items, &[4101, 4102]);
        let other_income = Self::sum_code(items, 4201);
        let total_income = {
            let parent = Self::sum_code(items, 4999);
            if parent.abs() > 0.001 {
                parent
            } else {
                financial_income + other_income
            }
        };

        let financial_expenses = Self::sum_codes(items, &[5101, 5102]);
        let operating_expenses = Self::sum_codes(items, &[5201, 5202, 5203, 5204]);
        let credit_loss_expense = Self::sum_code(items, 5301);
        let total_expenses = {
            let parent = Self::sum_code(items, 5999);
            if parent.abs() > 0.001 {
                parent
            } else {
                financial_expenses + operating_expenses + credit_loss_expense
            }
        };

        let net_surplus = {
            let parent = Self::sum_code(items, 6999);
            if parent.abs() > 0.001 {
                parent
            } else {
                Self::sum_code(items, 3302)
            }
        };

        // ── Compute ratios (guard all divisions) ─────────────────────────────
        let par30_val = Self::safe_div(arrears_30_plus, gross_lp) * 100.0;
        let par90_val = Self::safe_div(glp_npl, gross_lp) * 100.0;
        let llc_val = Self::safe_div(provisions, arrears_30_plus) * 100.0;
        let roa_val = Self::safe_div(net_surplus, total_assets) * 100.0;
        let roe_val = Self::safe_div(net_surplus, total_equity) * 100.0;
        let oer_val = Self::safe_div(operating_expenses, total_assets) * 100.0;
        let car_val = Self::safe_div(total_equity, total_assets) * 100.0;
        let lfr_val = Self::safe_div(liquid_assets, total_assets) * 100.0;
        let oss_val = Self::safe_div(total_income, total_expenses) * 100.0;
        let nim_val = Self::safe_div(financial_income - financial_expenses, total_assets) * 100.0;
        let dtl_val = Self::safe_div(member_deposits, gross_lp) * 100.0;

        ComputedKpiSet {
            total_assets: Self::kpi_currency(
                total_assets,
                "total_assets",
                "Total value of all assets owned by the cooperative",
                None,
                None,
            ),
            gross_loan_portfolio: Self::kpi_currency(
                gross_lp,
                "gross_loan_portfolio",
                "Total outstanding loan balance including arrears",
                None,
                None,
            ),
            net_loan_portfolio: Self::kpi_currency(
                net_lp,
                "net_loan_portfolio",
                "Gross Loan Portfolio minus Loan Loss Provisions",
                None,
                None,
            ),
            total_member_deposits: Self::kpi_currency(
                member_deposits,
                "total_member_deposits",
                "Total member savings and deposits",
                None,
                None,
            ),
            total_equity: Self::kpi_currency(
                total_equity,
                "total_equity",
                "Total institutional capital and reserves",
                None,
                None,
            ),
            net_surplus: Self::kpi_currency(
                net_surplus,
                "net_surplus",
                "Net income after all expenses (Total Income - Total Expenses)",
                None,
                None,
            ),
            par30: Self::kpi_percent(
                par30_val,
                "par30",
                "Portfolio at Risk >30 days (loans in arrears >30 days / gross loan portfolio)",
                Some(Self::status_lower_better(par30_val, 5.0, 10.0)),
                Some(5.0),
            ),
            par90: Self::kpi_percent(
                par90_val,
                "par90",
                "Portfolio at Risk >90 days",
                Some(Self::status_lower_better(par90_val, 2.0, 5.0)),
                Some(2.0),
            ),
            npl_ratio: Self::kpi_percent(
                par90_val,
                "npl_ratio",
                "Non-Performing Loans (>90 days) as percentage of gross portfolio",
                Some(Self::status_lower_better(par90_val, 2.0, 5.0)),
                Some(2.0),
            ),
            loan_loss_coverage: Self::kpi_percent(
                llc_val,
                "loan_loss_coverage",
                "Loan loss provisions / Loans in arrears >30 days",
                Some(Self::status_higher_better(llc_val, 100.0, 80.0)),
                Some(100.0),
            ),
            roa: Self::kpi_percent(
                roa_val,
                "roa",
                "Return on Assets (Net Surplus / Total Assets)",
                Some(Self::status_higher_better(roa_val, 3.0, 1.0)),
                Some(3.0),
            ),
            roe: Self::kpi_percent(
                roe_val,
                "roe",
                "Return on Equity (Net Surplus / Total Equity)",
                Some(Self::status_higher_better(roe_val, 8.0, 4.0)),
                Some(8.0),
            ),
            operating_expense_ratio: Self::kpi_percent(
                oer_val,
                "operating_expense_ratio",
                "Operating Expenses / Total Assets",
                Some(Self::status_lower_better(oer_val, 5.0, 8.0)),
                Some(5.0),
            ),
            capital_adequacy_ratio: Self::kpi_percent(
                car_val,
                "capital_adequacy_ratio",
                "Total Equity / Total Assets",
                Some(Self::status_higher_better(car_val, 10.0, 8.0)),
                Some(10.0),
            ),
            liquid_funds_ratio: Self::kpi_percent(
                lfr_val,
                "liquid_funds_ratio",
                "Liquid Assets / Total Assets",
                Some(Self::status_higher_better(lfr_val, 15.0, 10.0)),
                Some(15.0),
            ),
            operational_self_sufficiency: Self::kpi_percent(
                oss_val,
                "operational_self_sufficiency",
                "Total Income / Total Operating Expenses",
                Some(Self::status_higher_better(oss_val, 110.0, 100.0)),
                Some(110.0),
            ),
            net_interest_margin: Self::kpi_percent(
                nim_val,
                "net_interest_margin",
                "(Financial Income - Financial Expenses) / Total Assets",
                None,
                None,
            ),
            deposits_to_loans: Self::kpi_percent(
                dtl_val,
                "deposits_to_loans",
                "Total Member Deposits / Gross Loan Portfolio",
                None,
                None,
            ),
        }
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

    /// Safe division — returns 0.0 when denominator is zero or near-zero.
    #[inline]
    fn safe_div(numerator: f64, denominator: f64) -> f64 {
        if denominator.abs() < f64::EPSILON {
            0.0
        } else {
            numerator / denominator
        }
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
            format!("{sign}${:.2}B", abs / 1_000_000_000.0)
        } else if abs >= 1_000_000.0 {
            format!("{sign}${:.1}M", abs / 1_000_000.0)
        } else if abs >= 1_000.0 {
            format!("{sign}${:.0}K", abs / 1_000.0)
        } else {
            format!("{sign}${abs:.0}")
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
        value: f64,
        name: &str,
        description: &str,
        status: Option<String>,
        benchmark: Option<f64>,
    ) -> KpiValue {
        KpiValue {
            name: name.to_string(),
            value,
            formatted: format!("{:.1}%", value),
            unit: "percent".to_string(),
            status,
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
        // GLP: 1000 performing + 100 arrears (31-60) + 50 npl = 1150
        // arrears_30_plus = 100 + 0 + 0 + 50 = 150 (codes 1202+1203+1204+1205)
        // par30 = 150 / 1150 * 100 = 13.04%
        let items = vec![
            make_item(1201, 1000.0),
            make_item(1203, 100.0),
            make_item(1205, 50.0),
            make_item(1999, 5000.0), // total assets
            make_item(3999, 1000.0), // equity
            make_item(6999, 100.0),  // net surplus
        ];
        let result = KpiEngine::compute(&items);
        let expected = (1202_f64 + 100.0 + 0.0 + 50.0) / 1150.0 * 100.0;
        // codes 1202=0, 1203=100, 1204=0, 1205=50 → arrears_30_plus=150
        let par30 = 150.0 / 1150.0 * 100.0;
        assert!(
            (result.par30.value - par30).abs() < 0.001,
            "PAR30 was {}",
            result.par30.value
        );
        let _ = expected; // suppress warning
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
