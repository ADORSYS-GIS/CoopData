use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ============================================================================
// FINANCIAL QUESTIONNAIRE DTOs
// ============================================================================

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct FinancialQuestionnaireRequest {
    pub submission_id: Uuid,
    pub leadership_and_management: LeadershipAndManagement,
    pub capitalization: Capitalization,
    pub savings_portfolio: FinancialSavingsPortfolio,
    pub loan_portfolio: FinancialLoanPortfolio,
    pub other_activities_income: Vec<ActivityIncome>,
    pub periodic_financial_reporting: PeriodicFinancialReporting,
    pub qualitative_assessment: QualitativeAssessment,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct LeadershipAndManagement {
    pub board_members_male: i32,
    pub board_members_female: i32,
    pub exec_committee_male: i32,
    pub exec_committee_female: i32,
    pub credit_committee_male: i32,
    pub credit_committee_female: i32,
    pub education_committee_male: i32,
    pub education_committee_female: i32,
    pub supervisory_committee_male: i32,
    pub supervisory_committee_female: i32,
    
    pub chair_education: String,
    pub vice_chair_education: String,
    pub treasurer_education: String,
    pub secretary_education: String,
    
    pub staff_manager_male: i32,
    pub staff_manager_female: i32,
    pub staff_ass_manager_male: i32,
    pub staff_ass_manager_female: i32,
    pub staff_acc_male: i32,
    pub staff_acc_female: i32,
    pub staff_other_mgmt_male: i32,
    pub staff_other_mgmt_female: i32,
    pub staff_support_male: i32,
    pub staff_support_female: i32,
    
    pub manager_academic_level: String,
    pub manager_coop_training_level: String,
    
    pub members_trained_last_year: i32,
    pub leaders_trained_last_year: i32,
    pub staff_trained_last_year: i32,
    pub training_sponsor: String,
    pub training_quality_rating: String,
    
    pub member_training_needs: Vec<String>,
    pub leader_training_needs: Vec<String>,
    pub staff_training_needs: Vec<String>,
    pub willing_to_cover_training_cost_pct: f64,
    
    pub registered_members_male: i32,
    pub registered_members_female: i32,
    pub active_members_male: i32,
    pub active_members_female: i32,
    
    pub active_members_youth_17_under: i32,
    pub active_members_18_25: i32,
    pub active_members_26_35: i32,
    pub active_members_36_60: i32,
    pub active_members_61_plus: i32,
    
    pub society_status: String,
    pub dormant_members_male: i32,
    pub dormant_members_female: i32,
    
    pub dormancy_reasons: Vec<String>,
    pub dormancy_effect: String,
    
    pub management_tools: Vec<String>,
    pub governance_tools: Vec<String>,
    
    pub agm_up_to_date: bool,
    pub agm_arrears_months: Option<i32>,
    pub agm_arrears_reasons: Option<Vec<String>>,
    pub agm_attendance_male: i32,
    pub agm_attendance_female: i32,
    
    pub last_audit_date: Option<String>,
    pub last_inspection_date: Option<String>,
    pub last_mgmt_report_date: Option<String>,
    pub last_budget_date: Option<String>,
    pub last_committee_profile_date: Option<String>,
    pub last_audit_firm: Option<String>,
    
    pub financial_products: Vec<String>,
    pub non_financial_products: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct Capitalization {
    pub share_nominal_value: f64,
    pub share_capital_contribution_per_member: f64,
    pub total_share_capital_male: f64,
    pub total_share_capital_female: f64,
    pub borrowed_funds: f64,
    pub donations_grants: f64,
    pub accumulated_statutory_reserves_book_value: f64,
    pub actual_accumulated_statutory_reserves: f64,
    pub retained_earnings: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct FinancialSavingsPortfolio {
    pub depositors_male: i32,
    pub depositors_female: i32,
    pub total_savings_male: f64,
    pub total_savings_female: f64,
    pub products_interest_rates: Vec<ProductInterestRate>,
    pub invested_in_bank: f64,
    pub invested_in_shares: f64,
    pub other_investments: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct ProductInterestRate {
    pub product_name: String,
    pub interest_rate_pct: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct FinancialLoanPortfolio {
    pub loans_issued_male: i32,
    pub loans_issued_female: i32,
    pub loans_issued_coops: i32,
    pub value_issued_male: f64,
    pub value_issued_female: f64,
    pub value_issued_coops: f64,
    
    pub outstanding_accounts_male: i32,
    pub outstanding_accounts_female: i32,
    pub outstanding_accounts_coops: i32,
    pub outstanding_value_male: f64,
    pub outstanding_value_female: f64,
    pub outstanding_value_coops: f64,
    
    pub delinquent_accounts_male: i32,
    pub delinquent_accounts_female: i32,
    pub delinquent_accounts_coops: i32,
    pub delinquent_value_male: f64,
    pub delinquent_value_female: f64,
    pub delinquent_value_coops: f64,
    
    pub delinquent_value_0_30_days: f64,
    pub delinquent_value_31_365_days: f64,
    
    pub provision_0_30_days: f64,
    pub provision_31_365_days: f64,
    
    pub written_off_value: f64,
    pub recovered_loans_12_months: f64,
    
    pub average_loan_term_months: f64,
    pub average_interest_rate_pct: f64,
    
    pub fees_stationery: f64,
    pub fees_application: f64,
    pub fees_loan_protection: f64,
    pub fees_penalties: f64,
    pub fees_others: f64,
    
    pub interest_rate_method: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct ActivityIncome {
    pub activity_name: String,
    pub annual_income: f64,
    pub annual_expenditure: f64,
    pub net_profit: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct PeriodicFinancialReporting {
    pub report_frequencies: Vec<ReportFrequency>,
    
    pub current_total_income: f64,
    pub last_total_income: f64,
    pub current_expenditure: f64,
    pub last_expenditure: f64,
    pub current_net_income: f64,
    pub last_net_income: f64,
    pub current_surplus_distr: f64,
    pub last_surplus_distr: f64,
    
    pub non_current_assets: f64,
    pub total_current_assets: f64,
    pub current_liabilities: f64,
    pub long_term_liabilities: f64,
    pub total_equity: f64,
    
    pub accumulated_reserves_book_value: f64,
    pub actual_reserves_in_bank: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct ReportFrequency {
    pub report_name: String,
    pub frequency: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct QualitativeAssessment {
    pub competitor_advantages: Vec<String>,
    pub success_reasons: Vec<String>,
    pub failure_challenges: Vec<String>,
    pub recommendations: Vec<String>,
    pub respondent_comments: Option<String>,
}

// ============================================================================
// NON-FINANCIAL QUESTIONNAIRE DTOs
// ============================================================================

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct NonFinancialQuestionnaireRequest {
    pub submission_id: Uuid,
    pub basic_data: BasicData,
    pub member_empowerment: MemberEmpowerment,
    pub main_activity_performance: Vec<MainActivityPerformance>,
    pub other_activities_income: Vec<ActivityIncome>,
    pub main_threats: MainThreats,
    pub savings_portfolio: NonFinancialSavingsPortfolio,
    pub loan_portfolio: NonFinancialLoanPortfolio,
    pub periodic_reporting: NonFinancialPeriodicReporting,
    pub qualitative_assessment: QualitativeAssessment,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct BasicData {
    pub registered_members_male: i32,
    pub registered_members_female: i32,
    pub active_members_male: i32,
    pub active_members_female: i32,
    
    pub active_members_17_under_male: i32,
    pub active_members_17_under_female: i32,
    pub active_members_18_25_male: i32,
    pub active_members_18_25_female: i32,
    pub active_members_26_35_male: i32,
    pub active_members_26_35_female: i32,
    pub active_members_36_60_male: i32,
    pub active_members_36_60_female: i32,
    pub active_members_61_plus_male: i32,
    pub active_members_61_plus_female: i32,
    
    pub board_members_male: i32,
    pub board_members_female: i32,
    pub exec_committee_male: i32,
    pub exec_committee_female: i32,
    pub credit_committee_male: i32,
    pub credit_committee_female: i32,
    pub education_committee_male: i32,
    pub education_committee_female: i32,
    pub supervisory_committee_male: i32,
    pub supervisory_committee_female: i32,
    
    pub chair_education: String,
    pub vice_chair_education: String,
    pub treasurer_education: String,
    pub secretary_education: String,
    
    pub committee_elected_date: Option<String>,
    pub committee_oriented_date: Option<String>,
    pub agm_last_held_date: Option<String>,
    pub agm_attendance_male: i32,
    pub agm_attendance_female: i32,
    
    pub member_joining_fee: f64,
    pub annual_subscription_fee: f64,
    pub share_nominal_value: f64,
    pub share_capital_contribution_per_member: f64,
    pub total_share_capital_male: f64,
    pub total_share_capital_female: f64,
    
    pub borrowed_funds: f64,
    pub donations_grants: f64,
    pub statutory_reserve_book_value: f64,
    pub actual_statutory_reserves: f64,
    
    pub manager_gender: String,
    pub manager_academic_level: String,
    pub manager_coop_training_level: String,
    pub society_status: String,
    
    pub last_audit_date: Option<String>,
    pub last_inspection_date: Option<String>,
    pub last_mgmt_report_date: Option<String>,
    pub last_budget_date: Option<String>,
    pub last_committee_profile_date: Option<String>,
    pub last_audit_firm: Option<String>,
    
    pub staff_manager_male: i32,
    pub staff_manager_female: i32,
    pub staff_ass_manager_male: i32,
    pub staff_ass_manager_female: i32,
    pub staff_acc_male: i32,
    pub staff_acc_female: i32,
    pub staff_other_mgmt_male: i32,
    pub staff_other_mgmt_female: i32,
    pub staff_support_male: i32,
    pub staff_support_female: i32,
    
    pub committee_meeting_frequency: String,
    pub meeting_purposes: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct MemberEmpowerment {
    pub members_trained_last_year: i32,
    pub leaders_trained_last_year: i32,
    pub staff_trained_last_year: i32,
    pub training_sponsor: String,
    pub training_quality_rating: String,
    pub member_training_needs: Vec<String>,
    pub leader_training_needs: Vec<String>,
    pub staff_training_needs: Vec<String>,
    pub willing_to_cover_training_cost_pct: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct MainActivityPerformance {
    pub activity_name: String,
    pub unit_of_measure: String,
    pub annual_output: f64,
    pub total_income: f64,
    pub total_expenses: f64,
    pub net_surplus: f64,
    pub distributed_to_members: f64,
    pub last_distribution_date: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct MainThreats {
    pub owed_to_creditors_outsiders: f64,
    pub owed_to_creditors_members: f64,
    pub outstanding_owed_to_banks: f64,
    pub outstanding_owed_by_members: f64,
    pub outstanding_payments_to_members: f64,
    pub number_of_competitors: i32,
    pub disputes_resolved: i32,
    pub disputes_unresolved: i32,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct NonFinancialSavingsPortfolio {
    pub depositors_male: i32,
    pub depositors_female: i32,
    pub total_savings_male: f64,
    pub total_savings_female: f64,
    pub products_interest_rates: Vec<ProductInterestRate>,
    pub invested_in_bank: f64,
    pub invested_in_shares: f64,
    pub other_investments: f64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct NonFinancialLoanPortfolio {
    pub loans_issued_male: i32,
    pub loans_issued_female: i32,
    pub loans_issued_coops: i32,
    pub value_issued_male: f64,
    pub value_issued_female: f64,
    pub value_issued_coops: f64,
    
    pub outstanding_accounts_male: i32,
    pub outstanding_accounts_female: i32,
    pub outstanding_accounts_coops: i32,
    
    pub outstanding_value_male: f64,
    pub outstanding_value_female: f64,
    pub outstanding_value_coops: f64,
    
    pub delinquent_accounts_male: i32,
    pub delinquent_accounts_female: i32,
    pub delinquent_accounts_coops: i32,
    
    pub delinquent_value_male: f64,
    pub delinquent_value_female: f64,
    pub delinquent_value_coops: f64,
    
    pub delinquent_value_0_30_days: f64,
    pub delinquent_value_31_365_days: f64,
    
    pub provision_0_30_days: f64,
    pub provision_31_365_days: f64,
    
    pub written_off_value: f64,
    pub recovered_loans_12_months: f64,
    
    pub average_loan_term_months: f64,
    pub average_interest_rate_pct: f64,
    
    pub fees_stationery: f64,
    pub fees_application: f64,
    pub fees_loan_protection: f64,
    pub fees_penalties: f64,
    pub fees_others: f64,
    
    pub interest_rate_method: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
pub struct NonFinancialPeriodicReporting {
    pub report_frequencies: Vec<ReportFrequency>,
    
    pub current_total_income: f64,
    pub last_total_income: f64,
    pub current_expenditure: f64,
    pub last_expenditure: f64,
    pub current_net_income: f64,
    pub last_net_income: f64,
    pub current_surplus_distr: f64,
    pub last_surplus_distr: f64,
    
    pub non_current_assets: f64,
    pub total_current_assets: f64,
    pub total_liabilities: f64,
    pub total_equity: f64,
    
    pub accumulated_reserves_book_value: f64,
    pub actual_reserves_in_bank: f64,
}
