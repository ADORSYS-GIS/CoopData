use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::entities::enums::{
    AccountType, AgeGroup, DpdCategory, EswatiniRegion, FdStatus, Gender, LoanStatus, MemberStatus,
    UrbanRural,
};
use crate::error::{AppError, AppResult};

pub trait NfExcelParser: Send + Sync {
    fn parse(&self, file_bytes: &[u8]) -> AppResult<NfParseResult>;
}

#[derive(Clone)]
pub struct CalamineNfParser;

impl CalamineNfParser {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CalamineNfParser {
    fn default() -> Self {
        Self::new()
    }
}

impl NfExcelParser for CalamineNfParser {
    fn parse(&self, file_bytes: &[u8]) -> AppResult<NfParseResult> {
        parse_workbook(file_bytes)
    }
}

const SHEET_MEMBERS: &str = "NF MSHIP";
const SHEET_SAVINGS: &str = "NF S";
const SHEET_LOANS: &str = "NF LOANS";
const SHEET_FIXED_DEPOSITS: &str = "NF FS";

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MemberRecord {
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
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SavingsAccountRecord {
    pub member_business_id: String,
    pub savings_account_id: String,
    pub account_type: AccountType,
    pub account_opening_date: NaiveDate,
    pub account_status: String,
    pub contribution_frequency: String,
    pub last_contribution_date: Option<NaiveDate>,
    pub number_of_contributions: i32,
    pub balance_trend: String,
    pub zero_balance_flag: bool,
    pub withdrawal_frequency_category: String,
    pub emergency_withdrawals_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LoanRecord {
    pub member_business_id: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FixedDepositRecord {
    pub member_business_id: String,
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
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct NfParseResult {
    pub members: Vec<MemberRecord>,
    pub savings_accounts: Vec<SavingsAccountRecord>,
    pub loans: Vec<LoanRecord>,
    pub fixed_deposits: Vec<FixedDepositRecord>,
    pub errors: Vec<NfParseError>,
    pub warnings: Vec<NfParseWarning>,
    pub sheets_found: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NfParseError {
    pub sheet: String,
    pub row: usize,
    pub column: String,
    pub value: String,
    pub rule: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NfParseWarning {
    pub sheet: String,
    pub row: usize,
    pub column: String,
    pub rule: String,
    pub message: String,
}

fn parse_workbook(file_bytes: &[u8]) -> AppResult<NfParseResult> {
    use calamine::{open_workbook_auto_from_rs, Reader};

    let mut result = NfParseResult::default();
    let mut workbook = open_workbook_auto_from_rs(std::io::Cursor::new(file_bytes.to_vec()))
        .map_err(|e| AppError::BadRequest(format!("Failed to open Excel file: {}", e)))?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();

    for sheet_name in &sheet_names {
        match sheet_name.as_str() {
            SHEET_MEMBERS => {
                result.sheets_found.push(SHEET_MEMBERS.to_string());
                if let Ok(range) = workbook.worksheet_range(SHEET_MEMBERS) {
                    parse_members_sheet(&range, &mut result);
                }
            }
            SHEET_SAVINGS => {
                result.sheets_found.push(SHEET_SAVINGS.to_string());
                if let Ok(range) = workbook.worksheet_range(SHEET_SAVINGS) {
                    parse_savings_sheet(&range, &mut result);
                }
            }
            SHEET_LOANS => {
                result.sheets_found.push(SHEET_LOANS.to_string());
                if let Ok(range) = workbook.worksheet_range(SHEET_LOANS) {
                    parse_loans_sheet(&range, &mut result);
                }
            }
            SHEET_FIXED_DEPOSITS => {
                result.sheets_found.push(SHEET_FIXED_DEPOSITS.to_string());
                if let Ok(range) = workbook.worksheet_range(SHEET_FIXED_DEPOSITS) {
                    parse_fixed_deposits_sheet(&range, &mut result);
                }
            }
            _ => {}
        }
    }

    if result.sheets_found.is_empty() {
        return Err(AppError::BadRequest(
            "No recognized sheets found. Expected at least one of: NF MSHIP, NF S, NF LOANS, NF FS"
                .to_string(),
        ));
    }

    run_cross_table_validations(&mut result);

    Ok(result)
}

use calamine::{Data, Range};

fn parse_members_sheet(range: &Range<Data>, result: &mut NfParseResult) {
    let mut rows = range.rows();
    if rows.next().is_none() {
        return;
    }

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_id = get_string_cell(row, 0);
        let join_date = get_date_cell(row, 1);
        let status = get_string_cell(row, 2);
        let exit_date = get_optional_date_cell(row, 3);
        let gender = get_string_cell(row, 4);
        let age_group = get_string_cell(row, 5);
        let region = get_string_cell(row, 6);
        let urban_rural = get_string_cell(row, 7);

        match (
            member_id,
            join_date,
            status,
            gender,
            age_group,
            region,
            urban_rural,
        ) {
            (Some(mid), Some(jd), Some(st), Some(g), Some(ag), Some(r), Some(ur)) => {
                let status_enum = match MemberStatus::parse(&st) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "status".to_string(),
                            value: st.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid member status: {}", st),
                        });
                        continue;
                    }
                };
                let gender_enum = match Gender::parse(&g) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "gender".to_string(),
                            value: g.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid gender: {}", g),
                        });
                        continue;
                    }
                };
                let age_group_enum = match AgeGroup::parse(&ag) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "age_group".to_string(),
                            value: ag.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid age group: {}", ag),
                        });
                        continue;
                    }
                };
                let region_enum = match EswatiniRegion::parse(&r) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "region".to_string(),
                            value: r.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid region: {}", r),
                        });
                        continue;
                    }
                };
                let urban_rural_enum = match UrbanRural::parse(&ur) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "urban_rural".to_string(),
                            value: ur.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid urban_rural: {}", ur),
                        });
                        continue;
                    }
                };

                let exit_date_val = exit_date.unwrap_or(None);

                if let Some(ed) = &exit_date_val {
                    if *ed < jd {
                        result.errors.push(NfParseError {
                            sheet: SHEET_MEMBERS.to_string(),
                            row: row_index,
                            column: "exit_date".to_string(),
                            value: ed.to_string(),
                            rule: "EXIT_BEFORE_JOIN".to_string(),
                            message: "Exit date is before join date".to_string(),
                        });
                        continue;
                    }
                }

                let agm_attendance = get_bool_cell(row, 8).unwrap_or(false);
                let leadership_role = get_optional_string_cell(row, 9);
                let voting_exercised = get_bool_cell(row, 10).unwrap_or(false);

                result.members.push(MemberRecord {
                    member_id: mid,
                    join_date: jd,
                    status: status_enum,
                    exit_date: exit_date_val,
                    gender: gender_enum,
                    age_group: age_group_enum,
                    region: region_enum,
                    urban_rural: urban_rural_enum,
                    agm_attendance,
                    leadership_role,
                    voting_exercised,
                });
            }
            _ => {
                result.errors.push(NfParseError {
                    sheet: SHEET_MEMBERS.to_string(),
                    row: row_index,
                    column: "required_fields".to_string(),
                    value: String::new(),
                    rule: "MISSING_REQUIRED".to_string(),
                    message: format!("Row {} is missing required fields", row_index),
                });
            }
        }
    }
}

