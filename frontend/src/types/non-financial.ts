export type MemberStatus = "Active" | "Dormant" | "Exited";
export type Gender = "Male" | "Female" | "Other";
export type AgeGroup = "<18" | "18-35" | "36-50" | "50+";
export type AccountType = "Voluntary" | "Mandatory" | "Fixed";
export type LoanStatus = "Performing" | "Arrears" | "Restructured" | "WrittenOff";
export type DpdCategory = "0" | "1-30" | "31-60" | "61-90" | "91+";
export type FdStatus = "Active" | "Matured" | "Withdrawn" | "RolledOver";
export type EswatiniRegion = "Hhohho" | "Manzini" | "Shiselweni" | "Lubombo";
export type UrbanRural = "Urban" | "Rural";

export interface NfMemberResponse {
  id: string;
  cooperative_id: string;
  submission_id: string | null;
  member_id: string;
  join_date: string;
  status: MemberStatus;
  exit_date: string | null;
  gender: Gender;
  age_group: AgeGroup;
  region: EswatiniRegion;
  urban_rural: UrbanRural;
  agm_attendance: boolean;
  leadership_role: string | null;
  voting_exercised: boolean;
  share_balance?: number;
  created_at: string;
  updated_at: string;
}

export interface NfCreateMemberRequest {
  member_id: string;
  join_date: string;
  status: MemberStatus;
  exit_date?: string | null;
  gender: Gender;
  age_group: AgeGroup;
  region: EswatiniRegion;
  urban_rural: UrbanRural;
  agm_attendance: boolean;
  leadership_role?: string | null;
  voting_exercised: boolean;
}

export type NfUpdateMemberRequest = Partial<NfCreateMemberRequest>;

export interface SavingsAccountResponse {
  id: string;
  cooperative_id: string;
  submission_id: string | null;
  member_id: string;
  savings_account_id: string;
  account_type: AccountType;
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
  created_at: string;
  updated_at: string;
}

export interface CreateSavingsAccountRequest {
  member_id: string;
  savings_account_id: string;
  account_type: AccountType;
  account_opening_date: string;
  account_status?: string;
  contribution_frequency?: string;
  last_contribution_date?: string | null;
  number_of_contributions?: number;
  balance_trend?: string;
  zero_balance_flag?: boolean;
  withdrawal_frequency_category?: string;
  emergency_withdrawals_flag?: boolean;
  interest_rate?: number;
  balance?: number;
}

export type UpdateSavingsAccountRequest = Partial<CreateSavingsAccountRequest>;

export interface LoanResponse {
  id: string;
  cooperative_id: string;
  submission_id: string | null;
  member_id: string;
  loan_id: string;
  loan_product_type: string;
  loan_start_date: string;
  loan_maturity_date: string;
  loan_status: LoanStatus;
  borrower_type: string;
  youth_borrower_flag: boolean;
  women_borrower_flag: boolean;
  rural_borrower_flag: boolean;
  repayment_regularity: string;
  days_past_due_category: DpdCategory;
  missed_installments_count: number;
  restructured_loan_flag: boolean;
  number_of_restructurings: number;
  early_settlement_flag: boolean;
  multiple_loans_flag: boolean;
  large_borrower_flag: boolean;
  interest_rate: number;
  balance: number;
  loan_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLoanRequest {
  member_id: string;
  loan_id: string;
  loan_product_type: string;
  loan_start_date: string;
  loan_maturity_date: string;
  loan_status: LoanStatus;
  borrower_type?: string;
  youth_borrower_flag?: boolean;
  women_borrower_flag?: boolean;
  rural_borrower_flag?: boolean;
  repayment_regularity?: string;
  days_past_due_category?: DpdCategory;
  missed_installments_count?: number;
  restructured_loan_flag?: boolean;
  number_of_restructurings?: number;
  early_settlement_flag?: boolean;
  multiple_loans_flag?: boolean;
  large_borrower_flag?: boolean;
  interest_rate?: number;
  balance?: number;
  loan_amount?: number;
}

export type UpdateLoanRequest = Partial<CreateLoanRequest>;

export interface FixedDepositResponse {
  id: string;
  cooperative_id: string;
  submission_id: string | null;
  member_id: string;
  fixed_deposit_id: string;
  deposit_type: string;
  start_date: string;
  maturity_date: string;
  status: FdStatus;
  tenure_category: string;
  original_tenure_selected: string;
  early_withdrawal_flag: boolean;
  rollover_at_maturity_flag: boolean;
  number_of_renewals: number;
  change_in_tenure_at_renewal: boolean;
  single_depositor_dependency_flag: boolean;
  interest_rate: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFixedDepositRequest {
  member_id: string;
  fixed_deposit_id: string;
  deposit_type: string;
  start_date: string;
  maturity_date: string;
  status: FdStatus;
  tenure_category?: string;
  original_tenure_selected?: string;
  early_withdrawal_flag?: boolean;
  rollover_at_maturity_flag?: boolean;
  number_of_renewals?: number;
  change_in_tenure_at_renewal?: boolean;
  single_depositor_dependency_flag?: boolean;
  interest_rate?: number;
  balance?: number;
}

export type UpdateFixedDepositRequest = Partial<CreateFixedDepositRequest>;

export interface FarmCoopResponse {
  id: string;
  cooperative_id: string;
  submission_id: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface CreateFarmCoopRequest {
  submission_id?: string | null;
  cooperative_type: string;
  primary_activities: string;
  year_of_establishment?: number | null;
  operational_status: string;
  active_producer_flag?: boolean;
  production_type: string;
  participation_frequency: string;
  delivery_compliance: string;
  production_cycle_type: string;
  use_of_production_planning?: boolean;
  use_of_shared_inputs?: boolean;
  quality_compliance_flag?: boolean;
  market_channel_type: string;
  formal_offtake_agreement?: boolean;
  buyer_concentration_flag?: boolean;
  price_predictability_category: string;
  access_to_storage?: boolean;
  access_to_processing_facilities?: boolean;
  transport_coordination: string;
  climate_exposure_type: string;
  irrigation_access?: boolean;
  climate_mitigation_practices: string;
}

export type UpdateFarmCoopRequest = Partial<CreateFarmCoopRequest>;

export interface NfParseError {
  sheet: string;
  row: number;
  column: string;
  value: string;
  rule: string;
  message: string;
}

export interface NfParseWarning {
  sheet: string;
  row: number;
  column: string;
  rule: string;
  message: string;
}

export interface RowsCount {
  members: number;
  savings_accounts: number;
  loans: number;
  fixed_deposits: number;
  farm_coop: number;
}

export interface NfUploadResponse {
  upload_id: string;
  submission_id: string;
  sheets_found: string[];
  rows_parsed: RowsCount;
  errors: NfParseError[];
  warnings: NfParseWarning[];
  rows_imported: RowsCount;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface NfListParams {
  submission_id?: string;
  page?: number;
  page_size?: number;
}
