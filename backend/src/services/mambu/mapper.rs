use std::collections::HashMap;

use chrono::{Datelike, Duration, Months, NaiveDate};
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use sha2::{Digest, Sha256};

use crate::entities::enums::{
    AccountType, AgeGroup, DpdCategory, EswatiniRegion, FdStatus, Gender, LoanStatus, MemberStatus,
    UrbanRural,
};
use crate::services::mambu::models::{
    MambuBranch, MambuClient, MambuDeposit, MambuLoan, ReportItem,
};
use crate::services::nf_excel_parser::{
    FixedDepositRecord, LoanRecord, MemberRecord, SavingsAccountRecord,
};

pub const KIND_SHARE: &str = "Share";
pub const KIND_VOLUNTARY: &str = "Voluntary";
pub const KIND_MANDATORY: &str = "Mandatory";
pub const KIND_FIXED_DEPOSIT: &str = "FixedDeposit";
pub const KIND_IGNORE: &str = "Ignore";

const DEFAULT_FD_TERM_MONTHS: u32 = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropReason {
    Blacklisted,
    UnsupportedState,
    NotYetMember,
    ExitedBeforeYear,
    MissingJoinDate,
    MissingBirthDate,
    MissingRegion,
    NotOpenAtDate,
    NotDisbursed,
    ClosedBeforePeriod,
    MissingStartDate,
    UnknownHolder,
    ExitDateMissing,
    AccountNotActive,
}

impl DropReason {
    pub fn code(self) -> &'static str {
        match self {
            Self::Blacklisted => "MEMBER_BLACKLISTED",
            Self::UnsupportedState => "MEMBER_STATE_NOT_SUPPORTED",
            Self::NotYetMember => "MEMBER_JOINED_AFTER_DATE",
            Self::ExitedBeforeYear => "MEMBER_EXITED_BEFORE_YEAR",
            Self::MissingJoinDate => "MEMBER_JOIN_DATE_MISSING",
            Self::MissingBirthDate => "MEMBER_BIRTH_DATE_MISSING",
            Self::MissingRegion => "MEMBER_REGION_MISSING",
            Self::NotOpenAtDate => "ACCOUNT_NOT_OPEN_AT_DATE",
            Self::NotDisbursed => "LOAN_NOT_DISBURSED",
            Self::ClosedBeforePeriod => "LOAN_CLOSED_BEFORE_PERIOD",
            Self::MissingStartDate => "START_DATE_MISSING",
            Self::UnknownHolder => "HOLDER_NOT_IN_MEMBER_LIST",
            Self::ExitDateMissing => "MEMBER_EXIT_DATE_MISSING",
            Self::AccountNotActive => "ACCOUNT_NOT_ACTIVE",
        }
    }
}

pub fn month_end(year: i32, month: u32) -> Option<NaiveDate> {
    let first = NaiveDate::from_ymd_opt(year, month, 1)?;
    first
        .checked_add_months(Months::new(1))
        .map(|d| d - Duration::days(1))
}

pub fn date_part(value: &Option<String>) -> Option<NaiveDate> {
    let text = value.as_deref()?.trim();
    if text.len() < 10 {
        return None;
    }
    NaiveDate::parse_from_str(&text[..10], "%Y-%m-%d").ok()
}

/// Stable, non-reversible code derived from a Mambu encoded key. Used instead of
/// Mambu account ids, which can contain member names or national ID numbers.
pub fn code_from_key(prefix: &str, encoded_key: &str) -> String {
    let digest = Sha256::digest(encoded_key.as_bytes());
    let hex: String = digest.iter().take(6).map(|b| format!("{b:02x}")).collect();
    format!("{prefix}-{}", hex.to_uppercase())
}

pub fn to_decimal(value: f64) -> Decimal {
    Decimal::from_f64(value)
        .map(|d| d.round_dp(2))
        .unwrap_or_default()
}

pub fn branch_region(branch: &MambuBranch) -> Option<EswatiniRegion> {
    branch
        .addresses
        .iter()
        .filter_map(|a| a.region.as_deref())
        .find_map(EswatiniRegion::parse)
}

fn age_group(birth: NaiveDate, as_of: NaiveDate) -> AgeGroup {
    let mut age = as_of.year() - birth.year();
    if (as_of.month(), as_of.day()) < (birth.month(), birth.day()) {
        age -= 1;
    }
    match age {
        i32::MIN..=17 => AgeGroup::Under18,
        18..=35 => AgeGroup::Between18And35,
        36..=50 => AgeGroup::Between36And50,
        _ => AgeGroup::Over50,
    }
}

fn gender(value: &Option<String>) -> Gender {
    match value.as_deref().map(|g| g.trim().to_uppercase()).as_deref() {
        Some("MALE") => Gender::Male,
        Some("FEMALE") => Gender::Female,
        _ => Gender::Other,
    }
}

pub fn map_member(
    client: &MambuClient,
    fallback_region: Option<EswatiniRegion>,
    as_of: NaiveDate,
) -> Result<MemberRecord, DropReason> {
    let state = client.state.as_deref().unwrap_or("").to_uppercase();
    let category = client
        .adl
        .as_ref()
        .and_then(|a| a.mcat.as_deref())
        .unwrap_or("")
        .trim()
        .to_lowercase();

    let mut status = match state.as_str() {
        "ACTIVE" => MemberStatus::Active,
        "INACTIVE" => MemberStatus::Dormant,
        "EXITED" => MemberStatus::Exited,
        "BLACKLISTED" => return Err(DropReason::Blacklisted),
        _ => return Err(DropReason::UnsupportedState),
    };
    match category.as_str() {
        "deceased" => status = MemberStatus::Deceased,
        "resigned" if status == MemberStatus::Active => status = MemberStatus::Exited,
        _ => {}
    }

    let join_date = client
        .adl
        .as_ref()
        .and_then(|a| date_part(&a.date_joined))
        .or_else(|| date_part(&client.activation_date))
        .ok_or(DropReason::MissingJoinDate)?;
    if join_date > as_of {
        return Err(DropReason::NotYetMember);
    }

    let mut exit_date = client
        .adl
        .as_ref()
        .and_then(|a| date_part(&a.date_resigned_deceased))
        .or_else(|| date_part(&client.closed_date))
        .filter(|d| *d >= join_date);

    if matches!(status, MemberStatus::Exited | MemberStatus::Deceased) {
        match exit_date {
            Some(d) if d > as_of => {
                status = MemberStatus::Active;
                exit_date = None;
            }
            Some(d) if d.year() < as_of.year() => return Err(DropReason::ExitedBeforeYear),
            Some(_) => {}
            None => return Err(DropReason::ExitDateMissing),
        }
    } else {
        exit_date = None;
    }

    let birth = client
        .birth_date
        .as_deref()
        .and_then(|b| NaiveDate::parse_from_str(b.trim().get(..10)?, "%Y-%m-%d").ok())
        .ok_or(DropReason::MissingBirthDate)?;

    let region = client
        .adl
        .as_ref()
        .and_then(|a| a.region.as_deref())
        .and_then(EswatiniRegion::parse)
        .or(fallback_region)
        .ok_or(DropReason::MissingRegion)?;

    Ok(MemberRecord {
        member_id: client.id.clone(),
        join_date,
        status,
        exit_date,
        gender: gender(&client.gender),
        age_group: age_group(birth, as_of),
        region,
        urban_rural: UrbanRural::Unknown,
        agm_attendance: false,
        leadership_role: None,
        voting_exercised: false,
        share_balance: Decimal::ZERO,
    })
}