fn parse_savings_sheet(range: &Range<Data>, result: &mut NfParseResult) {
    let mut rows = range.rows();
    if rows.next().is_none() {
        return;
    }

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, 0);
        let savings_account_id = get_string_cell(row, 1);
        let account_type = get_string_cell(row, 2);
        let account_opening_date = get_date_cell(row, 3);

        match (
            member_business_id,
            savings_account_id,
            account_type,
            account_opening_date,
        ) {
            (Some(mid), Some(sid), Some(at), Some(aod)) => {
                let account_type_enum = match AccountType::parse(&at) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_SAVINGS.to_string(),
                            row: row_index,
                            column: "account_type".to_string(),
                            value: at.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid account type: {}", at),
                        });
                        continue;
                    }
                };

                result.savings_accounts.push(SavingsAccountRecord {
                    member_business_id: mid,
                    savings_account_id: sid,
                    account_type: account_type_enum,
                    account_opening_date: aod,
                    account_status: get_string_cell(row, 4).unwrap_or_else(|| "Active".to_string()),
                    contribution_frequency: get_string_cell(row, 5).unwrap_or_default(),
                    last_contribution_date: get_optional_date_cell(row, 6).flatten(),
                    number_of_contributions: get_int_cell(row, 7).unwrap_or(0),
                    balance_trend: get_string_cell(row, 8).unwrap_or_default(),
                    zero_balance_flag: get_bool_cell(row, 9).unwrap_or(false),
                    withdrawal_frequency_category: get_string_cell(row, 10).unwrap_or_default(),
                    emergency_withdrawals_flag: get_bool_cell(row, 11).unwrap_or(false),
                    interest_rate: get_decimal_cell(row, 12).unwrap_or_default(),
                    balance: get_decimal_cell(row, 13).unwrap_or_default(),
                });
            }
            _ => {
                result.errors.push(NfParseError {
                    sheet: SHEET_SAVINGS.to_string(),
                    row: row_index,
                    column: "required_fields".to_string(),
                    value: String::new(),
                    rule: "MISSING_REQUIRED".to_string(),
                    message: format!("Row {} is missing required fields", row_index),
                });
            }
        }
    }
}

