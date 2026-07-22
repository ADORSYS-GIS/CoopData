use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use sea_orm::Set;
use uuid::Uuid;

use crate::api::dto::questionnaire::FinancialQuestionnaireRequest;
use crate::entities::balance_sheet_line_item::ActiveModel as LineItemModel;
use crate::entities::enums::{AccountCategory, AccountingYear, Currency};
use crate::entities::financial_statement::ActiveModel as FinancialStatementModel;

pub fn convert_financial_questionnaire(
    body: &FinancialQuestionnaireRequest,
    submission_id: Uuid,
    cooperative_id: Uuid,
    reporting_year: i32,
) -> (FinancialStatementModel, Vec<LineItemModel>) {
    let fs_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let fs = FinancialStatementModel {
        id: Set(fs_id),
        submission_id: Set(submission_id),
        cooperative_id: Set(cooperative_id),
        reporting_year: Set(reporting_year),
        accounting_year: Set(AccountingYear::Calendar),
        currency: Set(Currency::Szl),
        is_validated: Set(false),
        validation_errors: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let mut items = Vec::new();

    let pfr = &body.periodic_financial_reporting;
    let cap = &body.capitalization;
    let sp = &body.savings_portfolio;
    let lp = &body.loan_portfolio;

    // ── Periodic Financial Reporting ───────────────────────────────────────
    let total_assets = pfr.non_current_assets + pfr.total_current_assets;
    items.push(make_line_item(
        fs_id,
        Some(1999),
        "Total Assets",
        AccountCategory::Assets,
        "",
        total_assets,
    ));

    let total_liabilities = pfr.current_liabilities + pfr.long_term_liabilities;
    items.push(make_line_item(
        fs_id,
        Some(2999),
        "Total Liabilities",
        AccountCategory::Liabilities,
        "",
        total_liabilities,
    ));

    items.push(make_line_item(
        fs_id,
        Some(3999),
        "Total Equity",
        AccountCategory::Equity,
        "",
        pfr.total_equity,
    ));

    items.push(make_line_item(
        fs_id,
        Some(4101),
        "Financial Income",
        AccountCategory::Income,
        "",
        pfr.current_total_income,
    ));

    items.push(make_line_item(
        fs_id,
        Some(5999),
        "Total Expenses",
        AccountCategory::Expenses,
        "",
        pfr.current_expenditure,
    ));

    items.push(make_line_item(
        fs_id,
        Some(6999),
        "Net Surplus",
        AccountCategory::Surplus,
        "",
        pfr.current_net_income,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1303),
        "Fixed Assets",
        AccountCategory::Assets,
        "non_current",
        pfr.non_current_assets,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1100),
        "Current Assets",
        AccountCategory::Assets,
        "current",
        pfr.total_current_assets,
    ));

    items.push(make_line_item(
        fs_id,
        Some(2100),
        "Current Liabilities",
        AccountCategory::Liabilities,
        "current",
        pfr.current_liabilities,
    ));

    items.push(make_line_item(
        fs_id,
        Some(2200),
        "Long-term Liabilities",
        AccountCategory::Liabilities,
        "long_term",
        pfr.long_term_liabilities,
    ));

    // ── Capitalization ─────────────────────────────────────────────────────
    let total_share_capital = cap.total_share_capital_male + cap.total_share_capital_female;
    items.push(make_line_item(
        fs_id,
        Some(3101),
        "Share Capital",
        AccountCategory::Equity,
        "share_capital",
        total_share_capital,
    ));

    items.push(make_line_item(
        fs_id,
        Some(2201),
        "Borrowed Funds",
        AccountCategory::Liabilities,
        "borrowings",
        cap.borrowed_funds,
    ));

    items.push(make_line_item(
        fs_id,
        Some(4201),
        "Donations & Grants",
        AccountCategory::Income,
        "other_income",
        cap.donations_grants,
    ));

    items.push(make_line_item(
        fs_id,
        Some(3201),
        "Statutory Reserves",
        AccountCategory::Equity,
        "reserves",
        cap.accumulated_statutory_reserves_book_value,
    ));

    items.push(make_line_item(
        fs_id,
        Some(3301),
        "Retained Earnings",
        AccountCategory::Equity,
        "retained_earnings",
        cap.retained_earnings,
    ));

    // ── Savings Portfolio ──────────────────────────────────────────────────
    let total_savings = sp.total_savings_male + sp.total_savings_female;
    items.push(make_line_item(
        fs_id,
        Some(2101),
        "Member Savings Deposits",
        AccountCategory::Liabilities,
        "member_deposits",
        total_savings,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1102),
        "Cash at Bank",
        AccountCategory::Assets,
        "cash",
        sp.invested_in_bank,
    ));

    let total_investments = sp.invested_in_shares + sp.other_investments;
    items.push(make_line_item(
        fs_id,
        Some(1104),
        "Short-term Investments",
        AccountCategory::Assets,
        "investments",
        total_investments,
    ));

    // ── Loan Portfolio ─────────────────────────────────────────────────────
    let total_outstanding =
        lp.outstanding_value_male + lp.outstanding_value_female + lp.outstanding_value_coops;
    items.push(make_line_item(
        fs_id,
        Some(1201),
        "Performing Loans",
        AccountCategory::Assets,
        "loans",
        total_outstanding,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1202),
        "Arrears 1-30 Days",
        AccountCategory::Assets,
        "arrears",
        lp.delinquent_value_0_30_days,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1205),
        "Non-Performing Loans",
        AccountCategory::Assets,
        "npl",
        lp.delinquent_value_31_365_days,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1251),
        "General Provision",
        AccountCategory::Assets,
        "provisions",
        lp.provision_0_30_days,
    ));

    items.push(make_line_item(
        fs_id,
        Some(1252),
        "Specific Provision",
        AccountCategory::Assets,
        "provisions",
        lp.provision_31_365_days,
    ));

    items.push(make_line_item(
        fs_id,
        Some(5301),
        "Credit Loss Expense",
        AccountCategory::Expenses,
        "loan_losses",
        lp.written_off_value,
    ));

    let total_fees = lp.fees_stationery
        + lp.fees_application
        + lp.fees_loan_protection
        + lp.fees_penalties
        + lp.fees_others;
    items.push(make_line_item(
        fs_id,
        Some(4102),
        "Fees & Commissions",
        AccountCategory::Income,
        "fee_income",
        total_fees,
    ));

    // ── Activities Income (summed) ─────────────────────────────────────────
    let activity_income: f64 = body
        .other_activities_income
        .iter()
        .map(|a| a.annual_income)
        .sum();
    let activity_expenditure: f64 = body
        .other_activities_income
        .iter()
        .map(|a| a.annual_expenditure)
        .sum();
    let activity_net: f64 = body
        .other_activities_income
        .iter()
        .map(|a| a.net_profit)
        .sum();

    if activity_income > 0.0 {
        items.push(make_line_item(
            fs_id,
            Some(4101),
            "Other Activities Income",
            AccountCategory::Income,
            "other_income",
            activity_income,
        ));
    }
    if activity_expenditure > 0.0 {
        items.push(make_line_item(
            fs_id,
            Some(5101),
            "Other Activities Expenditure",
            AccountCategory::Expenses,
            "other_expenses",
            activity_expenditure,
        ));
    }
    if activity_net != 0.0 {
        items.push(make_line_item(
            fs_id,
            None,
            "Other Activities Net",
            AccountCategory::Surplus,
            "other",
            activity_net,
        ));
    }

    (fs, items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::dto::questionnaire::*;

    fn sample_financial_questionnaire(submission_id: Uuid) -> FinancialQuestionnaireRequest {
        FinancialQuestionnaireRequest {
            submission_id,
            leadership_and_management: LeadershipAndManagement {
                board_members_male: 5, board_members_female: 2,
                exec_committee_male: 3, exec_committee_female: 1,
                credit_committee_male: 2, credit_committee_female: 0,
                education_committee_male: 1, education_committee_female: 1,
                supervisory_committee_male: 2, supervisory_committee_female: 1,
                chair_education: "degree".into(), vice_chair_education: "diploma".into(),
                treasurer_education: "degree".into(), secretary_education: "diploma".into(),
                staff_manager_male: 1, staff_manager_female: 0,
                staff_ass_manager_male: 2, staff_ass_manager_female: 0,
                staff_acc_male: 1, staff_acc_female: 2,
                staff_other_mgmt_male: 0, staff_other_mgmt_female: 1,
                staff_support_male: 3, staff_support_female: 2,
                manager_academic_level: "degree".into(), manager_coop_training_level: "advanced".into(),
                members_trained_last_year: 50, leaders_trained_last_year: 10, staff_trained_last_year: 5,
                training_sponsor: "government".into(), training_quality_rating: "good".into(),
                member_training_needs: vec!["finance".into()], leader_training_needs: vec!["governance".into()],
                staff_training_needs: vec!["accounting".into()], willing_to_cover_training_cost_pct: 50.0,
                registered_members_male: 300, registered_members_female: 200,
                active_members_male: 250, active_members_female: 150,
                active_members_youth_17_under: 20, active_members_18_25: 80,
                active_members_26_35: 120, active_members_36_60: 140,
                active_members_61_plus: 40,
                society_status: "registered".into(),
                dormant_members_male: 30, dormant_members_female: 20,
                dormancy_reasons: vec!["migration".into()], dormancy_effect: "low".into(),
                management_tools: vec!["software".into()], governance_tools: vec!["charter".into()],
                agm_up_to_date: true, agm_arrears_months: None, agm_arrears_reasons: None,
                agm_attendance_male: 100, agm_attendance_female: 80,
                last_audit_date: Some("2025-12-31".into()), last_inspection_date: None,
                last_mgmt_report_date: None, last_budget_date: None,
                last_committee_profile_date: None, last_audit_firm: Some("PwC".into()),
                financial_products: vec!["savings".into(), "loans".into()],
                non_financial_products: vec!["training".into()],
            },
            capitalization: Capitalization {
                share_nominal_value: 100.0, share_capital_contribution_per_member: 500.0,
                total_share_capital_male: 150000.0, total_share_capital_female: 100000.0,
                borrowed_funds: 50000.0, donations_grants: 20000.0,
                accumulated_statutory_reserves_book_value: 75000.0,
                actual_accumulated_statutory_reserves: 60000.0,
                retained_earnings: 25000.0,
            },
            savings_portfolio: FinancialSavingsPortfolio {
                depositors_male: 200, depositors_female: 120,
                total_savings_male: 800000.0, total_savings_female: 500000.0,
                products_interest_rates: vec![
                    ProductInterestRate { product_name: "regular".into(), interest_rate_pct: 3.5 },
                ],
                invested_in_bank: 300000.0, invested_in_shares: 100000.0, other_investments: 50000.0,
            },
            loan_portfolio: FinancialLoanPortfolio {
                loans_issued_male: 60, loans_issued_female: 40, loans_issued_coops: 5,
                value_issued_male: 600000.0, value_issued_female: 400000.0, value_issued_coops: 100000.0,
                outstanding_accounts_male: 55, outstanding_accounts_female: 35, outstanding_accounts_coops: 4,
                outstanding_value_male: 500000.0, outstanding_value_female: 350000.0, outstanding_value_coops: 80000.0,
                delinquent_accounts_male: 5, delinquent_accounts_female: 3, delinquent_accounts_coops: 1,
                delinquent_value_male: 50000.0, delinquent_value_female: 30000.0, delinquent_value_coops: 5000.0,
                delinquent_value_0_30_days: 25000.0, delinquent_value_31_365_days: 60000.0,
                provision_0_30_days: 2500.0, provision_31_365_days: 30000.0,
                written_off_value: 5000.0, recovered_loans_12_months: 2000.0,
                average_loan_term_months: 12.0, average_interest_rate_pct: 18.0,
                fees_stationery: 500.0, fees_application: 1000.0, fees_loan_protection: 2000.0,
                fees_penalties: 1500.0, fees_others: 300.0, interest_rate_method: "declining".into(),
            },
            other_activities_income: vec![
                ActivityIncome { activity_name: "rental".into(), annual_income: 50000.0, annual_expenditure: 20000.0, net_profit: 30000.0 },
                ActivityIncome { activity_name: "consulting".into(), annual_income: 30000.0, annual_expenditure: 10000.0, net_profit: 20000.0 },
            ],
            periodic_financial_reporting: PeriodicFinancialReporting {
                report_frequencies: vec![
                    ReportFrequency { report_name: "monthly".into(), frequency: "monthly".into() },
                ],
                current_total_income: 2000000.0, last_total_income: 1800000.0,
                current_expenditure: 1600000.0, last_expenditure: 1500000.0,
                current_net_income: 400000.0, last_net_income: 300000.0,
                current_surplus_distr: 100000.0, last_surplus_distr: 75000.0,
                non_current_assets: 5000000.0, total_current_assets: 3000000.0,
                current_liabilities: 1000000.0, long_term_liabilities: 2000000.0,
                total_equity: 5000000.0,
                accumulated_reserves_book_value: 500000.0, actual_reserves_in_bank: 450000.0,
            },
            qualitative_assessment: QualitativeAssessment {
                competitor_advantages: vec!["trust".into()], success_reasons: vec!["management".into()],
                failure_challenges: vec!["funding".into()], recommendations: vec!["diversify".into()],
                respondent_comments: Some("Good progress".into()),
            },
        }
    }

    fn find_item(items: &[LineItemModel], code: i32) -> Option<&LineItemModel> {
        items.iter().find(|i| i.account_code == Set(Some(code)))
    }

    #[test]
    fn test_converter_creates_financial_statement() {
        let sub_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let body = sample_financial_questionnaire(sub_id);
        let (fs, items) = convert_financial_questionnaire(&body, sub_id, coop_id, 2025);

        assert_eq!(fs.submission_id, Set(sub_id));
        assert_eq!(fs.cooperative_id, Set(coop_id));
        assert_eq!(fs.reporting_year, Set(2025));
        assert_eq!(fs.accounting_year, Set(AccountingYear::Calendar));
        assert_eq!(fs.currency, Set(Currency::Szl));
        assert!(!items.is_empty());
    }

    #[test]
    fn test_converter_creates_all_expected_line_items() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        // 10 PFR + 5 capitalization + 3 savings + 7 loan + 3 activities = 28 items
        assert_eq!(items.len(), 28, "Expected 28 line items, got {}", items.len());
    }

    #[test]
    fn test_converter_computes_aggregates_correctly() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        // Total Assets = 5,000,000 + 3,000,000 = 8,000,000
        let ta = find_item(&items, 1999).unwrap();
        assert_eq!(ta.value.as_ref().unwrap().to_f64().unwrap(), 8_000_000.0);

        // Total Liabilities = 1,000,000 + 2,000,000 = 3,000,000
        let tl = find_item(&items, 2999).unwrap();
        assert_eq!(tl.value.as_ref().unwrap().to_f64().unwrap(), 3_000_000.0);

        // Total Equity = 5,000,000
        let te = find_item(&items, 3999).unwrap();
        assert_eq!(te.value.as_ref().unwrap().to_f64().unwrap(), 5_000_000.0);

        // Share Capital = 150,000 + 100,000 = 250,000
        let sc = find_item(&items, 3101).unwrap();
        assert_eq!(sc.value.as_ref().unwrap().to_f64().unwrap(), 250_000.0);

        // Savings = 800,000 + 500,000 = 1,300,000
        let sd = find_item(&items, 2101).unwrap();
        assert_eq!(sd.value.as_ref().unwrap().to_f64().unwrap(), 1_300_000.0);

        // Member deposits category should be Liabilities
        assert_eq!(sd.account_category, Set(AccountCategory::Liabilities));

        // Net Surplus = 400,000
        let ns = find_item(&items, 6999).unwrap();
        assert_eq!(ns.value.as_ref().unwrap().to_f64().unwrap(), 400_000.0);
    }

    #[test]
    fn test_converter_loan_portfolio_values() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        // Outstanding = 500,000 + 350,000 + 80,000 = 930,000
        let perf = find_item(&items, 1201).unwrap();
        assert_eq!(perf.value.as_ref().unwrap().to_f64().unwrap(), 930_000.0);

        // Fees total = 500 + 1000 + 2000 + 1500 + 300 = 5,300
        let fees = find_item(&items, 4102).unwrap();
        assert_eq!(fees.value.as_ref().unwrap().to_f64().unwrap(), 5_300.0);

        // Written off = 5,000
        let wo = find_item(&items, 5301).unwrap();
        assert_eq!(wo.value.as_ref().unwrap().to_f64().unwrap(), 5_000.0);
    }

    #[test]
    fn test_converter_activity_income_summed() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        // Activity income = 50,000 + 30,000 = 80,000
        // This gets added to PFR's 2,000,000 → but we create separate line items
        // The 4101 from activities is separate from the 4101 from PFR
        // Actually looking at the code more carefully:
        // PFR creates one 4101 with current_total_income=2,000,000
        // Activities creates another 4101 with 80,000
        // So there should be two 4101 items
        let ai_items: Vec<&LineItemModel> = items.iter().filter(|i| i.account_code == Set(Some(4101))).collect();
        assert_eq!(ai_items.len(), 2, "Expected 2 income line items (PFR + activities)");
    }

    #[test]
    fn test_converter_zero_values_skip_activities() {
        let mut body = sample_financial_questionnaire(Uuid::new_v4());
        body.other_activities_income = vec![];

        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        // Should be 28 - 3 activities = 25 items
        assert_eq!(items.len(), 25);
    }

    #[test]
    fn test_converter_all_line_items_have_manual_flag() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        for item in &items {
            assert_eq!(item.manually_edited, Set(true), "Item {} should be manually_edited=true", item.account_name.as_ref());
            assert_eq!(item.ai_flagged, Set(false), "Item {} should not be ai_flagged", item.account_name.as_ref());
            assert_eq!(item.ai_confidence, Set(None), "Item {} should have no ai_confidence", item.account_name.as_ref());
            assert_eq!(item.month, Set(12i16), "Item {} should be month 12", item.account_name.as_ref());
        }
    }

    #[test]
    fn test_converter_line_items_reference_correct_fs() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (fs, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        let fs_id = &fs.id;
        for item in &items {
            assert_eq!(&item.financial_statement_id, fs_id, "All items must reference the same financial_statement_id");
        }
    }

    #[test]
    fn test_converter_balance_sheet_equation() {
        let body = sample_financial_questionnaire(Uuid::new_v4());
        let (_, items) = convert_financial_questionnaire(&body, Uuid::new_v4(), Uuid::new_v4(), 2025);

        let assets = find_item(&items, 1999).unwrap().value.as_ref().unwrap().to_f64().unwrap();
        let liabilities = find_item(&items, 2999).unwrap().value.as_ref().unwrap().to_f64().unwrap();
        let equity = find_item(&items, 3999).unwrap().value.as_ref().unwrap().to_f64().unwrap();

        // Assets = Liabilities + Equity
        let diff = (assets - (liabilities + equity)).abs();
        assert!(diff < 0.001, "Balance sheet equation failed: Assets({}) != Liabilities({}) + Equity({})", assets, liabilities, equity);
    }
}

fn make_line_item(
    fs_id: Uuid,
    account_code: Option<i32>,
    account_name: &str,
    category: AccountCategory,
    subcategory: &str,
    value: f64,
) -> LineItemModel {
    let now = chrono::Utc::now();
    LineItemModel {
        id: Set(Uuid::new_v4()),
        financial_statement_id: Set(fs_id),
        account_code: Set(account_code),
        account_name: Set(account_name.to_string()),
        account_category: Set(category),
        account_subcategory: Set(subcategory.to_string()),
        month: Set(12i16),
        value: Set(Some(Decimal::from_f64(value).unwrap_or(Decimal::ZERO))),
        ai_confidence: Set(None),
        ai_flagged: Set(false),
        manually_edited: Set(true),
        raw_label: Set(Some(account_name.to_string())),
        created_at: Set(now),
        updated_at: Set(now),
    }
}
