import { z } from 'zod';

export const leadershipAndManagementSchema = z.object({
  board_members_male: z.coerce.number().min(0),
  board_members_female: z.coerce.number().min(0),
  exec_committee_male: z.coerce.number().min(0),
  exec_committee_female: z.coerce.number().min(0),
  credit_committee_male: z.coerce.number().min(0),
  credit_committee_female: z.coerce.number().min(0),
  education_committee_male: z.coerce.number().min(0),
  education_committee_female: z.coerce.number().min(0),
  supervisory_committee_male: z.coerce.number().min(0),
  supervisory_committee_female: z.coerce.number().min(0),

  chair_education: z.string().optional().default(''),
  vice_chair_education: z.string().optional().default(''),
  treasurer_education: z.string().optional().default(''),
  secretary_education: z.string().optional().default(''),

  staff_manager_male: z.coerce.number().min(0),
  staff_manager_female: z.coerce.number().min(0),
  staff_ass_manager_male: z.coerce.number().min(0),
  staff_ass_manager_female: z.coerce.number().min(0),
  staff_acc_male: z.coerce.number().min(0),
  staff_acc_female: z.coerce.number().min(0),
  staff_other_mgmt_male: z.coerce.number().min(0),
  staff_other_mgmt_female: z.coerce.number().min(0),
  staff_support_male: z.coerce.number().min(0),
  staff_support_female: z.coerce.number().min(0),

  manager_academic_level: z.string().optional().default(''),
  manager_coop_training_level: z.string().optional().default(''),

  members_trained_last_year: z.coerce.number().min(0),
  leaders_trained_last_year: z.coerce.number().min(0),
  staff_trained_last_year: z.coerce.number().min(0),
  training_sponsor: z.string().optional().default(''),
  training_quality_rating: z.string().optional().default(''),

  member_training_needs: z.array(z.string()).optional().default([]),
  leader_training_needs: z.array(z.string()).optional().default([]),
  staff_training_needs: z.array(z.string()).optional().default([]),
  willing_to_cover_training_cost_pct: z.coerce.number().min(0).max(100),

  registered_members_male: z.coerce.number().min(0),
  registered_members_female: z.coerce.number().min(0),
  active_members_male: z.coerce.number().min(0),
  active_members_female: z.coerce.number().min(0),

  active_members_youth_17_under: z.coerce.number().min(0),
  active_members_18_25: z.coerce.number().min(0),
  active_members_26_35: z.coerce.number().min(0),
  active_members_36_60: z.coerce.number().min(0),
  active_members_61_plus: z.coerce.number().min(0),

  society_status: z.string().optional().default(''),
  dormant_members_male: z.coerce.number().min(0),
  dormant_members_female: z.coerce.number().min(0),

  dormancy_reasons: z.array(z.string()).optional().default([]),
  dormancy_effect: z.string().optional().default(''),

  management_tools: z.array(z.string()),
  governance_tools: z.array(z.string()),

  agm_up_to_date: z.boolean(),
  agm_arrears_months: z.coerce.number().optional(),
  agm_arrears_reasons: z.array(z.string()).optional(),
  agm_attendance_male: z.coerce.number().min(0),
  agm_attendance_female: z.coerce.number().min(0),

  last_audit_date: z.string().optional(),
  last_inspection_date: z.string().optional(),
  last_mgmt_report_date: z.string().optional(),
  last_budget_date: z.string().optional(),
  last_committee_profile_date: z.string().optional(),
  last_audit_firm: z.string().optional(),

  financial_products: z.array(z.string()),
  non_financial_products: z.array(z.string()),
});

export const capitalizationSchema = z.object({
  share_nominal_value: z.coerce.number().min(0),
  share_capital_contribution_per_member: z.coerce.number().min(0),
  total_share_capital_male: z.coerce.number().min(0),
  total_share_capital_female: z.coerce.number().min(0),
  borrowed_funds: z.coerce.number().min(0),
  donations_grants: z.coerce.number().min(0),
  accumulated_statutory_reserves_book_value: z.coerce.number().min(0),
  actual_accumulated_statutory_reserves: z.coerce.number().min(0),
  retained_earnings: z.coerce.number().min(0),
});