fn parse_loans_sheet(range: &Range<Data>, result: &mut NfParseResult) {
    let mut rows = range.rows();
    if rows.next().is_none() {
        return;
    }

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, 0);
        let loan_id = get_string_cell(row, 1);
        let loan_product_type = get_string_cell(row, 2);
        let loan_start_date = get_date_cell(row, 3);
        let loan_maturity_date = get_date_cell(row, 4);
        let loan_status = get_string_cell(row, 5);

        match (
            member_business_id,
            loan_id,
            loan_product_type,
            loan_start_date,
            loan_maturity_date,
            loan_status,
        ) {
            (Some(mid), Some(lid), Some(lpt), Some(lsd), Some(lmd), Some(ls)) => {
                let loan_status_enum = match LoanStatus::parse(&ls) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_LOANS.to_string(),
                            row: row_index,
                            column: "loan_status".to_string(),
                            value: ls.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid loan status: {}", ls),
                        });
                        continue;
                    }
                };

                if lmd < lsd {
                    result.errors.push(NfParseError {
                        sheet: SHEET_LOANS.to_string(),
                        row: row_index,
                        column: "loan_maturity_date".to_string(),
                        value: lmd.to_string(),
                        rule: "MATURITY_BEFORE_START".to_string(),
                        message: "Maturity date is before loan start date".to_string(),
                    });
                    continue;
                }

                let dpd_raw = get_string_cell(row, 11).unwrap_or_else(|| "0".to_string());
                let dpd_category = match DpdCategory::parse(&dpd_raw) {
                    Some(v) => v,
                    None => DpdCategory::Zero,
                };

                if loan_status_enum == LoanStatus::Performing && dpd_category != DpdCategory::Zero {
                    result.errors.push(NfParseError {
                        sheet: SHEET_LOANS.to_string(),
                        row: row_index,
                        column: "days_past_due_category".to_string(),
                        value: dpd_raw,
                        rule: "DPD_STATUS_MISMATCH".to_string(),
                        message: "Loan status is Performing but DPD is non-zero".to_string(),
                    });
                    continue;
                }

                result.loans.push(LoanRecord {
                    member_business_id: mid,
                    loan_id: lid,
                    loan_product_type: lpt,
                    loan_start_date: lsd,
                    loan_maturity_date: lmd,
                    loan_status: loan_status_enum,
                    borrower_type: get_string_cell(row, 6).unwrap_or_default(),
                    youth_borrower_flag: get_bool_cell(row, 7).unwrap_or(false),
                    women_borrower_flag: get_bool_cell(row, 8).unwrap_or(false),
                    rural_borrower_flag: get_bool_cell(row, 9).unwrap_or(false),
                    repayment_regularity: get_string_cell(row, 10).unwrap_or_default(),
                    days_past_due_category: dpd_category,
                    missed_installments_count: get_int_cell(row, 12).unwrap_or(0),
                    restructured_loan_flag: get_bool_cell(row, 13).unwrap_or(false),
                    number_of_restructurings: get_int_cell(row, 14).unwrap_or(0),
                    early_settlement_flag: get_bool_cell(row, 15).unwrap_or(false),
                    multiple_loans_flag: get_bool_cell(row, 16).unwrap_or(false),
                    large_borrower_flag: get_bool_cell(row, 17).unwrap_or(false),
                    interest_rate: get_decimal_cell(row, 18).unwrap_or_default(),
                    balance: get_decimal_cell(row, 19).unwrap_or_default(),
                    loan_amount: get_decimal_cell(row, 20).unwrap_or_default(),
                });
            }
            _ => {
                result.errors.push(NfParseError {
                    sheet: SHEET_LOANS.to_string(),
                    row: row_index,
                    column: "required_fields".to_string(),
                    value: String::new(),
                    rule: "MISSING_REQUIRED".to_string(),
                    message: format!("Row {} is missing required fields", row_index),
                });
            }
        }
    }
}