pub fn classify_deposit(deposit: &MambuDeposit, override_type: Option<&str>) -> &'static str {
    if let Some(o) = override_type {
        return match o {
            KIND_SHARE => KIND_SHARE,
            KIND_VOLUNTARY => KIND_VOLUNTARY,
            KIND_MANDATORY => KIND_MANDATORY,
            KIND_FIXED_DEPOSIT => KIND_FIXED_DEPOSIT,
            _ => KIND_IGNORE,
        };
    }
    let name = deposit.name.as_deref().unwrap_or("").to_lowercase();
    if name.contains("share") {
        return KIND_SHARE;
    }
    const IGNORED: [&str; 11] = [
        "collection",
        "settlement",
        "overpayment",
        "payout",
        "debtor",
        "interest",
        "tax",
        "transactional",
        "burial",
        "refund",
        "subscription",
    ];
    if IGNORED.iter().any(|k| name.contains(k)) {
        return KIND_IGNORE;
    }
    match deposit.account_type.as_deref().unwrap_or("") {
        "FIXED_DEPOSIT" | "SAVINGS_PLAN" => KIND_FIXED_DEPOSIT,
        _ if name.contains("mandatory") || name.contains("compulsory") => KIND_MANDATORY,
        _ => KIND_VOLUNTARY,
    }
}

fn account_in_service(state: &str) -> bool {
    matches!(
        state,
        "ACTIVE"
            | "ACTIVE_IN_ARREARS"
            | "DORMANT"
            | "LOCKED"
            | "MATURED"
            | "WITHDRAWN"
            | "CLOSED"
            | "CLOSED_WRITTEN_OFF"
    )
}

fn closed_like(state: &str) -> bool {
    matches!(state, "WITHDRAWN" | "CLOSED" | "CLOSED_WRITTEN_OFF")
}

fn open_at(
    deposit_activation: Option<NaiveDate>,
    closed: Option<NaiveDate>,
    as_of: NaiveDate,
) -> bool {
    match deposit_activation {
        Some(a) if a <= as_of => closed.map(|c| c > as_of).unwrap_or(true),
        _ => false,
    }
}

fn deposit_interest_rate(deposit: &MambuDeposit) -> Decimal {
    deposit
        .interest_settings
        .as_ref()
        .and_then(|s| s.interest_rate_settings.as_ref())
        .and_then(|r| r.interest_rate)
        .map(to_decimal)
        .unwrap_or_default()
}

pub fn share_balance_for(deposit: &MambuDeposit, as_of: NaiveDate) -> Option<Decimal> {
    let activation = date_part(&deposit.activation_date);
    let closed = date_part(&deposit.closed_date);
    if open_at(activation, closed, as_of) {
        Some(to_decimal(deposit.balances.total_balance))
    } else {
        None
    }
}

fn monthly_contribution(deposit: &MambuDeposit) -> f64 {
    deposit
        .centre_of_deduction
        .as_ref()
        .and_then(|c| c.monthly_contribution.as_ref())
        .and_then(|v| match v {
            serde_json::Value::Number(n) => n.as_f64(),
            serde_json::Value::String(s) => s.trim().parse().ok(),
            _ => None,
        })
        .unwrap_or(0.0)
}

pub fn map_savings(
    deposit: &MambuDeposit,
    holder_code: &str,
    kind: &str,
    as_of: NaiveDate,
) -> Result<SavingsAccountRecord, DropReason> {
    let state = deposit
        .account_state
        .as_deref()
        .unwrap_or("")
        .to_uppercase();
    if !account_in_service(&state) {
        return Err(DropReason::AccountNotActive);
    }
    let activation = date_part(&deposit.activation_date).ok_or(DropReason::MissingStartDate)?;
    let closed = date_part(&deposit.closed_date);
    if !open_at(Some(activation), closed, as_of) || (closed_like(&state) && closed.is_none()) {
        return Err(DropReason::NotOpenAtDate);
    }
    let account_status = if state == "DORMANT" {
        "Dormant"
    } else {
        "Active"
    };
    let balance = to_decimal(deposit.balances.total_balance);
    Ok(SavingsAccountRecord {
        member_business_id: holder_code.to_string(),
        savings_account_id: code_from_key("SA", &deposit.encoded_key),
        account_type: if kind == KIND_MANDATORY {
            AccountType::Mandatory
        } else {
            AccountType::Voluntary
        },
        account_opening_date: activation,
        account_status: account_status.to_string(),
        contribution_frequency: if monthly_contribution(deposit) > 0.0 {
            "Monthly".to_string()
        } else {
            "Irregular".to_string()
        },
        last_contribution_date: None,
        number_of_contributions: 0,
        balance_trend: "Stable".to_string(),
        zero_balance_flag: balance.is_zero(),
        withdrawal_frequency_category: "Low".to_string(),
        emergency_withdrawals_flag: false,
        interest_rate: deposit_interest_rate(deposit),
        balance,
    })
}

fn months_between(start: NaiveDate, end: NaiveDate) -> i32 {
    (end.year() - start.year()) * 12 + end.month() as i32 - start.month() as i32
}

pub fn map_fixed_deposit(
    deposit: &MambuDeposit,
    holder_code: &str,
    as_of: NaiveDate,
    product_term_months: Option<u32>,
) -> Result<(FixedDepositRecord, bool), DropReason> {
    let state = deposit
        .account_state
        .as_deref()
        .unwrap_or("")
        .to_uppercase();
    if !account_in_service(&state) {
        return Err(DropReason::AccountNotActive);
    }
    let start = date_part(&deposit.activation_date).ok_or(DropReason::MissingStartDate)?;
    if start > as_of {
        return Err(DropReason::NotOpenAtDate);
    }
    let closed = date_part(&deposit.closed_date);
    if let Some(c) = closed {
        if c <= as_of && c.year() != as_of.year() {
            return Err(DropReason::NotOpenAtDate);
        }
    }
    let explicit_maturity = date_part(&deposit.maturity_date);
    let maturity = explicit_maturity
        .or_else(|| {
            start.checked_add_months(Months::new(
                product_term_months.unwrap_or(DEFAULT_FD_TERM_MONTHS),
            ))
        })
        .unwrap_or(start);
    let maturity = if maturity < start { start } else { maturity };

    let state = deposit
        .account_state
        .as_deref()
        .unwrap_or("")
        .to_uppercase();
    let closed_by_date = closed.map(|c| c <= as_of).unwrap_or(false);
    let status = match state.as_str() {
        "MATURED" if maturity <= as_of => FdStatus::Matured,
        "WITHDRAWN" | "CLOSED" | "CLOSED_WRITTEN_OFF" if closed_by_date => {
            if closed.map(|c| c < maturity).unwrap_or(false) {
                FdStatus::Withdrawn
            } else {
                FdStatus::Matured
            }
        }
        _ if maturity <= as_of => FdStatus::Matured,
        _ => FdStatus::Active,
    };
    let early_withdrawal =
        matches!(status, FdStatus::Withdrawn) && closed.map(|c| c < maturity).unwrap_or(false);

    let term_months = months_between(start, maturity).max(0);
    let tenure_category = match term_months {
        0..=6 => "Short",
        7..=12 => "Medium",
        _ => "Long",
    };

    Ok((
        FixedDepositRecord {
            member_business_id: holder_code.to_string(),
            fixed_deposit_id: code_from_key("FD", &deposit.encoded_key),
            deposit_type: "Standard".to_string(),
            start_date: start,
            maturity_date: maturity,
            status,
            tenure_category: tenure_category.to_string(),
            original_tenure_selected: format!("{term_months} months"),
            early_withdrawal_flag: early_withdrawal,
            rollover_at_maturity_flag: false,
            number_of_renewals: 0,
            change_in_tenure_at_renewal: false,
            single_depositor_dependency_flag: false,
            interest_rate: deposit_interest_rate(deposit),
            balance: to_decimal(deposit.balances.total_balance),
        },
        explicit_maturity.is_none(),
    ))
}

