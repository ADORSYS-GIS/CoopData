#![recursion_limit = "256"]

mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use serde_json::json;
use tower::util::ServiceExt;

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

#[tokio::test]
async fn test_questionnaire_financial_no_auth_unauthorized() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/cooperative/questionnaire/financial")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"submission_id": "00000000-0000-0000-0000-000000000000"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_questionnaire_non_financial_no_auth_unauthorized() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/cooperative/questionnaire/non-financial")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"submission_id": "00000000-0000-0000-0000-000000000000"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_questionnaire_openapi_includes_endpoints() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let paths = spec["paths"].as_object().unwrap();
    assert!(
        paths.contains_key("/api/v1/cooperative/questionnaire/financial"),
        "OpenAPI must include financial questionnaire endpoint"
    );
    assert!(
        paths.contains_key("/api/v1/cooperative/questionnaire/non-financial"),
        "OpenAPI must include non-financial questionnaire endpoint"
    );
}

#[tokio::test]
async fn test_questionnaire_openapi_includes_schemas() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let schemas = spec["components"]["schemas"].as_object().unwrap();
    assert!(schemas.contains_key("FinancialQuestionnaireRequest"));
    assert!(schemas.contains_key("NonFinancialQuestionnaireRequest"));
    assert!(schemas.contains_key("Capitalization"));
    assert!(schemas.contains_key("FinancialSavingsPortfolio"));
    assert!(schemas.contains_key("FinancialLoanPortfolio"));
    assert!(schemas.contains_key("LeadershipAndManagement"));
    assert!(schemas.contains_key("PeriodicFinancialReporting"));
    assert!(schemas.contains_key("QualitativeAssessment"));
    assert!(schemas.contains_key("ActivityIncome"));
    assert!(schemas.contains_key("NonFinancialSavingsPortfolio"));
    assert!(schemas.contains_key("NonFinancialLoanPortfolio"));
    assert!(schemas.contains_key("NonFinancialPeriodicReporting"));
    assert!(schemas.contains_key("BasicData"));
    assert!(schemas.contains_key("MemberEmpowerment"));
    assert!(schemas.contains_key("MainActivityPerformance"));
    assert!(schemas.contains_key("MainThreats"));
}

#[tokio::test]
async fn test_financial_questionnaire_dto_roundtrip() {
    use coop_data_backend::api::dto::questionnaire::*;
    use uuid::Uuid;

    let original = FinancialQuestionnaireRequest {
        submission_id: Uuid::new_v4(),
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
            members_trained_last_year: 50, leaders_trained_last_year: 10,
            staff_trained_last_year: 5,
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
            invested_in_bank: 300000.0, invested_in_shares: 100000.0,
            other_investments: 50000.0,
        },
        loan_portfolio: FinancialLoanPortfolio {
            loans_issued_male: 60, loans_issued_female: 40, loans_issued_coops: 5,
            value_issued_male: 600000.0, value_issued_female: 400000.0,
            value_issued_coops: 100000.0,
            outstanding_accounts_male: 55, outstanding_accounts_female: 35,
            outstanding_accounts_coops: 4,
            outstanding_value_male: 500000.0, outstanding_value_female: 350000.0,
            outstanding_value_coops: 80000.0,
            delinquent_accounts_male: 5, delinquent_accounts_female: 3,
            delinquent_accounts_coops: 1,
            delinquent_value_male: 50000.0, delinquent_value_female: 30000.0,
            delinquent_value_coops: 5000.0,
            delinquent_value_0_30_days: 25000.0, delinquent_value_31_365_days: 60000.0,
            provision_0_30_days: 2500.0, provision_31_365_days: 30000.0,
            written_off_value: 5000.0, recovered_loans_12_months: 2000.0,
            average_loan_term_months: 12.0, average_interest_rate_pct: 18.0,
            fees_stationery: 500.0, fees_application: 1000.0, fees_loan_protection: 2000.0,
            fees_penalties: 1500.0, fees_others: 300.0,
            interest_rate_method: "declining".into(),
        },
        other_activities_income: vec![
            ActivityIncome { activity_name: "rental".into(), annual_income: 50000.0,
                annual_expenditure: 20000.0, net_profit: 30000.0 },
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
            competitor_advantages: vec!["trust".into()],
            success_reasons: vec!["management".into()],
            failure_challenges: vec!["funding".into()],
            recommendations: vec!["diversify".into()],
            respondent_comments: Some("Good progress".into()),
        },
    };

    let json = serde_json::to_value(&original).unwrap();
    let deserialized: FinancialQuestionnaireRequest = serde_json::from_value(json.clone()).unwrap();

    assert_eq!(deserialized.submission_id, original.submission_id);
    assert_eq!(deserialized.leadership_and_management.board_members_male, 5);
    assert_eq!(deserialized.capitalization.total_share_capital_male, 150000.0);
    assert_eq!(deserialized.savings_portfolio.total_savings_male, 800000.0);
    assert_eq!(deserialized.loan_portfolio.outstanding_value_male, 500000.0);
    assert_eq!(deserialized.periodic_financial_reporting.current_total_income, 2_000_000.0);
    assert_eq!(deserialized.periodic_financial_reporting.non_current_assets, 5_000_000.0);
    assert_eq!(deserialized.periodic_financial_reporting.total_current_assets, 3_000_000.0);
    assert!(deserialized.qualitative_assessment.respondent_comments.is_some());
}