fn parse_fixed_deposits_sheet(range: &Range<Data>, result: &mut NfParseResult) {
    let mut rows = range.rows();
    if rows.next().is_none() {
        return;
    }

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, 0);
        let fixed_deposit_id = get_string_cell(row, 1);
        let deposit_type = get_string_cell(row, 2);
        let start_date = get_date_cell(row, 3);
        let maturity_date = get_date_cell(row, 4);
        let status = get_string_cell(row, 5);

        match (
            member_business_id,
            fixed_deposit_id,
            deposit_type,
            start_date,
            maturity_date,
            status,
        ) {
            (Some(mid), Some(fdid), Some(dt), Some(sd), Some(md), Some(st)) => {
                let status_enum = match FdStatus::parse(&st) {
                    Some(v) => v,
                    None => {
                        result.errors.push(NfParseError {
                            sheet: SHEET_FIXED_DEPOSITS.to_string(),
                            row: row_index,
                            column: "status".to_string(),
                            value: st.clone(),
                            rule: "INVALID_ENUM".to_string(),
                            message: format!("Invalid FD status: {}", st),
                        });
                        continue;
                    }
                };

                if md < sd {
                    result.errors.push(NfParseError {
                        sheet: SHEET_FIXED_DEPOSITS.to_string(),
                        row: row_index,
                        column: "maturity_date".to_string(),
                        value: md.to_string(),
                        rule: "MATURITY_BEFORE_START".to_string(),
                        message: "Maturity date is before start date".to_string(),
                    });
                    continue;
                }

                result.fixed_deposits.push(FixedDepositRecord {
                    member_business_id: mid,
                    fixed_deposit_id: fdid,
                    deposit_type: dt,
                    start_date: sd,
                    maturity_date: md,
                    status: status_enum,
                    tenure_category: get_string_cell(row, 6).unwrap_or_default(),
                    original_tenure_selected: get_string_cell(row, 7).unwrap_or_default(),
                    early_withdrawal_flag: get_bool_cell(row, 8).unwrap_or(false),
                    rollover_at_maturity_flag: get_bool_cell(row, 9).unwrap_or(false),
                    number_of_renewals: get_int_cell(row, 10).unwrap_or(0),
                    change_in_tenure_at_renewal: get_bool_cell(row, 11).unwrap_or(false),
                    single_depositor_dependency_flag: get_bool_cell(row, 12).unwrap_or(false),
                    interest_rate: get_decimal_cell(row, 13).unwrap_or_default(),
                    balance: get_decimal_cell(row, 14).unwrap_or_default(),
                });
            }
            _ => {
                result.errors.push(NfParseError {
                    sheet: SHEET_FIXED_DEPOSITS.to_string(),
                    row: row_index,
                    column: "required_fields".to_string(),
                    value: String::new(),
                    rule: "MISSING_REQUIRED".to_string(),
                    message: format!("Row {} is missing required fields", row_index),
                });
            }
        }
    }
}