export const productInterestRateSchema = z.object({
  product_name: z.string().min(1, 'Required'),
  interest_rate_pct: z.coerce.number().min(0),
});

export const financialSavingsPortfolioSchema = z.object({
  depositors_male: z.coerce.number().min(0),
  depositors_female: z.coerce.number().min(0),
  total_savings_male: z.coerce.number().min(0),
  total_savings_female: z.coerce.number().min(0),
  products_interest_rates: z.array(productInterestRateSchema),
  invested_in_bank: z.coerce.number().min(0),
  invested_in_shares: z.coerce.number().min(0),
  other_investments: z.coerce.number().min(0),
});

export const financialLoanPortfolioSchema = z.object({
  loans_issued_male: z.coerce.number().min(0),
  loans_issued_female: z.coerce.number().min(0),
  loans_issued_coops: z.coerce.number().min(0),
  value_issued_male: z.coerce.number().min(0),
  value_issued_female: z.coerce.number().min(0),
  value_issued_coops: z.coerce.number().min(0),
  
  outstanding_accounts_male: z.coerce.number().min(0),
  outstanding_accounts_female: z.coerce.number().min(0),
  outstanding_accounts_coops: z.coerce.number().min(0),
  outstanding_value_male: z.coerce.number().min(0),
  outstanding_value_female: z.coerce.number().min(0),
  outstanding_value_coops: z.coerce.number().min(0),
  
  delinquent_accounts_male: z.coerce.number().min(0),
  delinquent_accounts_female: z.coerce.number().min(0),
  delinquent_accounts_coops: z.coerce.number().min(0),
  delinquent_value_male: z.coerce.number().min(0),
  delinquent_value_female: z.coerce.number().min(0),
  delinquent_value_coops: z.coerce.number().min(0),
  
  delinquent_value_0_30_days: z.coerce.number().min(0),
  delinquent_value_31_365_days: z.coerce.number().min(0),
  
  provision_0_30_days: z.coerce.number().min(0),
  provision_31_365_days: z.coerce.number().min(0),
  
  written_off_value: z.coerce.number().min(0),
  recovered_loans_12_months: z.coerce.number().min(0),
  
  average_loan_term_months: z.coerce.number().min(0),
  average_interest_rate_pct: z.coerce.number().min(0),
  
  fees_stationery: z.coerce.number().min(0),
  fees_application: z.coerce.number().min(0),
  fees_loan_protection: z.coerce.number().min(0),
  fees_penalties: z.coerce.number().min(0),
  fees_others: z.coerce.number().min(0),
  
  interest_rate_method: z.string().optional().default(''),
});

export const activityIncomeSchema = z.object({
  activity_name: z.string().min(1, 'Required'),
  annual_income: z.coerce.number().min(0),
  annual_expenditure: z.coerce.number().min(0),
  net_profit: z.coerce.number(),
});

export const reportFrequencySchema = z.object({
  report_name: z.string().min(1, 'Required'),
  frequency: z.string().min(1, 'Required'),
});

export const periodicFinancialReportingSchema = z.object({
  report_frequencies: z.array(reportFrequencySchema),
  
  current_total_income: z.coerce.number().min(0),
  last_total_income: z.coerce.number().min(0),
  current_expenditure: z.coerce.number().min(0),
  last_expenditure: z.coerce.number().min(0),
  current_net_income: z.coerce.number(),
  last_net_income: z.coerce.number(),
  current_surplus_distr: z.coerce.number().min(0),
  last_surplus_distr: z.coerce.number().min(0),
  
  non_current_assets: z.coerce.number().min(0),
  total_current_assets: z.coerce.number().min(0),
  current_liabilities: z.coerce.number().min(0),
  long_term_liabilities: z.coerce.number().min(0),
  total_equity: z.coerce.number(),
  
  accumulated_reserves_book_value: z.coerce.number().min(0),
  actual_reserves_in_bank: z.coerce.number().min(0),
});