#[tokio::test]
async fn test_non_financial_questionnaire_dto_roundtrip() {
    use coop_data_backend::api::dto::questionnaire::*;
    use uuid::Uuid;

    let original = NonFinancialQuestionnaireRequest {
        submission_id: Uuid::new_v4(),
        basic_data: BasicData {
            registered_members_male: 300, registered_members_female: 200,
            active_members_male: 250, active_members_female: 150,
            active_members_17_under_male: 10, active_members_17_under_female: 8,
            active_members_18_25_male: 40, active_members_18_25_female: 30,
            active_members_26_35_male: 60, active_members_26_35_female: 50,
            active_members_36_60_male: 80, active_members_36_60_female: 50,
            active_members_61_plus_male: 20, active_members_61_plus_female: 12,
            board_members_male: 5, board_members_female: 2,
            exec_committee_male: 3, exec_committee_female: 1,
            credit_committee_male: 2, credit_committee_female: 0,
            education_committee_male: 1, education_committee_female: 1,
            supervisory_committee_male: 2, supervisory_committee_female: 1,
            chair_education: "degree".into(), vice_chair_education: "diploma".into(),
            treasurer_education: "degree".into(), secretary_education: "diploma".into(),
            committee_elected_date: Some("2024-01-15".into()),
            committee_oriented_date: Some("2024-02-01".into()),
            agm_last_held_date: Some("2025-03-15".into()),
            agm_attendance_male: 100, agm_attendance_female: 80,
            member_joining_fee: 50.0, annual_subscription_fee: 20.0,
            share_nominal_value: 100.0, share_capital_contribution_per_member: 500.0,
            total_share_capital_male: 150000.0, total_share_capital_female: 100000.0,
            borrowed_funds: 50000.0, donations_grants: 20000.0,
            statutory_reserve_book_value: 75000.0, actual_statutory_reserves: 60000.0,
            manager_gender: "male".into(), manager_academic_level: "degree".into(),
            manager_coop_training_level: "advanced".into(), society_status: "registered".into(),
            last_audit_date: Some("2025-12-31".into()), last_inspection_date: None,
            last_mgmt_report_date: None, last_budget_date: None,
            last_committee_profile_date: None, last_audit_firm: Some("PwC".into()),
            staff_manager_male: 1, staff_manager_female: 0,
            staff_ass_manager_male: 2, staff_ass_manager_female: 0,
            staff_acc_male: 1, staff_acc_female: 2,
            staff_other_mgmt_male: 0, staff_other_mgmt_female: 1,
            staff_support_male: 3, staff_support_female: 2,
            committee_meeting_frequency: "monthly".into(),
            meeting_purposes: vec!["planning".into(), "review".into()],
        },
        member_empowerment: MemberEmpowerment {
            members_trained_last_year: 50, leaders_trained_last_year: 10,
            staff_trained_last_year: 5,
            training_sponsor: "government".into(), training_quality_rating: "good".into(),
            member_training_needs: vec!["finance".into()],
            leader_training_needs: vec!["governance".into()],
            staff_training_needs: vec!["accounting".into()],
            willing_to_cover_training_cost_pct: 50.0,
        },
        main_activity_performance: vec![
            MainActivityPerformance {
                activity_name: "farming".into(), unit_of_measure: "bags".into(),
                annual_output: 1000.0, total_income: 200000.0, total_expenses: 150000.0,
                net_surplus: 50000.0, distributed_to_members: 25000.0,
                last_distribution_date: Some("2025-12-01".into()),
            },
        ],
        other_activities_income: vec![],
        main_threats: MainThreats {
            owed_to_creditors_outsiders: 10000.0, owed_to_creditors_members: 5000.0,
            outstanding_owed_to_banks: 50000.0, outstanding_owed_by_members: 20000.0,
            outstanding_payments_to_members: 5000.0,
            number_of_competitors: 3, disputes_resolved: 5, disputes_unresolved: 2,
        },
        savings_portfolio: NonFinancialSavingsPortfolio {
            depositors_male: 200, depositors_female: 120,
            total_savings_male: 800000.0, total_savings_female: 500000.0,
            products_interest_rates: vec![
                ProductInterestRate { product_name: "regular".into(), interest_rate_pct: 3.5 },
            ],
            invested_in_bank: 300000.0, invested_in_shares: 100000.0,
            other_investments: 50000.0,
        },
        loan_portfolio: NonFinancialLoanPortfolio {
            loans_issued_male: 60, loans_issued_female: 40, loans_issued_coops: 5,
            value_issued_male: 600000.0, value_issued_female: 400000.0,
            value_issued_coops: 100000.0,
            outstanding_accounts_male: 55, outstanding_accounts_female: 35,
            outstanding_accounts_coops: 4,
            outstanding_value_male: 500000.0, outstanding_value_female: 350000.0,
            outstanding_value_coops: 80000.0,
            delinquent_accounts_male: 5, delinquent_accounts_female: 3,
            delinquent_accounts_coops: 1,
            delinquent_value_male: 50000.0, delinquent_value_female: 30000.0,
            delinquent_value_coops: 5000.0,
            delinquent_value_0_30_days: 25000.0, delinquent_value_31_365_days: 60000.0,
            provision_0_30_days: 2500.0, provision_31_365_days: 30000.0,
            written_off_value: 5000.0, recovered_loans_12_months: 2000.0,
            average_loan_term_months: 12.0, average_interest_rate_pct: 18.0,
            fees_stationery: 500.0, fees_application: 1000.0, fees_loan_protection: 2000.0,
            fees_penalties: 1500.0, fees_others: 300.0,
            interest_rate_method: "declining".into(),
        },
        periodic_reporting: NonFinancialPeriodicReporting {
            report_frequencies: vec![],
            current_total_income: 2000000.0, last_total_income: 1800000.0,
            current_expenditure: 1600000.0, last_expenditure: 1500000.0,
            current_net_income: 400000.0, last_net_income: 300000.0,
            current_surplus_distr: 100000.0, last_surplus_distr: 75000.0,
            non_current_assets: 5000000.0, total_current_assets: 3000000.0,
            total_liabilities: 3000000.0, total_equity: 5000000.0,
            accumulated_reserves_book_value: 500000.0, actual_reserves_in_bank: 450000.0,
        },
        qualitative_assessment: QualitativeAssessment {
            competitor_advantages: vec!["trust".into()],
            success_reasons: vec!["management".into()],
            failure_challenges: vec!["funding".into()],
            recommendations: vec!["diversify".into()],
            respondent_comments: None,
        },
    };

    let json = serde_json::to_value(&original).unwrap();
    let deserialized: NonFinancialQuestionnaireRequest = serde_json::from_value(json).unwrap();

    assert_eq!(deserialized.submission_id, original.submission_id);
    assert_eq!(deserialized.basic_data.registered_members_male, 300);
    assert_eq!(deserialized.member_empowerment.members_trained_last_year, 50);
    assert!(deserialized.main_activity_performance[0].last_distribution_date.is_some());
    assert_eq!(deserialized.main_threats.number_of_competitors, 3);
    assert_eq!(deserialized.periodic_reporting.non_current_assets, 5_000_000.0);
    assert!(deserialized.qualitative_assessment.respondent_comments.is_none());
}