fn run_cross_table_validations(result: &mut NfParseResult) {
    let member_ids: HashMap<&str, bool> = result
        .members
        .iter()
        .map(|m| (m.member_id.as_str(), true))
        .collect();

    let mut bad_indices: Vec<usize> = Vec::new();
    for (idx, loan) in result.loans.iter().enumerate() {
        if !member_ids.contains_key(loan.member_business_id.as_str()) {
            result.errors.push(NfParseError {
                sheet: SHEET_LOANS.to_string(),
                row: idx + 1,
                column: "member_id".to_string(),
                value: loan.loan_id.clone(),
                rule: "LOAN_WITHOUT_MEMBER".to_string(),
                message: format!(
                    "Loan {} references member {} who is not in the members sheet",
                    loan.loan_id, loan.member_business_id
                ),
            });
            bad_indices.push(idx);
        }
    }
    for i in bad_indices.into_iter().rev() {
        result.loans.remove(i);
    }

    bad_indices = Vec::new();
    for (idx, sa) in result.savings_accounts.iter().enumerate() {
        if !member_ids.contains_key(sa.member_business_id.as_str()) {
            result.errors.push(NfParseError {
                sheet: SHEET_SAVINGS.to_string(),
                row: idx + 1,
                column: "member_id".to_string(),
                value: sa.savings_account_id.clone(),
                rule: "LOAN_WITHOUT_MEMBER".to_string(),
                message: format!(
                    "Savings account {} references member {} who is not in the members sheet",
                    sa.savings_account_id, sa.member_business_id
                ),
            });
            bad_indices.push(idx);
        }
    }
    for i in bad_indices.into_iter().rev() {
        result.savings_accounts.remove(i);
    }

    bad_indices = Vec::new();
    for (idx, fd) in result.fixed_deposits.iter().enumerate() {
        if !member_ids.contains_key(fd.member_business_id.as_str()) {
            result.errors.push(NfParseError {
                sheet: SHEET_FIXED_DEPOSITS.to_string(),
                row: idx + 1,
                column: "member_id".to_string(),
                value: fd.fixed_deposit_id.clone(),
                rule: "LOAN_WITHOUT_MEMBER".to_string(),
                message: format!(
                    "Fixed deposit {} references member {} who is not in the members sheet",
                    fd.fixed_deposit_id, fd.member_business_id
                ),
            });
            bad_indices.push(idx);
        }
    }
    for i in bad_indices.into_iter().rev() {
        result.fixed_deposits.remove(i);
    }
}

fn get_string_cell(row: &[Data], col: usize) -> Option<String> {
    row.get(col).and_then(|cell| match cell {
        Data::String(s) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }
        Data::Int(i) => Some(i.to_string()),
        Data::Float(f) => Some(f.to_string()),
        Data::Bool(b) => Some(b.to_string()),
        Data::DateTime(f) => Some(f.to_string()),
        Data::DurationIso(s) | Data::DateTimeIso(s) => Some(s.clone()),
        Data::Error(e) => Some(format!("{:?}", e)),
        Data::Empty => None,
    })
}