export const qualitativeAssessmentSchema = z.object({
  competitor_advantages: z.array(z.string()),
  success_reasons: z.array(z.string()),
  failure_challenges: z.array(z.string()),
  recommendations: z.array(z.string()),
  respondent_comments: z.string().optional(),
});

export const financialQuestionnaireSchema = z.object({
  submission_id: z.string().uuid('Invalid Submission ID'),
  leadership_and_management: leadershipAndManagementSchema,
  capitalization: capitalizationSchema,
  savings_portfolio: financialSavingsPortfolioSchema,
  loan_portfolio: financialLoanPortfolioSchema,
  other_activities_income: z.array(activityIncomeSchema),
  periodic_financial_reporting: periodicFinancialReportingSchema,
  qualitative_assessment: qualitativeAssessmentSchema,
});

export type FinancialQuestionnaireValues = z.infer<typeof financialQuestionnaireSchema>;

// ============================================================================
// NON-FINANCIAL QUESTIONNAIRE SCHEMAS
// ============================================================================

export const basicDataSchema = z.object({
  registered_members_male: z.coerce.number().min(0),
  registered_members_female: z.coerce.number().min(0),
  active_members_male: z.coerce.number().min(0),
  active_members_female: z.coerce.number().min(0),
  
  active_members_17_under_male: z.coerce.number().min(0),
  active_members_17_under_female: z.coerce.number().min(0),
  active_members_18_25_male: z.coerce.number().min(0),
  active_members_18_25_female: z.coerce.number().min(0),
  active_members_26_35_male: z.coerce.number().min(0),
  active_members_26_35_female: z.coerce.number().min(0),
  active_members_36_60_male: z.coerce.number().min(0),
  active_members_36_60_female: z.coerce.number().min(0),
  active_members_61_plus_male: z.coerce.number().min(0),
  active_members_61_plus_female: z.coerce.number().min(0),
  
  board_members_male: z.coerce.number().min(0),
  board_members_female: z.coerce.number().min(0),
  exec_committee_male: z.coerce.number().min(0),
  exec_committee_female: z.coerce.number().min(0),
  credit_committee_male: z.coerce.number().min(0),
  credit_committee_female: z.coerce.number().min(0),
  education_committee_male: z.coerce.number().min(0),
  education_committee_female: z.coerce.number().min(0),
  supervisory_committee_male: z.coerce.number().min(0),
  supervisory_committee_female: z.coerce.number().min(0),
  
  chair_education: z.string().min(1, 'Required'),
  vice_chair_education: z.string().min(1, 'Required'),
  treasurer_education: z.string().min(1, 'Required'),
  secretary_education: z.string().min(1, 'Required'),
  
  committee_elected_date: z.string().optional(),
  committee_oriented_date: z.string().optional(),
  agm_last_held_date: z.string().optional(),
  agm_attendance_male: z.coerce.number().min(0),
  agm_attendance_female: z.coerce.number().min(0),
  
  member_joining_fee: z.coerce.number().min(0),
  annual_subscription_fee: z.coerce.number().min(0),
  share_nominal_value: z.coerce.number().min(0),
  share_capital_contribution_per_member: z.coerce.number().min(0),
  total_share_capital_male: z.coerce.number().min(0),
  total_share_capital_female: z.coerce.number().min(0),
  
  borrowed_funds: z.coerce.number().min(0),
  donations_grants: z.coerce.number().min(0),
  statutory_reserve_book_value: z.coerce.number().min(0),
  actual_statutory_reserves: z.coerce.number().min(0),
  
  manager_gender: z.string().min(1, 'Required'),
  manager_academic_level: z.string().min(1, 'Required'),
  manager_coop_training_level: z.string().min(1, 'Required'),
  society_status: z.string().min(1, 'Required'),
  
  last_audit_date: z.string().optional(),
  last_inspection_date: z.string().optional(),
  last_mgmt_report_date: z.string().optional(),
  last_budget_date: z.string().optional(),
  last_committee_profile_date: z.string().optional(),
  last_audit_firm: z.string().optional(),
  
  staff_manager_male: z.coerce.number().min(0),
  staff_manager_female: z.coerce.number().min(0),
  staff_ass_manager_male: z.coerce.number().min(0),
  staff_ass_manager_female: z.coerce.number().min(0),
  staff_acc_male: z.coerce.number().min(0),
  staff_acc_female: z.coerce.number().min(0),
  staff_other_mgmt_male: z.coerce.number().min(0),
  staff_other_mgmt_female: z.coerce.number().min(0),
  staff_support_male: z.coerce.number().min(0),
  staff_support_female: z.coerce.number().min(0),
  
  committee_meeting_frequency: z.string().min(1, 'Required'),
  meeting_purposes: z.array(z.string()),
});

