export interface ManualLineItemRequest {
  account_code?: number | null;
  account_name: string;
  account_category: string;
  account_subcategory: string;
  month: number;
  value: number;
}

export interface ManualFinancialStatementRequest {
  accounting_year: "calendar" | "fiscal";
  currency: string;
  line_items: ManualLineItemRequest[];
}

export interface ManualMemberEntry {
  member_id: string;
  join_date: string;
  status: string;
  exit_date: string | null;
  gender: string;
  age_group: string;
  region: string;
  urban_rural: string;
  agm_attendance: boolean;
  leadership_role: string | null;
  voting_exercised: boolean;
}

export interface ManualSavingsAccountEntry {
  member_business_id: string;
  savings_account_id: string;
  account_type: "Voluntary" | "Mandatory" | "Fixed";
  account_opening_date: string;
  account_status: string;
  contribution_frequency: string;
  last_contribution_date: string | null;
  number_of_contributions: number;
  balance_trend: string;
  zero_balance_flag: boolean;
  withdrawal_frequency_category: string;
  emergency_withdrawals_flag: boolean;
  interest_rate: number;
  balance: number;
}

export interface ManualLoanEntry {
  member_business_id: string;
  loan_id: string;
  loan_product_type: string;
  loan_start_date: string;
  loan_maturity_date: string;
  loan_status: "Performing" | "Arrears" | "Restructured" | "WrittenOff";
  borrower_type: string;
  youth_borrower_flag: boolean;
  women_borrower_flag: boolean;
  rural_borrower_flag: boolean;
  repayment_regularity: string;
  days_past_due_category: "Zero" | "Days1To30" | "Days31To60" | "Days61To90" | "Days91Plus";
  missed_installments_count: number;
  restructured_loan_flag: boolean;
  number_of_restructurings: number;
  early_settlement_flag: boolean;
  multiple_loans_flag: boolean;
  large_borrower_flag: boolean;
  interest_rate: number;
  balance: number;
  loan_amount: number;
}

export interface ManualFixedDepositEntry {
  member_business_id: string;
  fixed_deposit_id: string;
  deposit_type: string;
  start_date: string;
  maturity_date: string;
  status: "Active" | "Matured" | "Withdrawn" | "RolledOver";
  tenure_category: string;
  original_tenure_selected: string;
  early_withdrawal_flag: boolean;
  rollover_at_maturity_flag: boolean;
  number_of_renewals: number;
  change_in_tenure_at_renewal: boolean;
  single_depositor_dependency_flag: boolean;
  interest_rate: number;
  balance: number;
}

export interface ManualFarmCoopEntry {
  cooperative_type: string;
  primary_activities: string;
  year_of_establishment: number | null;
  operational_status: string;
  active_producer_flag: boolean;
  production_type: string;
  participation_frequency: string;
  delivery_compliance: string;
  production_cycle_type: string;
  use_of_production_planning: boolean;
  use_of_shared_inputs: boolean;
  quality_compliance_flag: boolean;
  market_channel_type: string;
  formal_offtake_agreement: boolean;
  buyer_concentration_flag: boolean;
  price_predictability_category: string;
  access_to_storage: boolean;
  access_to_processing_facilities: boolean;
  transport_coordination: string;
  climate_exposure_type: string;
  irrigation_access: boolean;
  climate_mitigation_practices: string;
}

export interface ManualMembersRequest {
  members: ManualMemberEntry[];
  savings_accounts: ManualSavingsAccountEntry[] | null;
  loans: ManualLoanEntry[] | null;
  fixed_deposits: ManualFixedDepositEntry[] | null;
  farm_coop: ManualFarmCoopEntry[] | null;
}

export interface ManualFinancialStatementResponse {
  id: string;
  submission_id: string;
  cooperative_id: string;
  accounting_year: string;
  currency: string;
  created_at: string;
  updated_at: string;
}