#[tokio::test]
async fn test_financial_questionnaire_minimal_json_deserialization() {
    use coop_data_backend::api::dto::questionnaire::*;
    use uuid::Uuid;

    let sub_id = Uuid::new_v4();
    let json = json!({
        "submission_id": sub_id,
        "leadership_and_management": {
            "board_members_male": 0, "board_members_female": 0,
            "exec_committee_male": 0, "exec_committee_female": 0,
            "credit_committee_male": 0, "credit_committee_female": 0,
            "education_committee_male": 0, "education_committee_female": 0,
            "supervisory_committee_male": 0, "supervisory_committee_female": 0,
            "chair_education": "", "vice_chair_education": "",
            "treasurer_education": "", "secretary_education": "",
            "staff_manager_male": 0, "staff_manager_female": 0,
            "staff_ass_manager_male": 0, "staff_ass_manager_female": 0,
            "staff_acc_male": 0, "staff_acc_female": 0,
            "staff_other_mgmt_male": 0, "staff_other_mgmt_female": 0,
            "staff_support_male": 0, "staff_support_female": 0,
            "manager_academic_level": "", "manager_coop_training_level": "",
            "members_trained_last_year": 0, "leaders_trained_last_year": 0,
            "staff_trained_last_year": 0,
            "training_sponsor": "", "training_quality_rating": "",
            "member_training_needs": [], "leader_training_needs": [],
            "staff_training_needs": [], "willing_to_cover_training_cost_pct": 0.0,
            "registered_members_male": 0, "registered_members_female": 0,
            "active_members_male": 0, "active_members_female": 0,
            "active_members_youth_17_under": 0, "active_members_18_25": 0,
            "active_members_26_35": 0, "active_members_36_60": 0,
            "active_members_61_plus": 0,
            "society_status": "",
            "dormant_members_male": 0, "dormant_members_female": 0,
            "dormancy_reasons": [], "dormancy_effect": "",
            "management_tools": [], "governance_tools": [],
            "agm_up_to_date": false, "agm_attendance_male": 0, "agm_attendance_female": 0,
            "financial_products": [], "non_financial_products": []
        },
        "capitalization": {
            "share_nominal_value": 0.0, "share_capital_contribution_per_member": 0.0,
            "total_share_capital_male": 0.0, "total_share_capital_female": 0.0,
            "borrowed_funds": 0.0, "donations_grants": 0.0,
            "accumulated_statutory_reserves_book_value": 0.0,
            "actual_accumulated_statutory_reserves": 0.0, "retained_earnings": 0.0
        },
        "savings_portfolio": {
            "depositors_male": 0, "depositors_female": 0,
            "total_savings_male": 0.0, "total_savings_female": 0.0,
            "products_interest_rates": [],
            "invested_in_bank": 0.0, "invested_in_shares": 0.0, "other_investments": 0.0
        },
        "loan_portfolio": {
            "loans_issued_male": 0, "loans_issued_female": 0, "loans_issued_coops": 0,
            "value_issued_male": 0.0, "value_issued_female": 0.0, "value_issued_coops": 0.0,
            "outstanding_accounts_male": 0, "outstanding_accounts_female": 0, "outstanding_accounts_coops": 0,
            "outstanding_value_male": 0.0, "outstanding_value_female": 0.0, "outstanding_value_coops": 0.0,
            "delinquent_accounts_male": 0, "delinquent_accounts_female": 0, "delinquent_accounts_coops": 0,
            "delinquent_value_male": 0.0, "delinquent_value_female": 0.0, "delinquent_value_coops": 0.0,
            "delinquent_value_0_30_days": 0.0, "delinquent_value_31_365_days": 0.0,
            "provision_0_30_days": 0.0, "provision_31_365_days": 0.0,
            "written_off_value": 0.0, "recovered_loans_12_months": 0.0,
            "average_loan_term_months": 0.0, "average_interest_rate_pct": 0.0,
            "fees_stationery": 0.0, "fees_application": 0.0, "fees_loan_protection": 0.0,
            "fees_penalties": 0.0, "fees_others": 0.0,
            "interest_rate_method": ""
        },
        "other_activities_income": [],
        "periodic_financial_reporting": {
            "report_frequencies": [],
            "current_total_income": 0.0, "last_total_income": 0.0,
            "current_expenditure": 0.0, "last_expenditure": 0.0,
            "current_net_income": 0.0, "last_net_income": 0.0,
            "current_surplus_distr": 0.0, "last_surplus_distr": 0.0,
            "non_current_assets": 0.0, "total_current_assets": 0.0,
            "current_liabilities": 0.0, "long_term_liabilities": 0.0,
            "total_equity": 0.0,
            "accumulated_reserves_book_value": 0.0, "actual_reserves_in_bank": 0.0
        },
        "qualitative_assessment": {
            "competitor_advantages": [], "success_reasons": [],
            "failure_challenges": [], "recommendations": []
        }
    });

    let deserialized: FinancialQuestionnaireRequest = serde_json::from_value(json).unwrap();
    assert_eq!(deserialized.submission_id, sub_id);
    assert!(deserialized.other_activities_income.is_empty());
}


