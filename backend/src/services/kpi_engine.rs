use serde::Serialize;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::collections::HashMap;

use crate::entities::{member, savings_account, loan, fixed_deposit};
use crate::entities::enums::{MemberStatus, Gender, AgeGroup, UrbanRural, LoanStatus, DpdCategory, FdStatus};
use crate::services::abnormality_detector::calculations::{ValuesMap, sum_codes};

#[derive(Debug, Clone, Serialize, Default)]
pub struct KpiResult {
    pub value: f64,
    pub formatted: String,
    pub unit: String,
    pub description: String,
    pub status: Option<String>,
    pub benchmark: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FinancialKPIs {
    pub total_assets: KpiResult,
    pub gross_loan_portfolio: KpiResult,
    pub net_loan_portfolio: KpiResult,
    pub total_member_deposits: KpiResult,
    pub total_equity: KpiResult,
    pub par30: KpiResult,
    pub par60: KpiResult,
    pub par90: KpiResult,
    pub npl_ratio: KpiResult,
    pub loan_loss_coverage: KpiResult,
    pub roa: KpiResult,
    pub roe: KpiResult,
    pub financial_revenue_ratio: KpiResult,
    pub financial_expense_ratio: KpiResult,
    pub operating_expense_ratio: KpiResult,
    pub cost_of_funds: KpiResult,
    pub yield_on_portfolio: KpiResult,
    pub net_interest_margin: KpiResult,
    pub operational_self_sufficiency: KpiResult,
    pub current_ratio: KpiResult,
    pub cash_ratio: KpiResult,
    pub capital_adequacy_ratio: KpiResult,
    pub debt_to_equity: KpiResult,
    pub liquid_funds_ratio: KpiResult,
    pub deposits_to_loans: KpiResult,
    pub savings_to_assets: KpiResult,
    pub voluntary_savings_ratio: KpiResult,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct MembershipKPIs {
    pub total_members: KpiResult,
    pub dormancy_rate: KpiResult,
    pub exit_rate: KpiResult,
    pub active_members_ratio: KpiResult,
    pub agm_participation_rate: KpiResult,
    pub women_members_percent: KpiResult,
    pub youth_members_percent: KpiResult,
    pub rural_members_percent: KpiResult,
    pub women_in_governance_percent: KpiResult,
    pub youth_in_governance_percent: KpiResult,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct SavingsKPIs {
    pub savings_penetration: KpiResult,
    pub active_savers_ratio: KpiResult,
    pub regular_savers_ratio: KpiResult,
    pub dormant_savings_accounts_percent: KpiResult,
    pub zero_balance_accounts_percent: KpiResult,
    pub stable_balance_ratio: KpiResult,
    pub high_withdrawal_frequency_percent: KpiResult,
    pub emergency_withdrawal_incidence: KpiResult,
    pub average_interest_rate: KpiResult,
    pub account_concentration: KpiResult,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct LoanKPIs {
    pub credit_penetration: KpiResult,
    pub on_time_repayment_ratio: KpiResult,
    pub loans_in_arrears_percent: KpiResult,
    pub restructured_loans_ratio: KpiResult,
    pub women_borrowers_percent: KpiResult,
    pub youth_borrowers_percent: KpiResult,
    pub rural_borrowers_percent: KpiResult,
    pub average_loan_size: KpiResult,
    pub loans_per_member: KpiResult,
    pub average_interest_rate: KpiResult,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FixedDepositKPIs {
    pub fd_penetration: KpiResult,
    pub long_term_fd_ratio: KpiResult,
    pub fd_rollover_rate: KpiResult,
    pub early_withdrawal_rate: KpiResult,
    pub concentration_risk: KpiResult,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct CompleteKPIReport {
    pub financial: FinancialKPIs,
    pub membership: MembershipKPIs,
    pub savings: SavingsKPIs,
    pub loans: LoanKPIs,
    pub fixed_deposits: FixedDepositKPIs,
}

// Formatting helpers
fn format_percent(val: f64) -> String {
    format!("{:.1}%", val)
}

fn format_currency(val: f64) -> String {
    if val >= 1e9 {
        format!("${:.2}B", val / 1e9)
    } else if val >= 1e6 {
        format!("${:.1}M", val / 1e6)
    } else if val >= 1e3 {
        format!("${:.0}K", val / 1e3)
    } else {
        format!("${:.0}", val)
    }
}

fn format_number(val: f64) -> String {
    if val >= 1e6 {
        format!("{:.2}M", val / 1e6)
    } else if val >= 1e3 {
        format!("{:.1}K", val / 1e3)
    } else {
        format!("{:.0}", val)
    }
}

fn get_status_higher_better(val: f64, target: f64, warning: f64) -> String {
    if val >= target {
        "green".to_string()
    } else if val >= warning {
        "amber".to_string()
    } else {
        "red".to_string()
    }
}

fn get_status_lower_better(val: f64, target: f64, warning: f64) -> String {
    if val <= target {
        "green".to_string()
    } else if val <= warning {
        "amber".to_string()
    } else {
        "red".to_string()
    }
}

// Financial KPI Engine
pub fn calculate_financial_kpis(v: &ValuesMap) -> FinancialKPIs {
    let get_or_compute = |code: i32| -> f64 {
        if let Some(val) = v.get(&code) {
            return val.to_f64().unwrap_or(0.0);
        }
        match code {
            1100 => sum_codes(v, &[1101, 1102, 1103, 1104]).to_f64().unwrap_or(0.0),
            1200 => sum_codes(v, &[1201, 1202, 1203, 1204, 1205]).to_f64().unwrap_or(0.0),
            1250 => sum_codes(v, &[1251, 1252]).to_f64().unwrap_or(0.0),
            1300 => {
                let dep = v.get(&1304).copied().unwrap_or(Decimal::ZERO);
                let dep_val = if dep > Decimal::ZERO { -dep } else { dep };
                let rest = sum_codes(v, &[1301, 1302, 1303, 1305]);
                (rest + dep_val).to_f64().unwrap_or(0.0)
            }
            2100 => sum_codes(v, &[2101, 2102, 2103]).to_f64().unwrap_or(0.0),
            2200 => sum_codes(v, &[2201, 2202]).to_f64().unwrap_or(0.0),
            2300 => sum_codes(v, &[2301, 2302, 2303]).to_f64().unwrap_or(0.0),
            3100 => sum_codes(v, &[3101, 3102]).to_f64().unwrap_or(0.0),
            3200 => sum_codes(v, &[3201, 3202, 3203]).to_f64().unwrap_or(0.0),
            3300 => sum_codes(v, &[3301, 3302]).to_f64().unwrap_or(0.0),
            _ => 0.0,
        }
    };

    let get_zero_f64 = |code: i32| -> f64 {
        v.get(&code).and_then(|x| x.to_f64()).unwrap_or(0.0)
    };

    let total_assets = get_zero_f64(1999);
    let gross_lp = get_or_compute(1200);
    let provisions = get_or_compute(1250);
    let net_lp = gross_lp - provisions;
    let total_deposits = get_or_compute(2100);

    let total_equity = if let Some(eq) = v.get(&3999) {
        eq.to_f64().unwrap_or(0.0)
    } else {
        get_or_compute(3100) + get_or_compute(3200) + get_or_compute(3300)
    };

    let financial_income = get_zero_f64(4101) + get_zero_f64(4102);
    let other_income = get_zero_f64(4201);
    let total_income = financial_income + other_income;

    let financial_expenses = get_zero_f64(5101) + get_zero_f64(5102);
    let operating_expenses = get_zero_f64(5201) + get_zero_f64(5202) + get_zero_f64(5203) + get_zero_f64(5204);
    let provision_expense = get_zero_f64(5301);
    let total_expenses = financial_expenses + operating_expenses + provision_expense;

    let net_surplus = total_income - total_expenses;

    let avg_assets = if total_assets > 0.0 { total_assets } else { 1.0 };
    let avg_equity = if total_equity > 0.0 { total_equity } else { 1.0 };
    let avg_gross_lp = if gross_lp > 0.0 { gross_lp } else { 1.0 };
    let avg_deposits = if total_deposits > 0.0 { total_deposits } else { 1.0 };

    let liquid_assets = get_zero_f64(1101) + get_zero_f64(1102) + get_zero_f64(1103);
    let cash = get_zero_f64(1101) + get_zero_f64(1102);
    let short_term_liabilities = get_zero_f64(2201) + get_zero_f64(2301) + get_zero_f64(2302);
    let arreas30_plus = get_zero_f64(1203) + get_zero_f64(1204) + get_zero_f64(1205);
    let arrears60_plus = get_zero_f64(1204) + get_zero_f64(1205);
    let npl = get_zero_f64(1205);

    // Helper to build KPIResult
    let make_kpi = |val: f64, unit: &str, desc: &str, benchmark: Option<f64>, status: Option<String>| -> KpiResult {
        let formatted = match unit {
            "percent" => format_percent(val),
            "currency" => format_currency(val),
            "ratio" => format!("{:.2}x", val),
            _ => format_number(val),
        };
        KpiResult {
            value: val,
            formatted,
            unit: unit.to_string(),
            description: desc.to_string(),
            benchmark,
            status,
        }
    };

    let par30_val = if gross_lp > 0.0 { (arreas30_plus / gross_lp) * 100.0 } else { 0.0 };
    let par60_val = if gross_lp > 0.0 { (arrears60_plus / gross_lp) * 100.0 } else { 0.0 };
    let par90_val = if gross_lp > 0.0 { (npl / gross_lp) * 100.0 } else { 0.0 };
    let loan_loss_val = if arreas30_plus > 0.0 { (provisions / arreas30_plus) * 100.0 } else { 100.0 };

    let roa_val = (net_surplus / avg_assets) * 100.0;
    let roe_val = (net_surplus / avg_equity) * 100.0;
    let oer_val = (operating_expenses / avg_assets) * 100.0;
    let oss_val = if total_expenses > 0.0 { (total_income / total_expenses) * 100.0 } else { 0.0 };

    let current_ratio_val = if short_term_liabilities > 0.0 { liquid_assets / short_term_liabilities } else { liquid_assets };
    let cash_ratio_val = if short_term_liabilities > 0.0 { cash / short_term_liabilities } else { cash };
    let car_val = if total_assets > 0.0 { (total_equity / total_assets) * 100.0 } else { 0.0 };
    let debt_to_equity_val = if total_equity > 0.0 { (get_zero_f64(2999) / total_equity) } else { get_zero_f64(2999) };
    let lfr_val = if total_assets > 0.0 { (liquid_assets / total_assets) * 100.0 } else { 0.0 };

    FinancialKPIs {
        total_assets: make_kpi(total_assets, "currency", "Total value of all assets owned by the cooperative", None, None),
        gross_loan_portfolio: make_kpi(gross_lp, "currency", "Total outstanding loan balance including arrears", None, None),
        net_loan_portfolio: make_kpi(net_lp, "currency", "Gross Loan Portfolio minus Loan Loss Provisions", None, None),
        total_member_deposits: make_kpi(total_deposits, "currency", "Total member savings and deposits", None, None),
        total_equity: make_kpi(total_equity, "currency", "Total institutional capital and reserves", None, None),
        par30: make_kpi(par30_val, "percent", "Portfolio at Risk >30 days", Some(5.0), Some(get_status_lower_better(par30_val, 5.0, 10.0))),
        par60: make_kpi(par60_val, "percent", "Portfolio at Risk >60 days", Some(3.0), Some(get_status_lower_better(par60_val, 3.0, 5.0))),
        par90: make_kpi(par90_val, "percent", "Portfolio at Risk >90 days", Some(2.0), Some(get_status_lower_better(par90_val, 2.0, 5.0))),
        npl_ratio: make_kpi(par90_val, "percent", "Non-Performing Loans (>90 days) as percentage of gross portfolio", None, None),
        loan_loss_coverage: make_kpi(loan_loss_val, "percent", "Loan loss provisions / Loans in arrears >30 days", Some(100.0), Some(get_status_higher_better(loan_loss_val, 100.0, 80.0))),
        roa: make_kpi(roa_val, "percent", "Return on Assets (Net Surplus / Average Total Assets)", Some(3.0), Some(get_status_higher_better(roa_val, 3.0, 1.0))),
        roe: make_kpi(roe_val, "percent", "Return on Equity (Net Surplus / Average Equity)", Some(8.0), Some(get_status_higher_better(roe_val, 8.0, 4.0))),
        financial_revenue_ratio: make_kpi((financial_income / avg_assets) * 100.0, "percent", "Financial Income / Average Total Assets", None, None),
        financial_expense_ratio: make_kpi((financial_expenses / avg_assets) * 100.0, "percent", "Financial Expenses / Average Total Assets", None, None),
        operating_expense_ratio: make_kpi(oer_val, "percent", "Operating Expenses / Average Total Assets", Some(5.0), Some(get_status_lower_better(oer_val, 5.0, 8.0))),
        cost_of_funds: make_kpi((get_zero_f64(5101) / avg_deposits) * 100.0, "percent", "Interest Expense on Deposits / Average Member Deposits", None, None),
        yield_on_portfolio: make_kpi((get_zero_f64(4101) / avg_gross_lp) * 100.0, "percent", "Interest Income on Loans / Average Gross Loan Portfolio", None, None),
        net_interest_margin: make_kpi(((financial_income - financial_expenses) / avg_assets) * 100.0, "percent", "(Financial Income - Financial Expenses) / Average Assets", None, None),
        operational_self_sufficiency: make_kpi(oss_val, "percent", "Operating Income / Operating Expenses", Some(110.0), Some(get_status_higher_better(oss_val, 110.0, 100.0))),
        current_ratio: make_kpi(current_ratio_val, "ratio", "Liquid Assets / Short-term Liabilities", Some(1.0), Some(get_status_higher_better(current_ratio_val, 1.0, 0.8))),
        cash_ratio: make_kpi(cash_ratio_val, "ratio", "Cash + Current Accounts / Short-term Liabilities", Some(0.5), Some(get_status_higher_better(cash_ratio_val, 0.5, 0.3))),
        capital_adequacy_ratio: make_kpi(car_val, "percent", "Total Equity / Total Assets", Some(10.0), Some(get_status_higher_better(car_val, 10.0, 8.0))),
        debt_to_equity: make_kpi(debt_to_equity_val, "ratio", "Total Liabilities / Total Equity", Some(3.0), Some(get_status_lower_better(debt_to_equity_val, 3.0, 5.0))),
        liquid_funds_ratio: make_kpi(lfr_val, "percent", "Liquid Assets / Total Assets", Some(15.0), Some(get_status_higher_better(lfr_val, 15.0, 10.0))),
        deposits_to_loans: make_kpi(if gross_lp > 0.0 { (total_deposits / gross_lp) * 100.0 } else { 0.0 }, "percent", "Total Deposits / Gross Loan Portfolio", None, None),
        savings_to_assets: make_kpi(if total_assets > 0.0 { (total_deposits / total_assets) * 100.0 } else { 0.0 }, "percent", "Member Deposits / Total Assets", None, None),
        voluntary_savings_ratio: make_kpi(if total_deposits > 0.0 { (get_zero_f64(2101) / total_deposits) * 100.0 } else { 0.0 }, "percent", "Voluntary Savings / Total Deposits", None, None),
    }
}

// Membership KPI Engine
pub fn calculate_membership_kpis(members: &[member::Model], prev_count: Option<usize>) -> MembershipKPIs {
    let total = members.len() as f64;
    let active = members.iter().filter(|m| m.status == MemberStatus::Active).count() as f64;
    let dormant = members.iter().filter(|m| m.status == MemberStatus::Dormant).count() as f64;
    let exited = members.iter().filter(|m| m.status == MemberStatus::Exited).count() as f64;
    let women = members.iter().filter(|m| m.gender == Gender::Female).count() as f64;
    let youth = members.iter().filter(|m| m.age_group == AgeGroup::Between18And35).count() as f64;
    let rural = members.iter().filter(|m| m.urban_rural == UrbanRural::Rural).count() as f64;
    let agm_attended = members.iter().filter(|m| m.agm_attendance).count() as f64;

    let board_total = members.iter().filter(|m| m.leadership_role.is_some()).count() as f64;
    let board_women = members.iter().filter(|m| m.leadership_role.is_some() && m.gender == Gender::Female).count() as f64;
    let board_youth = members.iter().filter(|m| m.leadership_role.is_some() && m.age_group == AgeGroup::Between18And35).count() as f64;

    let total_active_exited = total;
    let dormancy_rate = if total_active_exited > 0.0 { (dormant / total_active_exited) * 100.0 } else { 0.0 };
    let exit_rate = if total_active_exited > 0.0 { (exited / total_active_exited) * 100.0 } else { 0.0 };
    let active_ratio = if total_active_exited > 0.0 { (active / total_active_exited) * 100.0 } else { 0.0 };
    let agm_rate = if total_active_exited > 0.0 { (agm_attended / total_active_exited) * 100.0 } else { 0.0 };

    let make_kpi = |val: f64, unit: &str, desc: &str, benchmark: Option<f64>, status: Option<String>| -> KpiResult {
        let formatted = match unit {
            "percent" => format_percent(val),
            _ => format!("{:.0}", val),
        };
        KpiResult {
            value: val,
            formatted,
            unit: unit.to_string(),
            description: desc.to_string(),
            benchmark,
            status,
        }
    };

    MembershipKPIs {
        total_members: make_kpi(total, "number", "Total number of registered members", None, None),
        dormancy_rate: make_kpi(dormancy_rate, "percent", "Dormant members / Total members", Some(20.0), Some(get_status_lower_better(dormancy_rate, 20.0, 30.0))),
        exit_rate: make_kpi(exit_rate, "percent", "Exited members / Total members", Some(5.0), Some(get_status_lower_better(exit_rate, 5.0, 10.0))),
        active_members_ratio: make_kpi(active_ratio, "percent", "Active members / Total members", Some(70.0), Some(get_status_higher_better(active_ratio, 70.0, 60.0))),
        agm_participation_rate: make_kpi(agm_rate, "percent", "Members attending AGM / Total members", Some(50.0), Some(get_status_higher_better(agm_rate, 50.0, 30.0))),
        women_members_percent: make_kpi(if total > 0.0 { (women / total) * 100.0 } else { 0.0 }, "percent", "Female members / Total members", None, None),
        youth_members_percent: make_kpi(if total > 0.0 { (youth / total) * 100.0 } else { 0.0 }, "percent", "Youth members (<35) / Total members", None, None),
        rural_members_percent: make_kpi(if total > 0.0 { (rural / total) * 100.0 } else { 0.0 }, "percent", "Rural members / Total members", None, None),
        women_in_governance_percent: make_kpi(if board_total > 0.0 { (board_women / board_total) * 100.0 } else { 0.0 }, "percent", "Women in governance positions / Total board members", None, None),
        youth_in_governance_percent: make_kpi(if board_total > 0.0 { (board_youth / board_total) * 100.0 } else { 0.0 }, "percent", "Youth in governance positions / Total board members", None, None),
    }
}

// Savings KPI Engine
pub fn calculate_savings_kpis(accounts: &[savings_account::Model], total_members: usize) -> SavingsKPIs {
    let total_members_f = total_members as f64;
    let total_accounts = accounts.len() as f64;
    let active_accounts = accounts.iter().filter(|s| s.account_status == "Active").count() as f64;
    let dormant_accounts = accounts.iter().filter(|s| s.account_status == "Dormant").count() as f64;
    let zero_balance = accounts.iter().filter(|s| s.zero_balance_flag).count() as f64;
    let stable_balance = accounts.iter().filter(|s| s.balance_trend == "Stable" || s.balance_trend == "Increasing").count() as f64;
    let high_withdrawal = accounts.iter().filter(|s| s.withdrawal_frequency_category == "High").count() as f64;
    let emergency_withdrawals = accounts.iter().filter(|s| s.emergency_withdrawals_flag).count() as f64;
    let regular_contributors = accounts.iter().filter(|s| s.contribution_frequency == "Monthly" || s.contribution_frequency == "Weekly").count() as f64;

    let total_interest: f64 = accounts.iter().map(|s| s.interest_rate.to_f64().unwrap_or(0.0)).sum();
    let avg_interest = if total_accounts > 0.0 { total_interest / total_accounts } else { 0.0 };

    let total_balance: f64 = accounts.iter().map(|s| s.balance.to_f64().unwrap_or(0.0)).sum();

    // Account concentration (top 10%)
    let mut balances: Vec<f64> = accounts.iter().map(|s| s.balance.to_f64().unwrap_or(0.0)).collect();
    balances.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    let top_10_count = (total_accounts * 0.1).ceil() as usize;
    let top_10_balance: f64 = balances.iter().take(top_10_count).sum();

    let make_kpi = |val: f64, unit: &str, desc: &str, benchmark: Option<f64>, status: Option<String>| -> KpiResult {
        let formatted = match unit {
            "percent" => format_percent(val),
            _ => format!("{:.0}", val),
        };
        KpiResult {
            value: val,
            formatted,
            unit: unit.to_string(),
            description: desc.to_string(),
            benchmark,
            status,
        }
    };

    let penetration = if total_members_f > 0.0 { (total_accounts / total_members_f) * 100.0 } else { 0.0 };
    let regular_savers = if total_accounts > 0.0 { (regular_contributors / total_accounts) * 100.0 } else { 0.0 };
    let dormant_savers = if total_accounts > 0.0 { (dormant_accounts / total_accounts) * 100.0 } else { 0.0 };

    SavingsKPIs {
        savings_penetration: make_kpi(penetration, "percent", "Members with savings accounts / Total members", Some(70.0), Some(get_status_higher_better(penetration, 70.0, 50.0))),
        active_savers_ratio: make_kpi(if total_accounts > 0.0 { (active_accounts / total_accounts) * 100.0 } else { 0.0 }, "percent", "Active savings accounts / Total savings accounts", None, None),
        regular_savers_ratio: make_kpi(regular_savers, "percent", "Accounts with regular contributions / Total accounts", Some(60.0), Some(get_status_higher_better(regular_savers, 60.0, 40.0))),
        dormant_savings_accounts_percent: make_kpi(dormant_savers, "percent", "Dormant savings accounts / Total savings accounts", Some(20.0), Some(get_status_lower_better(dormant_savers, 20.0, 30.0))),
        zero_balance_accounts_percent: make_kpi(if total_accounts > 0.0 { (zero_balance / total_accounts) * 100.0 } else { 0.0 }, "percent", "Zero-balance accounts / Total savings accounts", None, None),
        stable_balance_ratio: make_kpi(if active_accounts > 0.0 { (stable_balance / active_accounts) * 100.0 } else { 0.0 }, "percent", "Accounts with stable/increasing balance / Active accounts", None, None),
        high_withdrawal_frequency_percent: make_kpi(if total_accounts > 0.0 { (high_withdrawal / total_accounts) * 100.0 } else { 0.0 }, "percent", "Accounts with high withdrawal frequency / Total accounts", None, None),
        emergency_withdrawal_incidence: make_kpi(if total_accounts > 0.0 { (emergency_withdrawals / total_accounts) * 100.0 } else { 0.0 }, "percent", "Accounts with emergency withdrawals / Total accounts", None, None),
        average_interest_rate: make_kpi(avg_interest, "percent", "Average interest rate on savings", None, None),
        account_concentration: make_kpi(if total_balance > 0.0 { (top_10_balance / total_balance) * 100.0 } else { 0.0 }, "percent", "Top 10% accounts balance / Total savings balance", None, None),
    }
}

// Loan KPI Engine
pub fn calculate_loan_kpis(loans: &[loan::Model], total_members: usize, gross_loan_portfolio: f64) -> LoanKPIs {
    let total_members_f = total_members as f64;
    let total_loans = loans.len() as f64;
    let performing_loans = loans.iter().filter(|l| l.loan_status == LoanStatus::Performing).count() as f64;
    let arrears_loans = loans.iter().filter(|l| l.days_past_due_category != DpdCategory::Zero).count() as f64;
    let restructured = loans.iter().filter(|l| l.restructured_loan_flag).count() as f64;
    let women = loans.iter().filter(|l| l.women_borrower_flag).count() as f64;
    let youth = loans.iter().filter(|l| l.youth_borrower_flag).count() as f64;
    let rural = loans.iter().filter(|l| l.rural_borrower_flag).count() as f64;

    let avg_loan_size = if total_loans > 0.0 { gross_loan_portfolio / total_loans } else { 0.0 };
    let total_interest: f64 = loans.iter().map(|l| l.interest_rate.to_f64().unwrap_or(0.0)).sum();
    let avg_interest = if total_loans > 0.0 { total_interest / total_loans } else { 0.0 };

    let make_kpi = |val: f64, unit: &str, desc: &str, benchmark: Option<f64>, status: Option<String>| -> KpiResult {
        let formatted = match unit {
            "percent" => format_percent(val),
            "currency" => format_currency(val),
            "ratio" => format!("{:.2}", val),
            _ => format!("{:.0}", val),
        };
        KpiResult {
            value: val,
            formatted,
            unit: unit.to_string(),
            description: desc.to_string(),
            benchmark,
            status,
        }
    };

    let on_time = if total_loans > 0.0 { (performing_loans / total_loans) * 100.0 } else { 0.0 };
    let arrears_rate = if total_loans > 0.0 { (arrears_loans / total_loans) * 100.0 } else { 0.0 };
    let restruc_rate = if total_loans > 0.0 { (restructured / total_loans) * 100.0 } else { 0.0 };

    LoanKPIs {
        credit_penetration: make_kpi(if total_members_f > 0.0 { (total_loans / total_members_f) * 100.0 } else { 0.0 }, "percent", "Members with active loans / Total members", None, None),
        on_time_repayment_ratio: make_kpi(on_time, "percent", "Performing loans / Active loans", Some(75.0), Some(get_status_higher_better(on_time, 75.0, 60.0))),
        loans_in_arrears_percent: make_kpi(arrears_rate, "percent", "Loans in arrears / Active loans", Some(20.0), Some(get_status_lower_better(arrears_rate, 20.0, 30.0))),
        restructured_loans_ratio: make_kpi(restruc_rate, "percent", "Restructured loans / Active loans", Some(10.0), Some(get_status_lower_better(restruc_rate, 10.0, 15.0))),
        women_borrowers_percent: make_kpi(if total_loans > 0.0 { (women / total_loans) * 100.0 } else { 0.0 }, "percent", "Loans to women / Total loans", None, None),
        youth_borrowers_percent: make_kpi(if total_loans > 0.0 { (youth / total_loans) * 100.0 } else { 0.0 }, "percent", "Loans to youth (<35) / Total loans", None, None),
        rural_borrowers_percent: make_kpi(if total_loans > 0.0 { (rural / total_loans) * 100.0 } else { 0.0 }, "percent", "Loans to rural members / Total loans", None, None),
        average_loan_size: make_kpi(avg_loan_size, "currency", "Average loan amount per borrower", None, None),
        loans_per_member: make_kpi(if total_members_f > 0.0 { total_loans / total_members_f } else { 0.0 }, "ratio", "Total loans / Total members", None, None),
        average_interest_rate: make_kpi(avg_interest, "percent", "Average interest rate on loans", None, None),
    }
}

// Fixed Deposit KPI Engine
pub fn calculate_fd_kpis(fds: &[fixed_deposit::Model], total_members: usize) -> FixedDepositKPIs {
    let total_members_f = total_members as f64;
    let total_fds = fds.len() as f64;
    let long_term_fds = fds.iter().filter(|f| f.tenure_category == "1-3y" || f.tenure_category == ">3y").count() as f64;
    let matured_this_period = fds.iter().filter(|f| f.status == FdStatus::Matured).count() as f64;
    let rolled_over = fds.iter().filter(|f| f.rollover_at_maturity_flag).count() as f64;
    let early_withdrawals = fds.iter().filter(|f| f.early_withdrawal_flag).count() as f64;
    let large_depositors = fds.iter().filter(|f| f.single_depositor_dependency_flag).count() as f64;

    let rollover_rate = if matured_this_period > 0.0 { (rolled_over / matured_this_period) * 100.0 } else { 0.0 };

    let make_kpi = |val: f64, unit: &str, desc: &str, benchmark: Option<f64>, status: Option<String>| -> KpiResult {
        let formatted = match unit {
            "percent" => format_percent(val),
            _ => format!("{:.0}", val),
        };
        KpiResult {
            value: val,
            formatted,
            unit: unit.to_string(),
            description: desc.to_string(),
            benchmark,
            status,
        }
    };

    let penetration = if total_members_f > 0.0 { (total_fds / total_members_f) * 100.0 } else { 0.0 };
    let early_withdrawal_rate = if total_fds > 0.0 { (early_withdrawals / total_fds) * 100.0 } else { 0.0 };

    FixedDepositKPIs {
        fd_penetration: make_kpi(penetration, "percent", "Members with fixed deposits / Total members", Some(20.0), Some(get_status_higher_better(penetration, 20.0, 10.0))),
        long_term_fd_ratio: make_kpi(if total_fds > 0.0 { (long_term_fds / total_fds) * 100.0 } else { 0.0 }, "percent", "Long-term FDs (>1 year) / Total FDs", None, None),
        fd_rollover_rate: make_kpi(rollover_rate, "percent", "FDs rolled over / FDs matured", Some(60.0), Some(get_status_higher_better(rollover_rate, 60.0, 40.0))),
        early_withdrawal_rate: make_kpi(early_withdrawal_rate, "percent", "FDs withdrawn early / Total FDs", Some(15.0), Some(get_status_lower_better(early_withdrawal_rate, 15.0, 25.0))),
        concentration_risk: make_kpi(if total_fds > 0.0 { (large_depositors / total_fds) * 100.0 } else { 0.0 }, "percent", "Large depositor accounts / Total FDs", None, None),
    }
}
