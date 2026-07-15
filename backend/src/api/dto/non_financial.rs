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
pub struct NfCreateMemberRequest {
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
pub struct NfUpdateMemberRequest {
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
pub struct NfMemberResponse {
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

impl From<crate::entities::member::Model> for NfMemberResponse {
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
    pub farm_coop: usize,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RowsImported {
    pub members: u64,
    pub savings_accounts: u64,
    pub loans: u64,
    pub fixed_deposits: u64,
    pub farm_coop: u64,
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
pub struct NfPaginatedMembersResponse {
    pub data: Vec<NfMemberResponse>,
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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateFarmCoopRequest {
    #[serde(default)]
    pub submission_id: Option<Uuid>,
    #[serde(default)]
    pub cooperative_type: String,
    #[serde(default)]
    pub primary_activities: String,
    #[serde(default)]
    pub year_of_establishment: Option<i32>,
    #[serde(default)]
    pub operational_status: String,
    #[serde(default)]
    pub active_producer_flag: bool,
    #[serde(default)]
    pub production_type: String,
    #[serde(default)]
    pub participation_frequency: String,
    #[serde(default)]
    pub delivery_compliance: String,
    #[serde(default)]
    pub production_cycle_type: String,
    #[serde(default)]
    pub use_of_production_planning: bool,
    #[serde(default)]
    pub use_of_shared_inputs: bool,
    #[serde(default)]
    pub quality_compliance_flag: bool,
    #[serde(default)]
    pub market_channel_type: String,
    #[serde(default)]
    pub formal_offtake_agreement: bool,
    #[serde(default)]
    pub buyer_concentration_flag: bool,
    #[serde(default)]
    pub price_predictability_category: String,
    #[serde(default)]
    pub access_to_storage: bool,
    #[serde(default)]
    pub access_to_processing_facilities: bool,
    #[serde(default)]
    pub transport_coordination: String,
    #[serde(default)]
    pub climate_exposure_type: String,
    #[serde(default)]
    pub irrigation_access: bool,
    #[serde(default)]
    pub climate_mitigation_practices: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateFarmCoopRequest {
    #[serde(default)]
    pub cooperative_type: Option<String>,
    #[serde(default)]
    pub primary_activities: Option<String>,
    #[serde(default)]
    pub year_of_establishment: Option<i32>,
    #[serde(default)]
    pub operational_status: Option<String>,
    #[serde(default)]
    pub active_producer_flag: Option<bool>,
    #[serde(default)]
    pub production_type: Option<String>,
    #[serde(default)]
    pub participation_frequency: Option<String>,
    #[serde(default)]
    pub delivery_compliance: Option<String>,
    #[serde(default)]
    pub production_cycle_type: Option<String>,
    #[serde(default)]
    pub use_of_production_planning: Option<bool>,
    #[serde(default)]
    pub use_of_shared_inputs: Option<bool>,
    #[serde(default)]
    pub quality_compliance_flag: Option<bool>,
    #[serde(default)]
    pub market_channel_type: Option<String>,
    #[serde(default)]
    pub formal_offtake_agreement: Option<bool>,
    #[serde(default)]
    pub buyer_concentration_flag: Option<bool>,
    #[serde(default)]
    pub price_predictability_category: Option<String>,
    #[serde(default)]
    pub access_to_storage: Option<bool>,
    #[serde(default)]
    pub access_to_processing_facilities: Option<bool>,
    #[serde(default)]
    pub transport_coordination: Option<String>,
    #[serde(default)]
    pub climate_exposure_type: Option<String>,
    #[serde(default)]
    pub irrigation_access: Option<bool>,
    #[serde(default)]
    pub climate_mitigation_practices: Option<String>,
    #[serde(default)]
    pub submission_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FarmCoopResponse {
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub cooperative_type: String,
    pub primary_activities: String,
    pub year_of_establishment: Option<i32>,
    pub operational_status: String,
    pub active_producer_flag: bool,
    pub production_type: String,
    pub participation_frequency: String,
    pub delivery_compliance: String,
    pub production_cycle_type: String,
    pub use_of_production_planning: bool,
    pub use_of_shared_inputs: bool,
    pub quality_compliance_flag: bool,
    pub market_channel_type: String,
    pub formal_offtake_agreement: bool,
    pub buyer_concentration_flag: bool,
    pub price_predictability_category: String,
    pub access_to_storage: bool,
    pub access_to_processing_facilities: bool,
    pub transport_coordination: String,
    pub climate_exposure_type: String,
    pub irrigation_access: bool,
    pub climate_mitigation_practices: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::farm_coop::Model> for FarmCoopResponse {
    fn from(m: crate::entities::farm_coop::Model) -> Self {
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            submission_id: m.submission_id,
            cooperative_type: m.cooperative_type,
            primary_activities: m.primary_activities,
            year_of_establishment: m.year_of_establishment,
            operational_status: m.operational_status,
            active_producer_flag: m.active_producer_flag,
            production_type: m.production_type,
            participation_frequency: m.participation_frequency,
            delivery_compliance: m.delivery_compliance,
            production_cycle_type: m.production_cycle_type,
            use_of_production_planning: m.use_of_production_planning,
            use_of_shared_inputs: m.use_of_shared_inputs,
            quality_compliance_flag: m.quality_compliance_flag,
            market_channel_type: m.market_channel_type,
            formal_offtake_agreement: m.formal_offtake_agreement,
            buyer_concentration_flag: m.buyer_concentration_flag,
            price_predictability_category: m.price_predictability_category,
            access_to_storage: m.access_to_storage,
            access_to_processing_facilities: m.access_to_processing_facilities,
            transport_coordination: m.transport_coordination,
            climate_exposure_type: m.climate_exposure_type,
            irrigation_access: m.irrigation_access,
            climate_mitigation_practices: m.climate_mitigation_practices,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedFarmCoopResponse {
    pub data: Vec<FarmCoopResponse>,
    pub page: u64,
    pub page_size: u64,
    pub total: u64,
}

// ── NF Indicator Statistics ───────────────────────────────────────────────────

use crate::services::nf_indicator_engine::{
    FarmCoopStats as EngineFarmCoopStats, FixedDepositStats as EngineFixedDepositStats,
    LoanStats as EngineLoanStats, MembershipStats as EngineMembershipStats,
    NfStatisticsResponse as EngineNfStatisticsResponse, SavingsStats as EngineSavingsStats,
};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MembershipStatsDto {
    pub total: u64,
    pub active: u64,
    pub dormant: u64,
    pub exited: u64,
    pub male: u64,
    pub female: u64,
    pub other: u64,
    pub under_18: u64,
    pub age_18_35: u64,
    pub age_36_50: u64,
    pub over_50: u64,
    pub urban: u64,
    pub rural: u64,
    pub agm_attendance: u64,
    pub leadership_count: u64,
    pub voting_count: u64,
    pub active_pct: f64,
    pub dormancy_pct: f64,
    pub exit_pct: f64,
    pub male_pct: f64,
    pub female_pct: f64,
    pub other_pct: f64,
    pub youth_pct: f64,
    pub adult_pct: f64,
    pub urban_pct: f64,
    pub rural_pct: f64,
    pub agm_participation_pct: f64,
    pub women_in_governance_pct: f64,
    pub youth_in_governance_pct: f64,
}

impl From<EngineMembershipStats> for MembershipStatsDto {
    fn from(s: EngineMembershipStats) -> Self {
        Self {
            total: s.total,
            active: s.active,
            dormant: s.dormant,
            exited: s.exited,
            male: s.male,
            female: s.female,
            other: s.other,
            under_18: s.under_18,
            age_18_35: s.age_18_35,
            age_36_50: s.age_36_50,
            over_50: s.over_50,
            urban: s.urban,
            rural: s.rural,
            agm_attendance: s.agm_attendance,
            leadership_count: s.leadership_count,
            voting_count: s.voting_count,
            active_pct: s.active_pct,
            dormancy_pct: s.dormancy_pct,
            exit_pct: s.exit_pct,
            male_pct: s.male_pct,
            female_pct: s.female_pct,
            other_pct: s.other_pct,
            youth_pct: s.youth_pct,
            adult_pct: s.adult_pct,
            urban_pct: s.urban_pct,
            rural_pct: s.rural_pct,
            agm_participation_pct: s.agm_participation_pct,
            women_in_governance_pct: s.women_in_governance_pct,
            youth_in_governance_pct: s.youth_in_governance_pct,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SavingsStatsDto {
    pub total_accounts: u64,
    pub active_accounts: u64,
    pub dormant_accounts: u64,
    pub zero_balance_count: u64,
    pub increasing_trend: u64,
    pub stable_trend: u64,
    pub declining_trend: u64,
    pub high_withdrawal_count: u64,
    pub emergency_withdrawal_count: u64,
    pub total_balance: f64,
    pub average_balance: f64,
    pub savings_penetration_pct: f64,
    pub active_savers_pct: f64,
    pub dormant_savings_pct: f64,
    pub zero_balance_pct: f64,
    pub increasing_trend_pct: f64,
    pub regular_savers_pct: f64,
}

impl From<EngineSavingsStats> for SavingsStatsDto {
    fn from(s: EngineSavingsStats) -> Self {
        Self {
            total_accounts: s.total_accounts,
            active_accounts: s.active_accounts,
            dormant_accounts: s.dormant_accounts,
            zero_balance_count: s.zero_balance_count,
            increasing_trend: s.increasing_trend,
            stable_trend: s.stable_trend,
            declining_trend: s.declining_trend,
            high_withdrawal_count: s.high_withdrawal_count,
            emergency_withdrawal_count: s.emergency_withdrawal_count,
            total_balance: s.total_balance,
            average_balance: s.average_balance,
            savings_penetration_pct: s.savings_penetration_pct,
            active_savers_pct: s.active_savers_pct,
            dormant_savings_pct: s.dormant_savings_pct,
            zero_balance_pct: s.zero_balance_pct,
            increasing_trend_pct: s.increasing_trend_pct,
            regular_savers_pct: s.regular_savers_pct,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoanStatsDto {
    pub total_loans: u64,
    pub active_loans: u64,
    pub performing: u64,
    pub arrears: u64,
    pub restructured: u64,
    pub written_off: u64,
    pub members_with_loans: u64,
    pub youth_borrowers: u64,
    pub women_borrowers: u64,
    pub rural_borrowers: u64,
    pub multiple_loan_count: u64,
    pub large_borrower_count: u64,
    pub total_balance: f64,
    pub total_loan_amount: f64,
    pub average_loan_size: f64,
    pub on_time_repayment_pct: f64,
    pub arrears_rate_pct: f64,
    pub restructured_pct: f64,
    pub credit_penetration_pct: f64,
    pub youth_borrower_pct: f64,
    pub women_borrower_pct: f64,
    pub rural_borrower_pct: f64,
}

impl From<EngineLoanStats> for LoanStatsDto {
    fn from(s: EngineLoanStats) -> Self {
        Self {
            total_loans: s.total_loans,
            active_loans: s.active_loans,
            performing: s.performing,
            arrears: s.arrears,
            restructured: s.restructured,
            written_off: s.written_off,
            members_with_loans: s.members_with_loans,
            youth_borrowers: s.youth_borrowers,
            women_borrowers: s.women_borrowers,
            rural_borrowers: s.rural_borrowers,
            multiple_loan_count: s.multiple_loan_count,
            large_borrower_count: s.large_borrower_count,
            total_balance: s.total_balance,
            total_loan_amount: s.total_loan_amount,
            average_loan_size: s.average_loan_size,
            on_time_repayment_pct: s.on_time_repayment_pct,
            arrears_rate_pct: s.arrears_rate_pct,
            restructured_pct: s.restructured_pct,
            credit_penetration_pct: s.credit_penetration_pct,
            youth_borrower_pct: s.youth_borrower_pct,
            women_borrower_pct: s.women_borrower_pct,
            rural_borrower_pct: s.rural_borrower_pct,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FixedDepositStatsDto {
    pub total_fds: u64,
    pub active_fds: u64,
    pub matured_fds: u64,
    pub withdrawn_fds: u64,
    pub rolled_over_fds: u64,
    pub members_with_fds: u64,
    pub early_withdrawal_count: u64,
    pub single_depositor_count: u64,
    pub total_balance: f64,
    pub average_balance: f64,
    pub fd_penetration_pct: f64,
    pub early_withdrawal_pct: f64,
    pub rollover_rate_pct: f64,
    pub concentration_risk_pct: f64,
}

impl From<EngineFixedDepositStats> for FixedDepositStatsDto {
    fn from(s: EngineFixedDepositStats) -> Self {
        Self {
            total_fds: s.total_fds,
            active_fds: s.active_fds,
            matured_fds: s.matured_fds,
            withdrawn_fds: s.withdrawn_fds,
            rolled_over_fds: s.rolled_over_fds,
            members_with_fds: s.members_with_fds,
            early_withdrawal_count: s.early_withdrawal_count,
            single_depositor_count: s.single_depositor_count,
            total_balance: s.total_balance,
            average_balance: s.average_balance,
            fd_penetration_pct: s.fd_penetration_pct,
            early_withdrawal_pct: s.early_withdrawal_pct,
            rollover_rate_pct: s.rollover_rate_pct,
            concentration_risk_pct: s.concentration_risk_pct,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FarmCoopStatsDto {
    pub total_coops: u64,
    pub active_producers: u64,
    pub using_planning: u64,
    pub using_shared_inputs: u64,
    pub with_offtake_agreement: u64,
    pub with_storage: u64,
    pub with_processing: u64,
    pub with_irrigation: u64,
    pub with_climate_mitigation: u64,
    pub active_producer_pct: f64,
    pub planning_adoption_pct: f64,
    pub shared_services_pct: f64,
    pub formal_offtake_pct: f64,
    pub storage_coverage_pct: f64,
    pub processing_access_pct: f64,
    pub irrigation_coverage_pct: f64,
    pub climate_mitigation_pct: f64,
}

impl From<EngineFarmCoopStats> for FarmCoopStatsDto {
    fn from(s: EngineFarmCoopStats) -> Self {
        Self {
            total_coops: s.total_coops,
            active_producers: s.active_producers,
            using_planning: s.using_planning,
            using_shared_inputs: s.using_shared_inputs,
            with_offtake_agreement: s.with_offtake_agreement,
            with_storage: s.with_storage,
            with_processing: s.with_processing,
            with_irrigation: s.with_irrigation,
            with_climate_mitigation: s.with_climate_mitigation,
            active_producer_pct: s.active_producer_pct,
            planning_adoption_pct: s.planning_adoption_pct,
            shared_services_pct: s.shared_services_pct,
            formal_offtake_pct: s.formal_offtake_pct,
            storage_coverage_pct: s.storage_coverage_pct,
            processing_access_pct: s.processing_access_pct,
            irrigation_coverage_pct: s.irrigation_coverage_pct,
            climate_mitigation_pct: s.climate_mitigation_pct,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct NfStatisticsResponse {
    pub membership: MembershipStatsDto,
    pub savings: SavingsStatsDto,
    pub loans: LoanStatsDto,
    pub fixed_deposits: FixedDepositStatsDto,
    pub farm_coop: FarmCoopStatsDto,
    pub computed_at: chrono::DateTime<Utc>,
}

impl From<EngineNfStatisticsResponse> for NfStatisticsResponse {
    fn from(r: EngineNfStatisticsResponse) -> Self {
        Self {
            membership: r.membership.into(),
            savings: r.savings.into(),
            loans: r.loans.into(),
            fixed_deposits: r.fixed_deposits.into(),
            farm_coop: r.farm_coop.into(),
            computed_at: r.computed_at,
        }
    }
}