pub fn loan_type_from(name: &str, purpose: Option<&str>, override_type: Option<&str>) -> String {
    if let Some(o) = override_type {
        return o.to_string();
    }
    let hay = format!("{} {}", name, purpose.unwrap_or("")).to_lowercase();
    let kind = if hay.contains("school") || hay.contains("educat") || hay.contains("study") {
        "Education"
    } else if hay.contains("agri") || hay.contains("farm") || hay.contains("crop") {
        "Agriculture"
    } else if hay.contains("business") || hay.contains("sme") || hay.contains("enterprise") {
        "Business"
    } else if hay.contains("building") || hay.contains("funeral") || hay.contains("mortgage") {
        "Other"
    } else {
        "Personal"
    };
    kind.to_string()
}

fn interest_per_year_factor(frequency: &str) -> u32 {
    match frequency {
        "EVERY_MONTH" => 12,
        "EVERY_FOUR_WEEKS" => 13,
        "EVERY_WEEK" => 52,
        "EVERY_DAY" => 365,
        _ => 1,
    }
}

fn loan_maturity(loan: &MambuLoan, start: NaiveDate) -> NaiveDate {
    let schedule = loan.schedule_settings.clone().unwrap_or_default();
    let installments = schedule.repayment_installments.unwrap_or(0).max(0);
    let period = schedule.repayment_period_count.unwrap_or(1).max(1);
    let first = loan
        .disbursement_details
        .as_ref()
        .and_then(|d| date_part(&d.first_repayment_date))
        .unwrap_or(start);
    if installments == 0 {
        return start;
    }
    let steps = (installments - 1) * period;
    let computed = match schedule
        .repayment_period_unit
        .as_deref()
        .unwrap_or("MONTHS")
    {
        "DAYS" => Some(first + Duration::days(steps)),
        "WEEKS" => Some(first + Duration::weeks(steps)),
        "YEARS" => first.checked_add_months(Months::new((steps * 12) as u32)),
        _ => first.checked_add_months(Months::new(steps as u32)),
    };
    computed.filter(|d| *d >= start).unwrap_or(start)
}

fn dpd_category(days: i64) -> DpdCategory {
    match days {
        i64::MIN..=0 => DpdCategory::Zero,
        1..=30 => DpdCategory::Days1To30,
        31..=60 => DpdCategory::Days31To60,
        61..=90 => DpdCategory::Days61To90,
        _ => DpdCategory::Days91Plus,
    }
}

