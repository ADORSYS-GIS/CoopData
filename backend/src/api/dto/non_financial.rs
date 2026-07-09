use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::entities::enums::{
    AccountType, AgeGroup, DpdCategory, EswatiniRegion, FdStatus, Gender, LoanStatus, MemberStatus,
    UrbanRural,
};
use crate::services::nf_excel_parser::{NfParseError, NfParseWarning};

fn default_active() -> MemberStatus {
    MemberStatus::Active
}

fn default_account_active() -> String {
    "Active".to_string()
}

fn default_performing() -> LoanStatus {
    LoanStatus::Performing
}

fn default_fd_active() -> FdStatus {
    FdStatus::Active
}

fn default_zero_dpd() -> DpdCategory {
    DpdCategory::Zero
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateMemberRequest {
    pub member_id: String,
    pub join_date: NaiveDate,
    #[serde(default = "default_active")]
    pub status: MemberStatus,
    #[serde(default)]
    pub exit_date: Option<NaiveDate>,
    pub gender: Gender,
    pub age_group: AgeGroup,
    pub region: EswatiniRegion,
    pub urban_rural: UrbanRural,
    #[serde(default)]
    pub agm_attendance: bool,
    #[serde(default)]
    pub leadership_role: Option<String>,
    #[serde(default)]
    pub voting_exercised: bool,
    #[serde(default)]
    pub submission_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateMemberRequest {
    #[serde(default)]
    pub join_date: Option<NaiveDate>,
    #[serde(default)]
    pub status: Option<MemberStatus>,
    #[serde(default)]
    pub exit_date: Option<Option<NaiveDate>>,
    #[serde(default)]
    pub gender: Option<Gender>,
    #[serde(default)]
    pub age_group: Option<AgeGroup>,
    #[serde(default)]
    pub region: Option<EswatiniRegion>,
    #[serde(default)]
    pub urban_rural: Option<UrbanRural>,
    #[serde(default)]
    pub agm_attendance: Option<bool>,
    #[serde(default)]
    pub leadership_role: Option<Option<String>>,
    #[serde(default)]
    pub voting_exercised: Option<bool>,
    #[serde(default)]
    pub submission_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MemberResponse {
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub member_id: String,
    pub join_date: NaiveDate,
    pub status: MemberStatus,
    pub exit_date: Option<NaiveDate>,
    pub gender: Gender,
    pub age_group: AgeGroup,
    pub region: EswatiniRegion,
    pub urban_rural: UrbanRural,
    pub agm_attendance: bool,
    pub leadership_role: Option<String>,
    pub voting_exercised: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::member::Model> for MemberResponse {
    fn from(m: crate::entities::member::Model) -> Self {
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            submission_id: m.submission_id,
            member_id: m.member_id,
            join_date: m.join_date,
            status: m.status,
            exit_date: m.exit_date,
            gender: m.gender,
            age_group: m.age_group,
            region: m.region,
            urban_rural: m.urban_rural,
            agm_attendance: m.agm_attendance,
            leadership_role: m.leadership_role,
            voting_exercised: m.voting_exercised,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateSavingsAccountRequest {
    pub member_id: Uuid,
    pub savings_account_id: String,
    pub account_type: AccountType,
    pub account_opening_date: NaiveDate,
    #[serde(default = "default_account_active")]
    pub account_status: String,
    #[serde(default)]
    pub contribution_frequency: String,
    #[serde(default)]
    pub last_contribution_date: Option<NaiveDate>,
    #[serde(default)]
    pub number_of_contributions: i32,
    #[serde(default)]
    pub balance_trend: String,
    #[serde(default)]
    pub zero_balance_flag: bool,
    #[serde(default)]
    pub withdrawal_frequency_category: String,
    #[serde(default)]
    pub emergency_withdrawals_flag: bool,
    #[serde(default)]
    pub interest_rate: Decimal,
    #[serde(default)]
    pub balance: Decimal,
    #[serde(default)]
    pub submission_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateSavingsAccountRequest {
    #[serde(default)]
    pub account_type: Option<AccountType>,
    #[serde(default)]
    pub account_status: Option<String>,
    #[serde(default)]
    pub contribution_frequency: Option<String>,
    #[serde(default)]
    pub last_contribution_date: Option<Option<NaiveDate>>,
    #[serde(default)]
    pub number_of_contributions: Option<i32>,
    #[serde(default)]
    pub balance_trend: Option<String>,
    #[serde(default)]
    pub zero_balance_flag: Option<bool>,
    #[serde(default)]
    pub withdrawal_frequency_category: Option<String>,
    #[serde(default)]
    pub emergency_withdrawals_flag: Option<bool>,
    #[serde(default)]
    pub interest_rate: Option<Decimal>,
    #[serde(default)]
    pub balance: Option<Decimal>,
    #[serde(default)]
    pub submission_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SavingsAccountResponse {
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub savings_account_id: String,
    pub account_type: AccountType,
    pub account_opening_date: NaiveDate,
    pub account_status: String,
    pub contribution_frequency: String,
    pub last_contribution_date: NaiveDate,
    pub number_of_contributions: i32,
    pub balance_trend: String,
    pub zero_balance_flag: bool,
    pub withdrawal_frequency_category: String,
    pub emergency_withdrawals_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::savings_account::Model> for SavingsAccountResponse {
    fn from(m: crate::entities::savings_account::Model) -> Self {
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            submission_id: m.submission_id,
            member_id: m.member_id,
            savings_account_id: m.savings_account_id,
            account_type: m.account_type,
            account_opening_date: m.account_opening_date,
            account_status: m.account_status,
            contribution_frequency: m.contribution_frequency,
            last_contribution_date: m.last_contribution_date,
            number_of_contributions: m.number_of_contributions,
            balance_trend: m.balance_trend,
            zero_balance_flag: m.zero_balance_flag,
            withdrawal_frequency_category: m.withdrawal_frequency_category,
            emergency_withdrawals_flag: m.emergency_withdrawals_flag,
            interest_rate: m.interest_rate,
            balance: m.balance,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateLoanRequest {
    pub member_id: Uuid,
    pub loan_id: String,
    pub loan_product_type: String,
    pub loan_start_date: NaiveDate,
    pub loan_maturity_date: NaiveDate,
    #[serde(default = "default_performing")]
    pub loan_status: LoanStatus,
    #[serde(default)]
    pub borrower_type: String,
    #[serde(default)]
    pub youth_borrower_flag: bool,
    #[serde(default)]
    pub women_borrower_flag: bool,
    #[serde(default)]
    pub rural_borrower_flag: bool,
    #[serde(default)]
    pub repayment_regularity: String,
    #[serde(default = "default_zero_dpd")]
    pub days_past_due_category: DpdCategory,
    #[serde(default)]
    pub missed_installments_count: i32,
    #[serde(default)]
    pub restructured_loan_flag: bool,
    #[serde(default)]
    pub number_of_restructurings: i32,
    #[serde(default)]
    pub early_settlement_flag: bool,
    #[serde(default)]
    pub multiple_loans_flag: bool,
    #[serde(default)]
    pub large_borrower_flag: bool,
    #[serde(default)]
    pub interest_rate: Decimal,
    #[serde(default)]
    pub balance: Decimal,
    #[serde(default)]
    pub loan_amount: Decimal,
    #[serde(default)]
    pub submission_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateLoanRequest {
    #[serde(default)]
    pub loan_product_type: Option<String>,
    #[serde(default)]
    pub loan_start_date: Option<NaiveDate>,
    #[serde(default)]
    pub loan_maturity_date: Option<NaiveDate>,
    #[serde(default)]
    pub loan_status: Option<LoanStatus>,
    #[serde(default)]
    pub borrower_type: Option<String>,
    #[serde(default)]
    pub youth_borrower_flag: Option<bool>,
    #[serde(default)]
    pub women_borrower_flag: Option<bool>,
    #[serde(default)]
    pub rural_borrower_flag: Option<bool>,
    #[serde(default)]
    pub repayment_regularity: Option<String>,
    #[serde(default)]
    pub days_past_due_category: Option<DpdCategory>,
    #[serde(default)]
    pub missed_installments_count: Option<i32>,
    #[serde(default)]
    pub restructured_loan_flag: Option<bool>,
    #[serde(default)]
    pub number_of_restructurings: Option<i32>,
    #[serde(default)]
    pub early_settlement_flag: Option<bool>,
    #[serde(default)]
    pub multiple_loans_flag: Option<bool>,
    #[serde(default)]
    pub large_borrower_flag: Option<bool>,
    #[serde(default)]
    pub interest_rate: Option<Decimal>,
    #[serde(default)]
    pub balance: Option<Decimal>,
    #[serde(default)]
    pub loan_amount: Option<Decimal>,
    #[serde(default)]
    pub submission_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoanResponse {
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub loan_id: String,
    pub loan_product_type: String,
    pub loan_start_date: NaiveDate,
    pub loan_maturity_date: NaiveDate,
    pub loan_status: LoanStatus,
    pub borrower_type: String,
    pub youth_borrower_flag: bool,
    pub women_borrower_flag: bool,
    pub rural_borrower_flag: bool,
    pub repayment_regularity: String,
    pub days_past_due_category: DpdCategory,
    pub missed_installments_count: i32,
    pub restructured_loan_flag: bool,
    pub number_of_restructurings: i32,
    pub early_settlement_flag: bool,
    pub multiple_loans_flag: bool,
    pub large_borrower_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
    pub loan_amount: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::loan::Model> for LoanResponse {
    fn from(m: crate::entities::loan::Model) -> Self {
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            submission_id: m.submission_id,
            member_id: m.member_id,
            loan_id: m.loan_id,
            loan_product_type: m.loan_product_type,
            loan_start_date: m.loan_start_date,
            loan_maturity_date: m.loan_maturity_date,
            loan_status: m.loan_status,
            borrower_type: m.borrower_type,
            youth_borrower_flag: m.youth_borrower_flag,
            women_borrower_flag: m.women_borrower_flag,
            rural_borrower_flag: m.rural_borrower_flag,
            repayment_regularity: m.repayment_regularity,
            days_past_due_category: m.days_past_due_category,
            missed_installments_count: m.missed_installments_count,
            restructured_loan_flag: m.restructured_loan_flag,
            number_of_restructurings: m.number_of_restructurings,
            early_settlement_flag: m.early_settlement_flag,
            multiple_loans_flag: m.multiple_loans_flag,
            large_borrower_flag: m.large_borrower_flag,
            interest_rate: m.interest_rate,
            balance: m.balance,
            loan_amount: m.loan_amount,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateFixedDepositRequest {
    pub member_id: Uuid,
    pub fixed_deposit_id: String,
    pub deposit_type: String,
    pub start_date: NaiveDate,
    pub maturity_date: NaiveDate,
    #[serde(default = "default_fd_active")]
    pub status: FdStatus,
    #[serde(default)]
    pub tenure_category: String,
    #[serde(default)]
    pub original_tenure_selected: String,
    #[serde(default)]
    pub early_withdrawal_flag: bool,
    #[serde(default)]
    pub rollover_at_maturity_flag: bool,
    #[serde(default)]
    pub number_of_renewals: i32,
    #[serde(default)]
    pub change_in_tenure_at_renewal: bool,
    #[serde(default)]
    pub single_depositor_dependency_flag: bool,
    #[serde(default)]
    pub interest_rate: Decimal,
    #[serde(default)]
    pub balance: Decimal,
    #[serde(default)]
    pub submission_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateFixedDepositRequest {
    #[serde(default)]
    pub deposit_type: Option<String>,
    #[serde(default)]
    pub start_date: Option<NaiveDate>,
    #[serde(default)]
    pub maturity_date: Option<NaiveDate>,
    #[serde(default)]
    pub status: Option<FdStatus>,
    #[serde(default)]
    pub tenure_category: Option<String>,
    #[serde(default)]
    pub original_tenure_selected: Option<String>,
    #[serde(default)]
    pub early_withdrawal_flag: Option<bool>,
    #[serde(default)]
    pub rollover_at_maturity_flag: Option<bool>,
    #[serde(default)]
    pub number_of_renewals: Option<i32>,
    #[serde(default)]
    pub change_in_tenure_at_renewal: Option<bool>,
    #[serde(default)]
    pub single_depositor_dependency_flag: Option<bool>,
    #[serde(default)]
    pub interest_rate: Option<Decimal>,
    #[serde(default)]
    pub balance: Option<Decimal>,
    #[serde(default)]
    pub submission_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FixedDepositResponse {
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub fixed_deposit_id: String,
    pub deposit_type: String,
    pub start_date: NaiveDate,
    pub maturity_date: NaiveDate,
    pub status: FdStatus,
    pub tenure_category: String,
    pub original_tenure_selected: String,
    pub early_withdrawal_flag: bool,
    pub rollover_at_maturity_flag: bool,
    pub number_of_renewals: i32,
    pub change_in_tenure_at_renewal: bool,
    pub single_depositor_dependency_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::fixed_deposit::Model> for FixedDepositResponse {
    fn from(m: crate::entities::fixed_deposit::Model) -> Self {
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            submission_id: m.submission_id,
            member_id: m.member_id,
            fixed_deposit_id: m.fixed_deposit_id,
            deposit_type: m.deposit_type,
            start_date: m.start_date,
            maturity_date: m.maturity_date,
            status: m.status,
            tenure_category: m.tenure_category,
            original_tenure_selected: m.original_tenure_selected,
            early_withdrawal_flag: m.early_withdrawal_flag,
            rollover_at_maturity_flag: m.rollover_at_maturity_flag,
            number_of_renewals: m.number_of_renewals,
            change_in_tenure_at_renewal: m.change_in_tenure_at_renewal,
            single_depositor_dependency_flag: m.single_depositor_dependency_flag,
            interest_rate: m.interest_rate,
            balance: m.balance,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RowsParsed {
    pub members: usize,
    pub savings_accounts: usize,
    pub loans: usize,
    pub fixed_deposits: usize,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RowsImported {
    pub members: u64,
    pub savings_accounts: u64,
    pub loans: u64,
    pub fixed_deposits: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct NfUploadResponse {
    pub upload_id: Uuid,
    pub submission_id: Uuid,
    pub sheets_found: Vec<String>,
    pub rows_parsed: RowsParsed,
    pub errors: Vec<NfParseError>,
    pub warnings: Vec<NfParseWarning>,
    pub rows_imported: RowsImported,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, IntoParams)]
pub struct NfListQueryParams {
    #[serde(default)]
    pub submission_id: Option<Uuid>,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_page_size")]
    pub page_size: u64,
}

fn default_page() -> u64 {
    1
}

fn default_page_size() -> u64 {
    50
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedMembersResponse {
    pub data: Vec<MemberResponse>,
    pub page: u64,
    pub page_size: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedSavingsAccountsResponse {
    pub data: Vec<SavingsAccountResponse>,
    pub page: u64,
    pub page_size: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedLoansResponse {
    pub data: Vec<LoanResponse>,
    pub page: u64,
    pub page_size: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedFixedDepositsResponse {
    pub data: Vec<FixedDepositResponse>,
    pub page: u64,
    pub page_size: u64,
    pub total: u64,
}