export const memberEmpowermentSchema = z.object({
  members_trained_last_year: z.coerce.number().min(0),
  leaders_trained_last_year: z.coerce.number().min(0),
  staff_trained_last_year: z.coerce.number().min(0),
  training_sponsor: z.string().min(1, 'Required'),
  training_quality_rating: z.string().min(1, 'Required'),
  member_training_needs: z.array(z.string()),
  leader_training_needs: z.array(z.string()),
  staff_training_needs: z.array(z.string()),
  willing_to_cover_training_cost_pct: z.coerce.number().min(0).max(100),
});

export const mainActivityPerformanceSchema = z.object({
  activity_name: z.string().min(1, 'Required'),
  unit_of_measure: z.string().min(1, 'Required'),
  annual_output: z.coerce.number().min(0),
  total_income: z.coerce.number().min(0),
  total_expenses: z.coerce.number().min(0),
  net_surplus: z.coerce.number(),
  distributed_to_members: z.coerce.number().min(0),
  last_distribution_date: z.string().optional(),
});

export const mainThreatsSchema = z.object({
  owed_to_creditors_outsiders: z.coerce.number().min(0),
  owed_to_creditors_members: z.coerce.number().min(0),
  outstanding_owed_to_banks: z.coerce.number().min(0),
  outstanding_owed_by_members: z.coerce.number().min(0),
  outstanding_payments_to_members: z.coerce.number().min(0),
  number_of_competitors: z.coerce.number().min(0),
  disputes_resolved: z.coerce.number().min(0),
  disputes_unresolved: z.coerce.number().min(0),
});

export const nonFinancialPeriodicReportingSchema = z.object({
  report_frequencies: z.array(reportFrequencySchema),
  
  current_total_income: z.coerce.number().min(0),
  last_total_income: z.coerce.number().min(0),
  current_expenditure: z.coerce.number().min(0),
  last_expenditure: z.coerce.number().min(0),
  current_net_income: z.coerce.number(),
  last_net_income: z.coerce.number(),
  current_surplus_distr: z.coerce.number().min(0),
  last_surplus_distr: z.coerce.number().min(0),
  
  non_current_assets: z.coerce.number().min(0),
  total_current_assets: z.coerce.number().min(0),
  total_liabilities: z.coerce.number().min(0),
  total_equity: z.coerce.number(),
  
  accumulated_reserves_book_value: z.coerce.number().min(0),
  actual_reserves_in_bank: z.coerce.number().min(0),
});

export const nonFinancialQuestionnaireSchema = z.object({
  submission_id: z.string().uuid('Invalid Submission ID'),
  basic_data: basicDataSchema,
  member_empowerment: memberEmpowermentSchema,
  main_activity_performance: z.array(mainActivityPerformanceSchema),
  other_activities_income: z.array(activityIncomeSchema),
  main_threats: mainThreatsSchema,
  savings_portfolio: financialSavingsPortfolioSchema, // Can reuse the same struct structurally
  loan_portfolio: financialLoanPortfolioSchema, // Can reuse the same struct structurally
  periodic_reporting: nonFinancialPeriodicReportingSchema,
  qualitative_assessment: qualitativeAssessmentSchema,
});

export type NonFinancialQuestionnaireValues = z.infer<typeof nonFinancialQuestionnaireSchema>;