pub fn map_loan(
    loan: &MambuLoan,
    borrower_code: &str,
    override_type: Option<&str>,
    as_of: NaiveDate,
) -> Result<LoanRecord, DropReason> {
    let state = loan.account_state.as_deref().unwrap_or("").to_uppercase();
    let sub_state = loan
        .account_sub_state
        .as_deref()
        .unwrap_or("")
        .to_uppercase();
    if matches!(
        state.as_str(),
        "PARTIAL_APPLICATION" | "PENDING_APPROVAL" | "APPROVED" | "CLOSED_REJECTED"
    ) || matches!(sub_state.as_str(), "WITHDRAWN" | "REJECTED")
    {
        return Err(DropReason::NotDisbursed);
    }
    let start = loan
        .disbursement_details
        .as_ref()
        .and_then(|d| date_part(&d.disbursement_date))
        .ok_or(DropReason::MissingStartDate)?;
    if start > as_of {
        return Err(DropReason::NotDisbursed);
    }
    let period_start = NaiveDate::from_ymd_opt(as_of.year(), as_of.month(), 1).unwrap_or(as_of);
    if let Some(closed) = date_part(&loan.closed_date) {
        if closed < period_start {
            return Err(DropReason::ClosedBeforePeriod);
        }
    }

    let days = loan.days_in_arrears.unwrap_or(0).max(0);
    let status = if state == "CLOSED_WRITTEN_OFF" || sub_state == "WRITTEN_OFF" {
        LoanStatus::WrittenOff
    } else if matches!(sub_state.as_str(), "RESCHEDULED" | "REFINANCED") {
        LoanStatus::Restructured
    } else if state == "ACTIVE_IN_ARREARS" && days > 0 {
        LoanStatus::Arrears
    } else {
        LoanStatus::Performing
    };
    let days = if status == LoanStatus::Performing {
        0
    } else {
        days
    };
    let regularity = match status {
        LoanStatus::WrittenOff => "Default",
        _ if days == 0 => "Regular",
        _ if days > 90 => "Default",
        _ => "Irregular",
    };

    let rate = loan
        .interest_settings
        .as_ref()
        .and_then(|s| {
            s.interest_rate.map(|r| {
                r * f64::from(interest_per_year_factor(
                    s.interest_charge_frequency.as_deref().unwrap_or(""),
                ))
            })
        })
        .map(to_decimal)
        .unwrap_or_default();

    let restructured = status == LoanStatus::Restructured;
    let product_name = loan.loan_name.as_deref().unwrap_or("");
    let purpose = loan.loan_info.as_ref().and_then(|i| i.loanp.as_deref());

    Ok(LoanRecord {
        member_business_id: borrower_code.to_string(),
        loan_id: code_from_key("LN", &loan.encoded_key),
        loan_product_type: loan_type_from(product_name, purpose, override_type),
        loan_start_date: start,
        loan_maturity_date: loan_maturity(loan, start),
        loan_status: status.clone(),
        borrower_type: if loan.account_holder_type.as_deref() == Some("GROUP") {
            "Group".to_string()
        } else {
            "Individual".to_string()
        },
        youth_borrower_flag: false,
        women_borrower_flag: false,
        rural_borrower_flag: false,
        repayment_regularity: regularity.to_string(),
        days_past_due_category: dpd_category(days),
        missed_installments_count: 0,
        restructured_loan_flag: restructured,
        number_of_restructurings: i32::from(restructured),
        early_settlement_flag: false,
        multiple_loans_flag: false,
        large_borrower_flag: false,
        interest_rate: rate,
        balance: if matches!(status, LoanStatus::WrittenOff) {
            Decimal::ZERO
        } else {
            to_decimal(loan.balances.principal_balance)
        },
        loan_amount: to_decimal(loan.loan_amount),
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct LedgerLine {
    pub account_code: i32,
    pub value: Decimal,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UnmappedAccount {
    pub gl_code: String,
    pub value: Decimal,
}

/// Whether a Mambu report can be trusted.
#[derive(Debug, Clone, Default, PartialEq)]
pub enum LedgerStatus {
    #[default]
    Balanced,
    /// Neither sign style makes assets equal liabilities plus equity plus earnings.
    /// The report is not used. `gap` is the smaller difference found.
    Unbalanced { gap: Decimal },
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct LedgerResult {
    pub lines: Vec<LedgerLine>,
    pub unmapped: Vec<UnmappedAccount>,
    pub status: LedgerStatus,
    /// True when accumulated and current year surplus were split with a verified
    /// year-to-date report. Otherwise all earnings sit in the accumulated line.
    pub surplus_split: bool,
}

pub const ACCUMULATED_SURPLUS_CODE: i32 = 3301;
pub const CURRENT_YEAR_SURPLUS_CODE: i32 = 3302;

fn reportable(item: &ReportItem) -> bool {
    let account = &item.gl_account;
    if account.usage.as_deref() == Some("HEADER") {
        return false;
    }
    let currency = account
        .currency
        .as_ref()
        .and_then(|c| c.currency_code.as_deref());
    !matches!(currency, Some(c) if c != "SZL")
}

/// Account that takes the balance of a Mambu account that has no mapping yet, so
/// the statement still balances. The account is reported as unmapped.
fn default_account(account_type: &str) -> Option<i32> {
    match account_type {
        "ASSET" => Some(1301),
        "LIABILITY" => Some(2301),
        "EQUITY" => Some(3202),
        "INCOME" => Some(4201),
        "EXPENSE" => Some(5202),
        _ => None,
    }
}

/// Finds the CoopData account of a Mambu ledger account.
///
/// An account with its own mapping uses it. Any other account follows its balance
/// sheet group: the nearest header account of the same type at or below its code
/// (for example 1126 follows header 1100). New Mambu accounts are therefore mapped
/// as soon as their header is.
pub struct MappingResolver<'a> {
    direct: &'a HashMap<String, (i32, i16)>,
    headers: Vec<(String, u64, String)>,
}

impl<'a> MappingResolver<'a> {
    pub fn new<'b>(
        direct: &'a HashMap<String, (i32, i16)>,
        headers: impl IntoIterator<Item = (&'b str, &'b str)>,
    ) -> Self {
        let headers = headers
            .into_iter()
            .filter_map(|(account_type, code)| {
                Some((
                    account_type.to_string(),
                    code.parse::<u64>().ok()?,
                    code.to_string(),
                ))
            })
            .collect();
        Self { direct, headers }
    }

    pub fn resolve(&self, gl_code: &str, account_type: &str) -> Option<(i32, i16)> {
        if let Some(found) = self.direct.get(gl_code) {
            return Some(*found);
        }
        let number = gl_code.parse::<u64>().ok()?;
        self.headers
            .iter()
            .filter(|(t, n, code)| {
                t == account_type && *n <= number && self.direct.contains_key(code)
            })
            .max_by_key(|(_, n, _)| *n)
            .and_then(|(_, _, code)| self.direct.get(code).copied())
    }
}

fn add_mapped(
    totals: &mut HashMap<i32, Decimal>,
    unmapped: &mut Vec<UnmappedAccount>,
    resolver: &MappingResolver,
    item: &ReportItem,
    value: Decimal,
) {
    if value.is_zero() {
        return;
    }
    let gl_code = &item.gl_account.gl_code;
    match resolver.resolve(gl_code, &item.gl_account.account_type) {
        Some((code, sign)) => {
            *totals.entry(code).or_default() += value * Decimal::from(sign);
        }
        None => {
            if let Some(code) = default_account(&item.gl_account.account_type) {
                *totals.entry(code).or_default() += value;
            }
            if !unmapped.iter().any(|u| &u.gl_code == gl_code) {
                unmapped.push(UnmappedAccount {
                    gl_code: gl_code.clone(),
                    value,
                });
            }
        }
    }
}

/// Largest difference (in SZL) between the two sides of the accounting equation that
/// still counts as balanced.
const BALANCE_TOLERANCE: i64 = 5;

/// How Mambu signs the credit accounts (liabilities, equity, income) in a report.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignStyle {
    /// Credit accounts are positive, as on the Mambu balance sheet screen.
    Natural,
    /// Credit accounts are negative (debits positive).
    Signed,
}

#[derive(Debug, Clone, Copy, Default)]
struct Totals {
    assets: Decimal,
    liabilities: Decimal,
    equity: Decimal,
    income: Decimal,
    expense: Decimal,
}

fn closing_totals(items: &[ReportItem]) -> Totals {
    let mut t = Totals::default();
    for item in items.iter().filter(|i| reportable(i)) {
        let value = to_decimal(item.amounts.closing_balance);
        match item.gl_account.account_type.as_str() {
            "ASSET" => t.assets += value,
            "LIABILITY" => t.liabilities += value,
            "EQUITY" => t.equity += value,
            "INCOME" => t.income += value,
            "EXPENSE" => t.expense += value,
            _ => {}
        }
    }
    t
}

/// Finds the sign style of a report from the accounting equation. Mambu answers some
/// date ranges in one style and some in the other, so it is never assumed.
/// Returns the smallest gap when neither style balances.
pub fn detect_sign_style(items: &[ReportItem]) -> Result<SignStyle, Decimal> {
    let t = closing_totals(items);
    let natural = t.assets - t.liabilities - t.equity - t.income + t.expense;
    let signed = t.assets + t.liabilities + t.equity + t.income + t.expense;
    let tolerance = Decimal::from(BALANCE_TOLERANCE);
    if natural.abs() <= tolerance {
        Ok(SignStyle::Natural)
    } else if signed.abs() <= tolerance {
        Ok(SignStyle::Signed)
    } else if natural.abs() <= signed.abs() {
        Err(natural)
    } else {
        Err(signed)
    }
}

fn credit_factor(style: SignStyle, account_type: &str) -> Decimal {
    match (style, account_type) {
        (SignStyle::Signed, "LIABILITY" | "EQUITY" | "INCOME") => Decimal::NEGATIVE_ONE,
        _ => Decimal::ONE,
    }
}

fn normalized_totals(items: &[ReportItem], style: SignStyle) -> Totals {
    let t = closing_totals(items);
    Totals {
        assets: t.assets,
        liabilities: t.liabilities * credit_factor(style, "LIABILITY"),
        equity: t.equity * credit_factor(style, "EQUITY"),
        income: t.income * credit_factor(style, "INCOME"),
        expense: t.expense,
    }
}

fn same_within_tolerance(a: Decimal, b: Decimal) -> bool {
    (a - b).abs() <= Decimal::from(BALANCE_TOLERANCE)
}

/// Surplus of the year to the report date, from a year-to-date report. Used only when
/// the report balances and agrees with the month report on every closing total;
/// otherwise Mambu's long ranges are not reliable and `None` is returned.
fn year_to_date_surplus(
    ytd: &[ReportItem],
    month_style: SignStyle,
    month_items: &[ReportItem],
) -> Option<Decimal> {
    let ytd_style = detect_sign_style(ytd).ok()?;
    let m = normalized_totals(month_items, month_style);
    let y = normalized_totals(ytd, ytd_style);
    let agrees = same_within_tolerance(m.assets, y.assets)
        && same_within_tolerance(m.liabilities, y.liabilities)
        && same_within_tolerance(m.equity, y.equity)
        && same_within_tolerance(m.income, y.income)
        && same_within_tolerance(m.expense, y.expense);
    if !agrees {
        return None;
    }
    let mut surplus = Decimal::ZERO;
    for item in ytd.iter().filter(|i| reportable(i)) {
        let a = &item.amounts;
        match item.gl_account.account_type.as_str() {
            "INCOME" => surplus += to_decimal(a.credits - a.debits),
            "EXPENSE" => surplus -= to_decimal(a.debits - a.credits),
            _ => {}
        }
    }
    Some(surplus)
}

/// Maps the Mambu accounting report of one SACCO to CoopData accounts.
///
/// * `month_items`: report from the first day of the month to the month end. It gives
///   the balance sheet closings, the income and expense movement of the month and the
///   earnings since the start. Its sign style is detected from the accounting
///   equation. When neither style balances the report is not used at all and the
///   result says so, rather than showing wrong figures.
/// * `ytd_items`: optional report from 1 January. Mambu answers long ranges with
///   inconsistent figures, so it is used only to split the earnings into accumulated
///   and current year surplus, and only when it balances and agrees with the month
///   report. Mambu itself shows one "Current Earnings" figure (all income minus all
///   expenses since the start), which is what the accumulated line holds when the
///   split is not possible.
///
/// Header accounts are skipped, they only repeat their children. Only SZL (or
/// currency-less) accounts are read.
pub fn map_ledger(
    month_items: &[ReportItem],
    ytd_items: Option<&[ReportItem]>,
    mappings: &HashMap<String, (i32, i16)>,
) -> LedgerResult {
    let style = match detect_sign_style(month_items) {
        Ok(style) => style,
        Err(gap) => {
            return LedgerResult {
                status: LedgerStatus::Unbalanced { gap },
                ..Default::default()
            }
        }
    };
    let mut totals: HashMap<i32, Decimal> = HashMap::new();
    let mut unmapped: Vec<UnmappedAccount> = Vec::new();
    let mut cumulative_earnings = Decimal::ZERO;
    let resolver = MappingResolver::new(
        mappings,
        month_items
            .iter()
            .chain(ytd_items.unwrap_or(&[]))
            .filter(|i| i.gl_account.usage.as_deref() == Some("HEADER"))
            .map(|i| {
                (
                    i.gl_account.account_type.as_str(),
                    i.gl_account.gl_code.as_str(),
                )
            }),
    );

    for item in month_items.iter().filter(|i| reportable(i)) {
        let a = &item.amounts;
        let account_type = item.gl_account.account_type.as_str();
        let closing = to_decimal(a.closing_balance) * credit_factor(style, account_type);
        let value = match account_type {
            "INCOME" => {
                cumulative_earnings += closing;
                to_decimal(a.credits - a.debits)
            }
            "EXPENSE" => {
                cumulative_earnings -= closing;
                to_decimal(a.debits - a.credits)
            }
            _ => closing,
        };
        add_mapped(&mut totals, &mut unmapped, &resolver, item, value);
    }

    let current_year = ytd_items.and_then(|ytd| year_to_date_surplus(ytd, style, month_items));
    let (accumulated, current_year, surplus_split) = match current_year {
        Some(current) => (cumulative_earnings - current, current, true),
        None => (cumulative_earnings, Decimal::ZERO, false),
    };
    for (code, value) in [
        (ACCUMULATED_SURPLUS_CODE, accumulated),
        (CURRENT_YEAR_SURPLUS_CODE, current_year),
    ] {
        if !value.is_zero() {
            *totals.entry(code).or_default() += value;
        }
    }

    let mut lines: Vec<LedgerLine> = totals
        .into_iter()
        .map(|(account_code, value)| LedgerLine {
            account_code,
            value,
        })
        .collect();
    lines.sort_by_key(|l| l.account_code);
    LedgerResult {
        lines,
        unmapped,
        status: LedgerStatus::Balanced,
        surplus_split,
    }
}

/// Totals of the income and expense accounts of a report, for logging and checks.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct EarningsSummary {
    pub income_closing: Decimal,
    pub expense_closing: Decimal,
    pub income_movement: Decimal,
    pub expense_movement: Decimal,
    pub accounts: usize,
}

pub fn summarize_earnings(items: &[ReportItem]) -> EarningsSummary {
    let mut out = EarningsSummary::default();
    for item in items.iter().filter(|i| reportable(i)) {
        let a = &item.amounts;
        match item.gl_account.account_type.as_str() {
            "INCOME" => {
                out.income_closing += to_decimal(a.closing_balance);
                out.income_movement += to_decimal(a.credits - a.debits);
                out.accounts += 1;
            }
            "EXPENSE" => {
                out.expense_closing += to_decimal(a.closing_balance);
                out.expense_movement += to_decimal(a.debits - a.credits);
                out.accounts += 1;
            }
            _ => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::mambu::models::{
        ClientAdl, DepositBalances, DisbursementDetails, LoanBalances, LoanInterestSettings,
        ReportAmounts, ReportCurrency, ReportGlAccount, ScheduleSettings,
    };

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    fn client(state: &str) -> MambuClient {
        MambuClient {
            encoded_key: "k1".into(),
            id: "SAP1".into(),
            state: Some(state.into()),
            activation_date: Some("2022-09-18T07:00:29+02:00".into()),
            birth_date: Some("1995-05-01".into()),
            gender: Some("FEMALE".into()),
            ..Default::default()
        }
    }

    #[test]
    fn month_end_handles_february_and_december() {
        assert_eq!(month_end(2026, 2), Some(d(2026, 2, 28)));
        assert_eq!(month_end(2024, 2), Some(d(2024, 2, 29)));
        assert_eq!(month_end(2026, 12), Some(d(2026, 12, 31)));
    }

    #[test]
    fn code_from_key_is_stable_and_hides_input() {
        let a = code_from_key("SA", "8a19310a87bdc92e0187c275f39441c6");
        assert_eq!(a, code_from_key("SA", "8a19310a87bdc92e0187c275f39441c6"));
        assert!(a.starts_with("SA-"));
        assert!(!a.contains("8a19310a"));
    }

    #[test]
    fn active_member_is_mapped_with_age_band_and_defaults() {
        let m = map_member(
            &client("ACTIVE"),
            Some(EswatiniRegion::Manzini),
            d(2026, 9, 30),
        )
        .unwrap();
        assert_eq!(m.member_id, "SAP1");
        assert_eq!(m.status, MemberStatus::Active);
        assert_eq!(m.gender, Gender::Female);
        assert_eq!(m.age_group, AgeGroup::Between18And35);
        assert_eq!(m.region, EswatiniRegion::Manzini);
        assert_eq!(m.urban_rural, UrbanRural::Unknown);
        assert!(!m.agm_attendance && !m.voting_exercised);
        assert!(m.leadership_role.is_none());
    }

    #[test]
    fn blacklisted_members_are_excluded() {
        assert_eq!(
            map_member(
                &client("BLACKLISTED"),
                Some(EswatiniRegion::Manzini),
                d(2026, 9, 30)
            )
            .err(),
            Some(DropReason::Blacklisted)
        );
    }

    #[test]
    fn member_region_prefers_custom_field_then_branch() {
        let mut c = client("ACTIVE");
        c.adl = Some(ClientAdl {
            region: Some("LUBOMBO".into()),
            ..Default::default()
        });
        let m = map_member(&c, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).unwrap();
        assert_eq!(m.region, EswatiniRegion::Lubombo);
        assert_eq!(
            map_member(&client("ACTIVE"), None, d(2026, 9, 30)).err(),
            Some(DropReason::MissingRegion)
        );
    }

    #[test]
    fn missing_birth_date_is_dropped_not_invented() {
        let mut c = client("ACTIVE");
        c.birth_date = None;
        assert_eq!(
            map_member(&c, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).err(),
            Some(DropReason::MissingBirthDate)
        );
    }

    #[test]
    fn member_exit_after_reporting_date_is_still_active() {
        let mut c = client("EXITED");
        c.closed_date = Some("2026-11-02T10:00:00+02:00".into());
        let m = map_member(&c, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).unwrap();
        assert_eq!(m.status, MemberStatus::Active);
        assert!(m.exit_date.is_none());
    }

    #[test]
    fn old_exits_are_excluded_and_current_year_exits_kept() {
        let mut old = client("EXITED");
        old.closed_date = Some("2023-03-20T15:50:31+02:00".into());
        assert_eq!(
            map_member(&old, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).err(),
            Some(DropReason::ExitedBeforeYear)
        );
        let mut recent = client("EXITED");
        recent.closed_date = Some("2026-03-20T15:50:31+02:00".into());
        let m = map_member(&recent, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).unwrap();
        assert_eq!(m.status, MemberStatus::Exited);
        assert_eq!(m.exit_date, Some(d(2026, 3, 20)));
    }

    #[test]
    fn resigned_and_deceased_categories_set_status() {
        let mut c = client("ACTIVE");
        c.adl = Some(ClientAdl {
            mcat: Some("Deceased".into()),
            date_resigned_deceased: Some("2026-02-01".into()),
            ..Default::default()
        });
        let m = map_member(&c, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).unwrap();
        assert_eq!(m.status, MemberStatus::Deceased);
        assert_eq!(m.exit_date, Some(d(2026, 2, 1)));
    }

    #[test]
    fn deposits_are_classified_by_name_and_type() {
        let mut dep = MambuDeposit {
            name: Some("Mandatory Shares".into()),
            ..Default::default()
        };
        assert_eq!(classify_deposit(&dep, None), KIND_SHARE);
        dep.name = Some("Year End Payout Account".into());
        assert_eq!(classify_deposit(&dep, None), KIND_IGNORE);
        dep.name = Some("School Savings".into());
        dep.account_type = Some("REGULAR_SAVINGS".into());
        assert_eq!(classify_deposit(&dep, None), KIND_VOLUNTARY);
        dep.account_type = Some("SAVINGS_PLAN".into());
        assert_eq!(classify_deposit(&dep, None), KIND_FIXED_DEPOSIT);
        assert_eq!(classify_deposit(&dep, Some("Mandatory")), KIND_MANDATORY);
    }

    #[test]
    fn savings_use_generated_code_and_flag_zero_balance() {
        let dep = MambuDeposit {
            encoded_key: "abc".into(),
            account_state: Some("DORMANT".into()),
            activation_date: Some("2018-01-01T00:00:00+02:00".into()),
            balances: DepositBalances { total_balance: 0.0 },
            ..Default::default()
        };
        let s = map_savings(&dep, "SAP1", KIND_VOLUNTARY, d(2026, 9, 30)).unwrap();
        assert!(s.savings_account_id.starts_with("SA-"));
        assert_eq!(s.account_status, "Dormant");
        assert!(s.zero_balance_flag);
        assert_eq!(s.contribution_frequency, "Irregular");
    }

    #[test]
    fn savings_closed_before_date_are_dropped() {
        let dep = MambuDeposit {
            encoded_key: "abc".into(),
            account_state: Some("CLOSED".into()),
            activation_date: Some("2018-01-01T00:00:00+02:00".into()),
            closed_date: Some("2020-01-01T00:00:00+02:00".into()),
            ..Default::default()
        };
        assert_eq!(
            map_savings(&dep, "SAP1", KIND_VOLUNTARY, d(2026, 9, 30)).err(),
            Some(DropReason::NotOpenAtDate)
        );
    }

    #[test]
    fn fixed_deposit_without_maturity_uses_default_term() {
        let dep = MambuDeposit {
            encoded_key: "fd1".into(),
            account_state: Some("ACTIVE".into()),
            activation_date: Some("2026-01-19T00:00:00+02:00".into()),
            balances: DepositBalances {
                total_balance: 24643.38,
            },
            ..Default::default()
        };
        let (fd, defaulted) = map_fixed_deposit(&dep, "SAP1", d(2026, 9, 30), None).unwrap();
        assert!(defaulted);
        assert_eq!(fd.maturity_date, d(2027, 1, 19));
        assert_eq!(fd.status, FdStatus::Active);
        assert_eq!(fd.tenure_category, "Medium");
    }

    #[test]
    fn matured_fixed_deposit_keeps_explicit_maturity() {
        let dep = MambuDeposit {
            encoded_key: "fd2".into(),
            account_state: Some("MATURED".into()),
            activation_date: Some("2025-06-03T00:00:00+02:00".into()),
            maturity_date: Some("2026-06-03T00:00:00+02:00".into()),
            ..Default::default()
        };
        let (fd, defaulted) = map_fixed_deposit(&dep, "SAP1", d(2026, 9, 30), None).unwrap();
        assert!(!defaulted);
        assert_eq!(fd.status, FdStatus::Matured);
    }

    fn loan(state: &str, sub: &str) -> MambuLoan {
        MambuLoan {
            encoded_key: "l1".into(),
            loan_name: Some("Quick Loan".into()),
            account_state: Some(state.into()),
            account_sub_state: Some(sub.into()),
            account_holder_type: Some("CLIENT".into()),
            loan_amount: 5000.0,
            balances: LoanBalances {
                principal_balance: 1200.0,
            },
            interest_settings: Some(LoanInterestSettings {
                interest_rate: Some(2.5),
                interest_charge_frequency: Some("EVERY_MONTH".into()),
            }),
            disbursement_details: Some(DisbursementDetails {
                disbursement_date: Some("2026-01-01T00:00:00+02:00".into()),
                first_repayment_date: Some("2026-02-01T00:00:00+02:00".into()),
            }),
            schedule_settings: Some(ScheduleSettings {
                repayment_installments: Some(6),
                repayment_period_count: Some(1),
                repayment_period_unit: Some("MONTHS".into()),
            }),
            ..Default::default()
        }
    }

    #[test]
    fn loan_in_arrears_maps_status_dpd_rate_and_maturity() {
        let mut l = loan("ACTIVE_IN_ARREARS", "");
        l.days_in_arrears = Some(45);
        let r = map_loan(&l, "SAP1", None, d(2026, 9, 30)).unwrap();
        assert_eq!(r.loan_status, LoanStatus::Arrears);
        assert_eq!(r.days_past_due_category, DpdCategory::Days31To60);
        assert_eq!(r.interest_rate, Decimal::from(30));
        assert_eq!(r.loan_maturity_date, d(2026, 7, 1));
        assert_eq!(r.repayment_regularity, "Irregular");
        assert_eq!(r.borrower_type, "Individual");
        assert!(r.loan_id.starts_with("LN-"));
    }

    #[test]
    fn performing_loan_has_zero_days_past_due() {
        let mut l = loan("ACTIVE", "");
        l.days_in_arrears = Some(12);
        let r = map_loan(&l, "SAP1", None, d(2026, 9, 30)).unwrap();
        assert_eq!(r.loan_status, LoanStatus::Performing);
        assert_eq!(r.days_past_due_category, DpdCategory::Zero);
        assert_eq!(r.repayment_regularity, "Regular");
    }

    #[test]
    fn restructured_written_off_and_undisbursed_loans() {
        let mut l = loan("CLOSED", "RESCHEDULED");
        l.closed_date = Some("2026-09-10T00:00:00+02:00".into());
        let r = map_loan(&l, "SAP1", None, d(2026, 9, 30)).unwrap();
        assert_eq!(r.loan_status, LoanStatus::Restructured);
        assert!(r.restructured_loan_flag);
        assert_eq!(r.number_of_restructurings, 1);

        let mut w = loan("CLOSED", "WRITTEN_OFF");
        w.closed_date = Some("2026-09-10T00:00:00+02:00".into());
        let r = map_loan(&w, "SAP1", None, d(2026, 9, 30)).unwrap();
        assert_eq!(r.loan_status, LoanStatus::WrittenOff);
        assert_eq!(r.balance, Decimal::ZERO);

        assert_eq!(
            map_loan(&loan("PENDING_APPROVAL", ""), "SAP1", None, d(2026, 9, 30)).err(),
            Some(DropReason::NotDisbursed)
        );
        let mut old = loan("CLOSED", "REPAID");
        old.closed_date = Some("2025-01-01T00:00:00+02:00".into());
        assert_eq!(
            map_loan(&old, "SAP1", None, d(2026, 9, 30)).err(),
            Some(DropReason::ClosedBeforePeriod)
        );
    }

    #[test]
    fn loan_type_uses_purpose_and_name() {
        assert_eq!(
            loan_type_from("Quick Loan", Some("SCHOOL FEES"), None),
            "Education"
        );
        assert_eq!(
            loan_type_from("Quick Loan", Some("PERSONAL LOAN"), None),
            "Personal"
        );
        assert_eq!(loan_type_from("Business Boost", None, None), "Business");
        assert_eq!(
            loan_type_from("Quick Loan", Some("BUILDING LOAN"), None),
            "Other"
        );
        assert_eq!(
            loan_type_from("Quick Loan", None, Some("Agriculture")),
            "Agriculture"
        );
    }

    fn item(
        code: &str,
        kind: &str,
        usage: &str,
        cur: Option<&str>,
        a: ReportAmounts,
    ) -> ReportItem {
        ReportItem {
            gl_account: ReportGlAccount {
                gl_code: code.into(),
                name: None,
                account_type: kind.into(),
                usage: Some(usage.into()),
                currency: cur.map(|c| ReportCurrency {
                    currency_code: Some(c.into()),
                }),
            },
            amounts: a,
        }
    }

    fn bal(closing: f64) -> ReportAmounts {
        ReportAmounts {
            closing_balance: closing,
            ..Default::default()
        }
    }

    fn mov(debits: f64, credits: f64, closing: f64) -> ReportAmounts {
        ReportAmounts {
            debits,
            credits,
            closing_balance: closing,
            ..Default::default()
        }
    }

    fn ledger_value(r: &LedgerResult, code: i32) -> Decimal {
        r.lines
            .iter()
            .find(|l| l.account_code == code)
            .map(|l| l.value)
            .unwrap_or_default()
    }

    fn detail(code: &str, kind: &str, a: ReportAmounts) -> ReportItem {
        item(code, kind, "DETAIL", Some("SZL"), a)
    }

    #[test]
    fn ledger_maps_signs_skips_headers_and_foreign_currency() {
        // assets 120.5 = liabilities 7 + equity 88.5 + (income 60 - expenses 35)
        let month = vec![
            item("1100", "ASSET", "HEADER", Some("SZL"), bal(150.5)),
            detail("1101", "ASSET", bal(100.0)),
            detail("1102", "ASSET", bal(50.5)),
            item("01101", "ASSET", "DETAIL", Some("ZAR"), bal(999.0)),
            detail("1250", "ASSET", bal(-30.0)),
            detail("9999", "LIABILITY", bal(7.0)),
            detail("6001", "EQUITY", bal(88.5)),
            detail("4001", "INCOME", mov(10.0, 70.0, 60.0)),
            detail("5001", "EXPENSE", mov(40.0, 5.0, 35.0)),
        ];
        let mut map = HashMap::new();
        map.insert("1101".to_string(), (1102, 1i16));
        map.insert("1102".to_string(), (1102, 1i16));
        map.insert("6001".to_string(), (3101, 1i16));
        map.insert("4001".to_string(), (4101, 1i16));
        map.insert("5001".to_string(), (5201, 1i16));
        map.insert("1250".to_string(), (1251, -1i16));
        let r = map_ledger(&month, None, &map);
        assert_eq!(r.status, LedgerStatus::Balanced);
        assert_eq!(ledger_value(&r, 1102), to_decimal(150.5));
        assert_eq!(
            ledger_value(&r, 4101),
            to_decimal(60.0),
            "movement of the month"
        );
        assert_eq!(ledger_value(&r, 5201), to_decimal(35.0));
        assert_eq!(
            ledger_value(&r, 1251),
            to_decimal(30.0),
            "contra account is flipped"
        );
        assert_eq!(
            ledger_value(&r, 2301),
            to_decimal(7.0),
            "unmapped goes to the type default"
        );
        assert_eq!(r.unmapped.len(), 1);
        assert_eq!(r.unmapped[0].gl_code, "9999");
    }

    #[test]
    fn accounts_follow_their_balance_sheet_group_unless_they_have_an_own_row() {
        // assets 620 = liabilities 311 + equity 309
        let month = vec![
            item("1100", "ASSET", "HEADER", Some("SZL"), bal(0.0)),
            detail("1126", "ASSET", bal(100.0)),
            detail("1128", "ASSET", bal(40.0)),
            item("2000", "ASSET", "HEADER", Some("SZL"), bal(0.0)),
            detail("2001", "ASSET", bal(500.0)),
            detail("2050", "ASSET", bal(-20.0)),
            item("5000", "LIABILITY", "HEADER", Some("SZL"), bal(0.0)),
            detail("5001", "LIABILITY", bal(300.0)),
            detail("5301", "LIABILITY", bal(11.0)),
            detail("6001", "EQUITY", bal(309.0)),
        ];
        let mut map = HashMap::new();
        map.insert("1100".to_string(), (1102, 1i16));
        map.insert("1128".to_string(), (1103, 1i16));
        map.insert("2000".to_string(), (1201, 1i16));
        map.insert("2050".to_string(), (1251, -1i16));
        map.insert("5000".to_string(), (2101, 1i16));
        map.insert("6001".to_string(), (3101, 1i16));
        let r = map_ledger(&month, None, &map);
        assert_eq!(
            ledger_value(&r, 1102),
            to_decimal(100.0),
            "follows header 1100"
        );
        assert_eq!(ledger_value(&r, 1103), to_decimal(40.0), "own row wins");
        assert_eq!(ledger_value(&r, 1201), to_decimal(500.0));
        assert_eq!(ledger_value(&r, 1251), to_decimal(20.0));
        assert_eq!(
            ledger_value(&r, 2101),
            to_decimal(311.0),
            "5301 follows header 5000 here"
        );
        assert!(r.unmapped.is_empty());
    }

    #[test]
    fn a_group_of_another_account_type_is_not_inherited() {
        let month = vec![
            item("1100", "ASSET", "HEADER", Some("SZL"), bal(0.0)),
            detail("1150", "LIABILITY", bal(9.0)),
            detail("6001", "EQUITY", bal(-9.0)),
        ];
        let mut map = HashMap::new();
        map.insert("1100".to_string(), (1102, 1i16));
        map.insert("6001".to_string(), (3101, 1i16));
        let r = map_ledger(&month, None, &map);
        assert_eq!(r.unmapped.len(), 1);
        assert_eq!(r.unmapped[0].gl_code, "1150");
    }

    fn balanced_month() -> Vec<ReportItem> {
        // assets 1000 = liabilities 500 + equity 150 + (income 580 - expenses 230)
        vec![
            detail("1101", "ASSET", bal(1000.0)),
            detail("5001", "LIABILITY", bal(500.0)),
            detail("6001", "EQUITY", bal(150.0)),
            detail("4001", "INCOME", mov(0.0, 80.0, 580.0)),
            detail("5101", "EXPENSE", mov(30.0, 0.0, 230.0)),
        ]
    }

    fn surplus_map() -> HashMap<String, (i32, i16)> {
        let mut map = HashMap::new();
        map.insert("1101".to_string(), (1102, 1i16));
        map.insert("5001".to_string(), (2101, 1i16));
        map.insert("6001".to_string(), (3101, 1i16));
        map
    }

    #[test]
    fn surplus_is_split_with_a_year_to_date_report_that_agrees() {
        // All earnings 350. Earnings of the year 80 - 30 = 50. Accumulated 300.
        let month = balanced_month();
        let ytd = balanced_month();
        let r = map_ledger(&month, Some(&ytd), &surplus_map());
        assert!(r.surplus_split);
        assert_eq!(
            ledger_value(&r, ACCUMULATED_SURPLUS_CODE),
            to_decimal(300.0)
        );
        assert_eq!(
            ledger_value(&r, CURRENT_YEAR_SURPLUS_CODE),
            to_decimal(50.0)
        );
        let equity = ledger_value(&r, 3101)
            + ledger_value(&r, ACCUMULATED_SURPLUS_CODE)
            + ledger_value(&r, CURRENT_YEAR_SURPLUS_CODE);
        assert_eq!(ledger_value(&r, 1102), ledger_value(&r, 2101) + equity);
    }

    #[test]
    fn a_year_to_date_report_that_disagrees_is_not_used() {
        // Balances on its own, but its closing totals differ from the month report.
        let ytd = vec![
            detail("1101", "ASSET", bal(1200.0)),
            detail("5001", "LIABILITY", bal(500.0)),
            detail("6001", "EQUITY", bal(350.0)),
            detail("4001", "INCOME", mov(0.0, 80.0, 580.0)),
            detail("5101", "EXPENSE", mov(30.0, 0.0, 230.0)),
        ];
        let r = map_ledger(&balanced_month(), Some(&ytd), &surplus_map());
        assert_eq!(r.status, LedgerStatus::Balanced);
        assert!(!r.surplus_split);
        assert_eq!(
            ledger_value(&r, ACCUMULATED_SURPLUS_CODE),
            to_decimal(350.0)
        );
        assert_eq!(ledger_value(&r, CURRENT_YEAR_SURPLUS_CODE), Decimal::ZERO);
    }

    #[test]
    fn a_year_to_date_report_that_does_not_balance_is_not_used() {
        let ytd = vec![
            detail("1101", "ASSET", bal(1000.0)),
            detail("5001", "LIABILITY", bal(100.0)),
        ];
        let r = map_ledger(&balanced_month(), Some(&ytd), &surplus_map());
        assert!(!r.surplus_split);
        assert_eq!(
            ledger_value(&r, ACCUMULATED_SURPLUS_CODE),
            to_decimal(350.0)
        );
    }

    #[test]
    fn credit_accounts_signed_negative_are_detected_and_flipped() {
        // The same statement as `balanced_month` with Mambu's signed style.
        let month = vec![
            detail("1101", "ASSET", bal(1000.0)),
            detail("5001", "LIABILITY", bal(-500.0)),
            detail("6001", "EQUITY", bal(-150.0)),
            detail("4001", "INCOME", mov(0.0, 80.0, -580.0)),
            detail("5101", "EXPENSE", mov(30.0, 0.0, 230.0)),
        ];
        assert_eq!(detect_sign_style(&month), Ok(SignStyle::Signed));
        assert_eq!(detect_sign_style(&balanced_month()), Ok(SignStyle::Natural));
        let r = map_ledger(&month, None, &surplus_map());
        assert_eq!(ledger_value(&r, 2101), to_decimal(500.0));
        assert_eq!(ledger_value(&r, 3101), to_decimal(150.0));
        assert_eq!(
            ledger_value(&r, ACCUMULATED_SURPLUS_CODE),
            to_decimal(350.0)
        );
    }

    #[test]
    fn a_report_that_does_not_balance_is_left_out() {
        let month = vec![
            detail("1101", "ASSET", bal(1000.0)),
            detail("5001", "LIABILITY", bal(400.0)),
            detail("6001", "EQUITY", bal(100.0)),
        ];
        let r = map_ledger(&month, None, &surplus_map());
        assert!(r.lines.is_empty());
        match r.status {
            LedgerStatus::Unbalanced { gap } => assert_eq!(gap, to_decimal(500.0)),
            other => panic!("expected unbalanced, got {other:?}"),
        }
    }

    #[test]
    fn mapped_surplus_accounts_are_added_to_the_computed_ones() {
        // assets 70 = equity 40 + earnings 30
        let month = vec![
            detail("1101", "ASSET", bal(70.0)),
            detail("7001", "EQUITY", bal(40.0)),
            detail("4001", "INCOME", mov(0.0, 10.0, 30.0)),
        ];
        let mut map = HashMap::new();
        map.insert("7001".to_string(), (ACCUMULATED_SURPLUS_CODE, 1i16));
        let r = map_ledger(&month, None, &map);
        assert_eq!(ledger_value(&r, ACCUMULATED_SURPLUS_CODE), to_decimal(70.0));
    }

    #[test]
    fn exited_members_without_a_date_are_dropped() {
        let mut c = client("ACTIVE");
        c.adl = Some(ClientAdl {
            mcat: Some("Resigned".into()),
            ..Default::default()
        });
        assert_eq!(
            map_member(&c, Some(EswatiniRegion::Manzini), d(2026, 9, 30)).err(),
            Some(DropReason::ExitDateMissing)
        );
    }

    #[test]
    fn accounts_that_are_not_in_service_are_dropped() {
        let dep = MambuDeposit {
            encoded_key: "x".into(),
            account_state: Some("PENDING_APPROVAL".into()),
            activation_date: Some("2024-01-01T00:00:00+02:00".into()),
            ..Default::default()
        };
        assert_eq!(
            map_savings(&dep, "M", KIND_VOLUNTARY, d(2026, 9, 30)).err(),
            Some(DropReason::AccountNotActive)
        );
        let closed_without_date = MambuDeposit {
            encoded_key: "y".into(),
            account_state: Some("CLOSED".into()),
            activation_date: Some("2024-01-01T00:00:00+02:00".into()),
            ..Default::default()
        };
        assert_eq!(
            map_savings(&closed_without_date, "M", KIND_VOLUNTARY, d(2026, 9, 30)).err(),
            Some(DropReason::NotOpenAtDate)
        );
    }

    #[test]
    fn fixed_deposit_uses_the_product_term_when_maturity_is_missing() {
        let dep = MambuDeposit {
            encoded_key: "fd3".into(),
            account_state: Some("ACTIVE".into()),
            activation_date: Some("2026-01-19T00:00:00+02:00".into()),
            ..Default::default()
        };
        let (fd, defaulted) = map_fixed_deposit(&dep, "M", d(2026, 9, 30), Some(36)).unwrap();
        assert!(defaulted);
        assert_eq!(fd.maturity_date, d(2029, 1, 19));
        assert_eq!(fd.tenure_category, "Long");
    }
}