fn get_optional_string_cell(row: &[Data], col: usize) -> Option<String> {
    row.get(col).and_then(|cell| match cell {
        Data::String(s) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }
        Data::Empty => None,
        _ => get_string_cell(row, col),
    })
}

fn get_date_cell(row: &[Data], col: usize) -> Option<NaiveDate> {
    let cell = row.get(col)?;
    match cell {
        Data::DateTime(_) | Data::DurationIso(_) | Data::DateTimeIso(_) => {
            let dt_str = match cell {
                Data::DateTime(f) => f.to_string(),
                Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
                _ => return None,
            };
            NaiveDate::parse_from_str(&dt_str, "%Y-%m-%d")
                .or_else(|_| NaiveDate::parse_from_str(&dt_str, "%Y-%m-%d %H:%M:%S"))
                .ok()
        }
        Data::String(s) => NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d")
            .or_else(|_| NaiveDate::parse_from_str(s.trim(), "%d/%m/%Y"))
            .or_else(|_| NaiveDate::parse_from_str(s.trim(), "%m/%d/%Y"))
            .ok(),
        _ => None,
    }
}

fn get_optional_date_cell(row: &[Data], col: usize) -> Option<Option<NaiveDate>> {
    let cell = row.get(col)?;
    match cell {
        Data::Empty => Some(None),
        _ => Some(get_date_cell(row, col)),
    }
}

fn get_bool_cell(row: &[Data], col: usize) -> Option<bool> {
    row.get(col).and_then(|cell| match cell {
        Data::Bool(b) => Some(*b),
        Data::String(s) => match s.trim().to_lowercase().as_str() {
            "true" | "yes" | "1" | "y" => Some(true),
            "false" | "no" | "0" | "n" => Some(false),
            _ => None,
        },
        Data::Int(i) => Some(*i != 0),
        Data::Float(f) => Some(*f != 0.0),
        Data::Empty => None,
        _ => None,
    })
}

fn get_int_cell(row: &[Data], col: usize) -> Option<i32> {
    row.get(col).and_then(|cell| match cell {
        Data::Int(i) => Some(*i as i32),
        Data::Float(f) => Some(*f as i32),
        Data::String(s) => s.trim().parse().ok(),
        Data::Empty => None,
        _ => None,
    })
}

fn get_decimal_cell(row: &[Data], col: usize) -> Option<Decimal> {
    row.get(col).and_then(|cell| match cell {
        Data::Int(i) => Decimal::from(*i).into(),
        Data::Float(f) => Decimal::try_from(*f).ok(),
        Data::String(s) => Decimal::from_str_exact(s.trim()).ok(),
        Data::Empty => None,
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calamine_parser_creates() {
        let parser = CalamineNfParser::new();
        let _ = &parser;
    }

    #[test]
    fn test_get_string_cell_string() {
        let row = vec![Data::String("hello".to_string())];
        assert_eq!(get_string_cell(&row, 0), Some("hello".to_string()));
    }

    #[test]
    fn test_get_string_cell_empty() {
        let row = vec![Data::Empty];
        assert_eq!(get_string_cell(&row, 0), None);
    }

    #[test]
    fn test_get_bool_cell_string_true() {
        let row = vec![Data::String("true".to_string())];
        assert_eq!(get_bool_cell(&row, 0), Some(true));
    }

    #[test]
    fn test_get_int_cell() {
        let row = vec![Data::Int(42)];
        assert_eq!(get_int_cell(&row, 0), Some(42));
    }

    #[test]
    fn test_get_date_cell_iso() {
        let row = vec![Data::String("2024-01-15".to_string())];
        let date = get_date_cell(&row, 0);
        assert!(date.is_some());
        assert_eq!(date.unwrap().to_string(), "2024-01-15");
    }
}
