use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::entities::enums::{
    AccountType, AgeGroup, DpdCategory, EswatiniRegion, FdStatus, Gender, LoanStatus, MemberStatus,
    UrbanRural,
};
use crate::error::{AppError, AppResult};
use crate::services::ai_extraction::NfHeaderMapper;

// ── Section ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NfSection {
    Members,
    Savings,
    Loans,
    FixedDeposits,
    FarmCoop,
}

impl NfSection {
    pub fn sheet_name(&self) -> &'static str {
        match self {
            NfSection::Members => SHEET_MEMBERS,
            NfSection::Savings => SHEET_SAVINGS,
            NfSection::Loans => SHEET_LOANS,
            NfSection::FixedDeposits => SHEET_FIXED_DEPOSITS,
            NfSection::FarmCoop => SHEET_FARM_COOP,
        }
    }

    pub fn parse(s: &str) -> Option<NfSection> {
        let normalized = s.trim().to_lowercase().replace(['-', ' '], "_");
        let cleaned = normalized.strip_prefix("nf_").unwrap_or(&normalized);
        match cleaned {
            "members" | "membership" | "member" | "mship" | "shares" | "share" => {
                Some(NfSection::Members)
            }
            "savings" | "saving" | "s" => Some(NfSection::Savings),
            "loans" | "loan" => Some(NfSection::Loans),
            "fixed_deposits" | "fixeddeposits" | "fixed_deposit" | "fd" | "fs" | "fixed" => {
                Some(NfSection::FixedDeposits)
            }
            "farm" | "farm_coop" | "farmcoop" => Some(NfSection::FarmCoop),
            _ => None,
        }
    }
}

// ── Trait ─────────────────────────────────────────────────────────────────────

#[async_trait::async_trait]
pub trait NfExcelParser: Send + Sync {
    async fn parse(
        &self,
        file_bytes: &[u8],
        mapper: Option<Arc<dyn NfHeaderMapper>>,
        section: Option<NfSection>,
    ) -> AppResult<NfParseResult>;
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

#[async_trait::async_trait]
impl NfExcelParser for CalamineNfParser {
    async fn parse(
        &self,
        file_bytes: &[u8],
        mapper: Option<Arc<dyn NfHeaderMapper>>,
        section: Option<NfSection>,
    ) -> AppResult<NfParseResult> {
        parse_workbook(file_bytes, mapper, section).await
    }
}

const SHEET_MEMBERS: &str = "NF MSHIP";
const SHEET_SAVINGS: &str = "NF S";
const SHEET_LOANS: &str = "NF LOANS";
const SHEET_FIXED_DEPOSITS: &str = "NF FS";
const SHEET_FARM_COOP: &str = "NF FARM";

const MEMBERS_HEADERS: &[&str] = &[
    "member_id",
    "join_date",
    "status",
    "exit_date",
    "gender",
    "age_group",
    "region",
    "urban_rural",
    "agm_attendance",
    "leadership_role",
    "voting_exercised",
];

const SAVINGS_HEADERS: &[&str] = &[
    "member_id",
    "savings_account_id",
    "account_type",
    "account_opening_date",
    "account_status",
    "contribution_frequency",
    "last_contribution_date",
    "number_of_contributions",
    "balance_trend",
    "zero_balance_flag",
    "withdrawal_frequency_category",
    "emergency_withdrawals_flag",
    "interest_rate",
    "balance",
];

const LOANS_HEADERS: &[&str] = &[
    "member_id",
    "loan_id",
    "loan_product_type",
    "loan_start_date",
    "loan_maturity_date",
    "loan_status",
    "borrower_type",
    "youth_borrower_flag",
    "women_borrower_flag",
    "rural_borrower_flag",
    "repayment_regularity",
    "days_past_due_category",
    "missed_installments_count",
    "restructured_loan_flag",
    "number_of_restructurings",
    "early_settlement_flag",
    "multiple_loans_flag",
    "large_borrower_flag",
    "interest_rate",
    "balance",
    "loan_amount",
];

const FD_HEADERS: &[&str] = &[
    "member_id",
    "fixed_deposit_id",
    "deposit_type",
    "start_date",
    "maturity_date",
    "status",
    "tenure_category",
    "original_tenure_selected",
    "early_withdrawal_flag",
    "rollover_at_maturity_flag",
    "number_of_renewals",
    "change_in_tenure_at_renewal",
    "single_depositor_dependency_flag",
    "interest_rate",
    "balance",
];

const FARM_COOP_HEADERS: &[&str] = &[
    "cooperative_type",
    "primary_activities",
    "operational_status",
    "active_producer_flag",
    "production_type",
    "participation_frequency",
    "delivery_compliance",
    "production_cycle_type",
    "use_of_production_planning",
    "use_of_shared_inputs",
    "quality_compliance_flag",
    "market_channel_type",
    "formal_offtake_agreement",
    "buyer_concentration_flag",
    "price_predictability_category",
    "access_to_storage",
    "access_to_processing_facilities",
    "transport_coordination",
    "climate_exposure_type",
    "irrigation_access",
    "climate_mitigation_practices",
];

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
    #[serde(default)]
    pub share_balance: Decimal,
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
pub struct FarmCoopRecord {
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
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct NfParseResult {
    pub members: Vec<MemberRecord>,
    pub savings_accounts: Vec<SavingsAccountRecord>,
    pub loans: Vec<LoanRecord>,
    pub fixed_deposits: Vec<FixedDepositRecord>,
    pub farm_coop: Vec<FarmCoopRecord>,
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

async fn parse_workbook(
    file_bytes: &[u8],
    mapper: Option<Arc<dyn NfHeaderMapper>>,
    section: Option<NfSection>,
) -> AppResult<NfParseResult> {
    use calamine::{open_workbook_auto_from_rs, Reader};

    tracing::info!(
        bytes = file_bytes.len(),
        ai_mapper = mapper.is_some(),
        section = ?section,
        "Starting non-financial Excel workbook parse"
    );

    let mut result = NfParseResult::default();

    // Calamine is sync — run it on the blocking thread pool
    let file_bytes_owned = file_bytes.to_vec();
    let sheets_data: HashMap<String, calamine::Range<calamine::Data>> =
        tokio::task::spawn_blocking(move || {
            let mut wb = open_workbook_auto_from_rs(std::io::Cursor::new(file_bytes_owned))
                .map_err(|e| AppError::BadRequest(format!("Failed to open Excel file: {}", e)))?;
            let sheet_names = wb.sheet_names().to_vec();
            let mut out = HashMap::new();
            for name in sheet_names {
                if let Ok(range) = wb.worksheet_range(&name) {
                    out.insert(name, range);
                }
            }
            Ok::<_, AppError>(out)
        })
        .await
        .map_err(|e| AppError::InternalServerError(format!("Workbook thread join error: {e}")))??;

    let sheet_names: Vec<String> = sheets_data.keys().cloned().collect();
    tracing::info!(available_sheets = ?sheet_names, "Opened workbook");

    // Single-section upload: parse only the requested section. Cross-table member
    // validation is skipped because members may be uploaded in a separate file.
    if let Some(section) = section {
        parse_single_section(&sheets_data, section, &mut result, mapper.as_deref()).await;
        if result.sheets_found.is_empty() {
            tracing::error!(
                available_sheets = ?sheet_names,
                section = ?section,
                "No data found for requested section"
            );
            return Err(AppError::BadRequest(format!(
                "No data found for section '{}'. Expected a sheet named '{}' or a sheet with the section's columns.",
                section_name(section),
                section.sheet_name()
            )));
        }
        return Ok(result);
    }

    for sheet_name in &sheet_names {
        if let Some(section) = NfSection::parse(sheet_name) {
            match section {
                NfSection::Members => {
                    result.sheets_found.push(sheet_name.clone());
                    tracing::info!(sheet = %sheet_name, "Processing members sheet");
                    if let Some(range) = sheets_data.get(sheet_name) {
                        parse_members_sheet(range, &mut result, mapper.as_deref()).await;
                    }
                }
                NfSection::Savings => {
                    result.sheets_found.push(sheet_name.clone());
                    tracing::info!(sheet = %sheet_name, "Processing savings sheet");
                    if let Some(range) = sheets_data.get(sheet_name) {
                        parse_savings_sheet(range, &mut result, mapper.as_deref()).await;
                    }
                }
                NfSection::Loans => {
                    result.sheets_found.push(sheet_name.clone());
                    tracing::info!(sheet = %sheet_name, "Processing loans sheet");
                    if let Some(range) = sheets_data.get(sheet_name) {
                        parse_loans_sheet(range, &mut result, mapper.as_deref()).await;
                    }
                }
                NfSection::FixedDeposits => {
                    result.sheets_found.push(sheet_name.clone());
                    tracing::info!(sheet = %sheet_name, "Processing fixed deposits sheet");
                    if let Some(range) = sheets_data.get(sheet_name) {
                        parse_fixed_deposits_sheet(range, &mut result, mapper.as_deref()).await;
                    }
                }
                NfSection::FarmCoop => {
                    result.sheets_found.push(sheet_name.clone());
                    tracing::info!(sheet = %sheet_name, "Processing farm coop sheet");
                    if let Some(range) = sheets_data.get(sheet_name) {
                        parse_farm_coop_sheet(range, &mut result, mapper.as_deref()).await;
                    }
                }
            }
        } else {
            tracing::debug!(sheet = %sheet_name, "Skipping unrecognized sheet");
        }
    }

    if result.sheets_found.is_empty() {
        tracing::error!(available_sheets = ?sheet_names, "No recognized NF sheets found");
        return Err(AppError::BadRequest(
            "No recognized sheets found. Expected at least one of: NF MSHIP, NF S, NF LOANS, NF FS, NF FARM"
                .to_string(),
        ));
    }

    run_cross_table_validations(&mut result);

    tracing::info!(
        sheets_found = ?result.sheets_found,
        members = result.members.len(),
        savings = result.savings_accounts.len(),
        loans = result.loans.len(),
        fixed_deposits = result.fixed_deposits.len(),
        farm_coop = result.farm_coop.len(),
        errors = result.errors.len(),
        warnings = result.warnings.len(),
        "Finished parsing non-financial workbook"
    );

    Ok(result)
}

fn section_name(section: NfSection) -> &'static str {
    match section {
        NfSection::Members => "Membership",
        NfSection::Savings => "Savings",
        NfSection::Loans => "Loans",
        NfSection::FixedDeposits => "Fixed Deposits",
        NfSection::FarmCoop => "Farm Cooperative",
    }
}

async fn parse_single_section(
    sheets_data: &HashMap<String, Range<Data>>,
    section: NfSection,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    // 1. Try finding a sheet in the workbook that maps to the requested section
    let mut found_sheet_name = None;
    for name in sheets_data.keys() {
        if NfSection::parse(name) == Some(section) {
            found_sheet_name = Some(name.clone());
            break;
        }
    }

    // 2. Fallback to canonical name or first sheet
    let sheet_to_use = found_sheet_name.unwrap_or_else(|| {
        let canonical = section.sheet_name();
        if sheets_data.contains_key(canonical) {
            canonical.to_string()
        } else {
            sheets_data.keys().next().cloned().unwrap_or_default()
        }
    });

    if sheet_to_use.is_empty() {
        return;
    }

    let range = sheets_data.get(&sheet_to_use);
    let Some(range) = range else {
        return;
    };

    result.sheets_found.push(sheet_to_use.clone());
    tracing::info!(section = ?section, sheet = %sheet_to_use, "Processing single-section upload");
    match section {
        NfSection::Members => parse_members_sheet(range, result, mapper).await,
        NfSection::Savings => parse_savings_sheet(range, result, mapper).await,
        NfSection::Loans => parse_loans_sheet(range, result, mapper).await,
        NfSection::FixedDeposits => parse_fixed_deposits_sheet(range, result, mapper).await,
        NfSection::FarmCoop => parse_farm_coop_sheet(range, result, mapper).await,
    }
}

use calamine::{Data, Range};

/// Build a column index map from a header row.
///
/// Strategy (three-pass):
/// 1. Exact lowercase match — free, instant.
/// 2. Fuzzy built-in aliases (spaces↔underscores, common abbreviations).
/// 3. LLM fallback — only if a mapper is provided AND there are still missing required columns.
///
/// Emits LOW-003-style `MAPPED` warnings for any column resolved via pass 2 or 3.
/// Emits a `MISSING_HEADERS` error and returns `None` only when required columns are still
/// unresolved after all passes.
async fn build_column_map(
    header_row: &[Data],
    expected_headers: &[&str],
    sheet_name: &str,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) -> Option<HashMap<String, usize>> {
    // ── Pass 1: exact lowercase match ─────────────────────────────────────────
    let actual_headers: Vec<String> = header_row
        .iter()
        .map(|cell| match cell {
            Data::String(s) => s.trim().to_string(),
            Data::Int(i) => i.to_string(),
            _ => String::new(),
        })
        .collect();

    let mut col_map: HashMap<String, usize> = HashMap::new();
    for (idx, h) in actual_headers.iter().enumerate() {
        if !h.is_empty() {
            col_map.insert(h.to_lowercase(), idx);
        }
    }

    let missing_after_exact: Vec<&str> = expected_headers
        .iter()
        .copied()
        .filter(|&e| !col_map.contains_key(e))
        .collect();

    if missing_after_exact.is_empty() {
        return Some(col_map);
    }

    tracing::info!(
        sheet = sheet_name,
        missing = ?missing_after_exact,
        "Pass 1 (exact match) left missing columns — trying fuzzy aliases"
    );

    // ── Pass 2: built-in fuzzy aliases ────────────────────────────────────────
    // Handles: spaces↔underscores, hyphens, capitalisation, and close typos
    // (Levenshtein distance ≤ 2 on the normalised form).
    let mut still_missing: Vec<&str> = Vec::new();

    for &expected in &missing_after_exact {
        // First try formatting normalisation only (zero cost, no false positives)
        let formatting_match = col_map.iter().find_map(|(actual, &idx)| {
            let normalised = actual.replace([' ', '-'], "_").replace("__", "_");
            if normalised == expected {
                Some((idx, actual.clone()))
            } else {
                None
            }
        });

        if let Some((idx, actual_key)) = formatting_match {
            result.warnings.push(NfParseWarning {
                sheet: sheet_name.to_string(),
                row: 0,
                column: expected.to_string(),
                rule: "MAPPED".to_string(),
                message: format!(
                    "ℹ️ MAPPED: '{}' was mapped to '{}' via formatting normalisation",
                    actual_key, expected
                ),
            });
            col_map.insert(expected.to_string(), idx);
            continue;
        }

        // Levenshtein fallback: strip underscores from both sides and compare
        // e.g. "memberess" vs "member_id" → "memberess" vs "memberid" → distance 3 (skip)
        //      "mem_id"    vs "member_id" → "memid" vs "memberid"     → distance 4 (skip)
        //      "member id" vs "member_id" → already caught above
        //      "loan_id_"  vs "loan_id"   → distance 1 → map ✓
        let typo_match = col_map.iter().find_map(|(actual, &idx)| {
            let a = actual.replace('_', "");
            let e = expected.replace('_', "");
            if levenshtein(&a, &e) <= 2 && !a.is_empty() && !e.is_empty() {
                Some((idx, actual.clone()))
            } else {
                None
            }
        });

        if let Some((idx, actual_key)) = typo_match {
            result.warnings.push(NfParseWarning {
                sheet: sheet_name.to_string(),
                row: 0,
                column: expected.to_string(),
                rule: "MAPPED".to_string(),
                message: format!(
                    "ℹ️ MAPPED: '{}' was mapped to '{}' via typo correction (fuzzy match)",
                    actual_key, expected
                ),
            });
            col_map.insert(expected.to_string(), idx);
        } else {
            still_missing.push(expected);
        }
    }

    if still_missing.is_empty() {
        return Some(col_map);
    }

    // ── Pass 3: LLM mapping ───────────────────────────────────────────────────
    if let Some(m) = mapper {
        tracing::info!(
            sheet = sheet_name,
            missing = ?still_missing,
            "Pass 2 (fuzzy) left missing columns — calling LLM header mapper"
        );

        let non_empty_actuals: Vec<String> = actual_headers
            .iter()
            .filter(|h| !h.is_empty())
            .cloned()
            .collect();

        let ai_map = m
            .map_headers(sheet_name, &non_empty_actuals, expected_headers)
            .await;

        let mut still_missing_after_ai: Vec<&str> = Vec::new();

        for &expected in &still_missing {
            // The LLM returns { actual_header_lowercase → canonical }
            // Find an entry where the value matches the expected canonical field
            if let Some((actual_key, _)) = ai_map
                .iter()
                .find(|(_, canonical)| canonical.as_str() == expected)
            {
                // Find the column index for the original actual header
                if let Some(&idx) = col_map.get(actual_key.as_str()) {
                    result.warnings.push(NfParseWarning {
                        sheet: sheet_name.to_string(),
                        row: 0,
                        column: expected.to_string(),
                        rule: "MAPPED".to_string(),
                        message: format!(
                            "ℹ️ MAPPED: '{}' was mapped to '{}' via AI header mapping",
                            actual_key, expected
                        ),
                    });
                    col_map.insert(expected.to_string(), idx);
                } else {
                    still_missing_after_ai.push(expected);
                }
            } else {
                still_missing_after_ai.push(expected);
            }
        }

        if still_missing_after_ai.is_empty() {
            return Some(col_map);
        }

        // Some required columns truly not found even after AI
        tracing::error!(
            sheet = sheet_name,
            missing = ?still_missing_after_ai,
            "Missing required columns after all mapping passes (incl. AI)"
        );
        result.errors.push(NfParseError {
            sheet: sheet_name.to_string(),
            row: 0,
            column: "headers".to_string(),
            value: still_missing_after_ai.join(", "),
            rule: "MISSING_HEADERS".to_string(),
            message: format!(
                "Missing required columns (AI mapping attempted): {}",
                still_missing_after_ai.join(", ")
            ),
        });
        return None;
    }

    // No mapper available — report missing as before
    tracing::error!(
        sheet = sheet_name,
        missing = ?still_missing,
        "Missing required columns in sheet (no AI mapper configured)"
    );
    result.errors.push(NfParseError {
        sheet: sheet_name.to_string(),
        row: 0,
        column: "headers".to_string(),
        value: still_missing.join(", "),
        rule: "MISSING_HEADERS".to_string(),
        message: format!("Missing required columns: {}", still_missing.join(", ")),
    });
    None
}

async fn parse_members_sheet(
    range: &Range<Data>,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    let mut rows = range.rows();
    let header_row = match rows.next() {
        Some(h) => h,
        None => return,
    };

    let map =
        match build_column_map(header_row, MEMBERS_HEADERS, SHEET_MEMBERS, result, mapper).await {
            Some(m) => m,
            None => return,
        };

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_id = get_string_cell(row, *map.get("member_id").unwrap());
        let join_date = get_date_cell(row, *map.get("join_date").unwrap());
        let status = get_string_cell(row, *map.get("status").unwrap());
        let exit_date = get_optional_date_cell(row, *map.get("exit_date").unwrap());
        let gender = get_string_cell(row, *map.get("gender").unwrap());
        let age_group = get_string_cell(row, *map.get("age_group").unwrap());
        let region = get_string_cell(row, *map.get("region").unwrap());
        let urban_rural = get_string_cell(row, *map.get("urban_rural").unwrap());

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

                let agm_attendance =
                    get_bool_cell(row, *map.get("agm_attendance").unwrap_or(&0)).unwrap_or(false);
                let leadership_role =
                    get_optional_string_cell(row, *map.get("leadership_role").unwrap_or(&0));
                let voting_exercised =
                    get_bool_cell(row, *map.get("voting_exercised").unwrap_or(&0)).unwrap_or(false);
                let share_balance = get_decimal_cell(row, *map.get("share_balance").unwrap_or(&0))
                    .or_else(|| get_decimal_cell(row, *map.get("balance_share").unwrap_or(&0)))
                    .unwrap_or(Decimal::ZERO);

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
                    share_balance,
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

async fn parse_savings_sheet(
    range: &Range<Data>,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    let mut rows = range.rows();
    let header_row = match rows.next() {
        Some(h) => h,
        None => return,
    };

    let map =
        match build_column_map(header_row, SAVINGS_HEADERS, SHEET_SAVINGS, result, mapper).await {
            Some(m) => m,
            None => return,
        };

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, *map.get("member_id").unwrap());
        let savings_account_id = get_string_cell(row, *map.get("savings_account_id").unwrap());
        let account_type = get_string_cell(row, *map.get("account_type").unwrap());
        let account_opening_date = get_date_cell(row, *map.get("account_opening_date").unwrap());

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
                    account_status: get_string_cell(row, *map.get("account_status").unwrap_or(&0))
                        .unwrap_or_else(|| "Active".to_string()),
                    contribution_frequency: get_string_cell(
                        row,
                        *map.get("contribution_frequency").unwrap_or(&0),
                    )
                    .unwrap_or_default(),
                    last_contribution_date: get_optional_date_cell(
                        row,
                        *map.get("last_contribution_date").unwrap_or(&0),
                    )
                    .flatten(),
                    number_of_contributions: get_int_cell(
                        row,
                        *map.get("number_of_contributions").unwrap_or(&0),
                    )
                    .unwrap_or(0),
                    balance_trend: get_string_cell(row, *map.get("balance_trend").unwrap_or(&0))
                        .unwrap_or_default(),
                    zero_balance_flag: get_bool_cell(
                        row,
                        *map.get("zero_balance_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    withdrawal_frequency_category: get_string_cell(
                        row,
                        *map.get("withdrawal_frequency_category").unwrap_or(&0),
                    )
                    .unwrap_or_default(),
                    emergency_withdrawals_flag: get_bool_cell(
                        row,
                        *map.get("emergency_withdrawals_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    interest_rate: get_decimal_cell(row, *map.get("interest_rate").unwrap_or(&0))
                        .unwrap_or_default(),
                    balance: get_decimal_cell(row, *map.get("balance").unwrap_or(&0))
                        .unwrap_or_default(),
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

async fn parse_loans_sheet(
    range: &Range<Data>,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    let mut rows = range.rows();
    let header_row = match rows.next() {
        Some(h) => h,
        None => return,
    };

    let map = match build_column_map(header_row, LOANS_HEADERS, SHEET_LOANS, result, mapper).await {
        Some(m) => m,
        None => return,
    };

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, *map.get("member_id").unwrap());
        let loan_id = get_string_cell(row, *map.get("loan_id").unwrap());
        let loan_product_type = get_string_cell(row, *map.get("loan_product_type").unwrap());
        let loan_start_date = get_date_cell(row, *map.get("loan_start_date").unwrap());
        let loan_maturity_date = get_date_cell(row, *map.get("loan_maturity_date").unwrap());
        let loan_status = get_string_cell(row, *map.get("loan_status").unwrap());

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

                let dpd_raw =
                    get_string_cell(row, *map.get("days_past_due_category").unwrap_or(&0))
                        .unwrap_or_else(|| "0".to_string());
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
                    borrower_type: get_string_cell(row, *map.get("borrower_type").unwrap_or(&0))
                        .unwrap_or_default(),
                    youth_borrower_flag: get_bool_cell(
                        row,
                        *map.get("youth_borrower_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    women_borrower_flag: get_bool_cell(
                        row,
                        *map.get("women_borrower_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    rural_borrower_flag: get_bool_cell(
                        row,
                        *map.get("rural_borrower_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    repayment_regularity: get_string_cell(
                        row,
                        *map.get("repayment_regularity").unwrap_or(&0),
                    )
                    .unwrap_or_default(),
                    days_past_due_category: dpd_category,
                    missed_installments_count: get_int_cell(
                        row,
                        *map.get("missed_installments_count").unwrap_or(&0),
                    )
                    .unwrap_or(0),
                    restructured_loan_flag: get_bool_cell(
                        row,
                        *map.get("restructured_loan_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    number_of_restructurings: get_int_cell(
                        row,
                        *map.get("number_of_restructurings").unwrap_or(&0),
                    )
                    .unwrap_or(0),
                    early_settlement_flag: get_bool_cell(
                        row,
                        *map.get("early_settlement_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    multiple_loans_flag: get_bool_cell(
                        row,
                        *map.get("multiple_loans_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    large_borrower_flag: get_bool_cell(
                        row,
                        *map.get("large_borrower_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    interest_rate: get_decimal_cell(row, *map.get("interest_rate").unwrap_or(&0))
                        .unwrap_or_default(),
                    balance: get_decimal_cell(row, *map.get("balance").unwrap_or(&0))
                        .unwrap_or_default(),
                    loan_amount: get_decimal_cell(row, *map.get("loan_amount").unwrap_or(&0))
                        .unwrap_or_default(),
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

async fn parse_fixed_deposits_sheet(
    range: &Range<Data>,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    let mut rows = range.rows();
    let header_row = match rows.next() {
        Some(h) => h,
        None => return,
    };

    let map = match build_column_map(header_row, FD_HEADERS, SHEET_FIXED_DEPOSITS, result, mapper)
        .await
    {
        Some(m) => m,
        None => return,
    };

    let mut row_index = 0usize;
    for row in rows {
        row_index += 1;
        let member_business_id = get_string_cell(row, *map.get("member_id").unwrap());
        let fixed_deposit_id = get_string_cell(row, *map.get("fixed_deposit_id").unwrap());
        let deposit_type = get_string_cell(row, *map.get("deposit_type").unwrap());
        let start_date = get_date_cell(row, *map.get("start_date").unwrap());
        let maturity_date = get_date_cell(row, *map.get("maturity_date").unwrap());
        let status = get_string_cell(row, *map.get("status").unwrap());

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
                    tenure_category: get_string_cell(
                        row,
                        *map.get("tenure_category").unwrap_or(&0),
                    )
                    .unwrap_or_default(),
                    original_tenure_selected: get_string_cell(
                        row,
                        *map.get("original_tenure_selected").unwrap_or(&0),
                    )
                    .unwrap_or_default(),
                    early_withdrawal_flag: get_bool_cell(
                        row,
                        *map.get("early_withdrawal_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    rollover_at_maturity_flag: get_bool_cell(
                        row,
                        *map.get("rollover_at_maturity_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    number_of_renewals: get_int_cell(
                        row,
                        *map.get("number_of_renewals").unwrap_or(&0),
                    )
                    .unwrap_or(0),
                    change_in_tenure_at_renewal: get_bool_cell(
                        row,
                        *map.get("change_in_tenure_at_renewal").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    single_depositor_dependency_flag: get_bool_cell(
                        row,
                        *map.get("single_depositor_dependency_flag").unwrap_or(&0),
                    )
                    .unwrap_or(false),
                    interest_rate: get_decimal_cell(row, *map.get("interest_rate").unwrap_or(&0))
                        .unwrap_or_default(),
                    balance: get_decimal_cell(row, *map.get("balance").unwrap_or(&0))
                        .unwrap_or_default(),
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
                rule: "SAVINGS_WITHOUT_MEMBER".to_string(),
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
                rule: "FIXED_DEPOSIT_WITHOUT_MEMBER".to_string(),
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

async fn parse_farm_coop_sheet(
    range: &Range<Data>,
    result: &mut NfParseResult,
    mapper: Option<&dyn NfHeaderMapper>,
) {
    let mut rows = range.rows();
    let header_row = match rows.next() {
        Some(h) => h,
        None => return,
    };

    let map = match build_column_map(
        header_row,
        FARM_COOP_HEADERS,
        SHEET_FARM_COOP,
        result,
        mapper,
    )
    .await
    {
        Some(m) => m,
        None => return,
    };

    for (idx, row) in rows.enumerate() {
        let row_index = idx + 1;

        let cooperative_type =
            get_string_cell(row, *map.get("cooperative_type").unwrap()).unwrap_or_default();
        let primary_activities =
            get_string_cell(row, *map.get("primary_activities").unwrap()).unwrap_or_default();
        let year_of_establishment = get_int_cell(
            row,
            *map.get("year_of_establishment").unwrap_or(&usize::MAX),
        );
        let operational_status =
            get_string_cell(row, *map.get("operational_status").unwrap()).unwrap_or_default();
        let active_producer_flag =
            get_bool_cell(row, *map.get("active_producer_flag").unwrap()).unwrap_or(false);
        let production_type =
            get_string_cell(row, *map.get("production_type").unwrap()).unwrap_or_default();
        let participation_frequency =
            get_string_cell(row, *map.get("participation_frequency").unwrap()).unwrap_or_default();
        let delivery_compliance =
            get_string_cell(row, *map.get("delivery_compliance").unwrap()).unwrap_or_default();
        let production_cycle_type =
            get_string_cell(row, *map.get("production_cycle_type").unwrap()).unwrap_or_default();
        let use_of_production_planning =
            get_bool_cell(row, *map.get("use_of_production_planning").unwrap()).unwrap_or(false);
        let use_of_shared_inputs =
            get_bool_cell(row, *map.get("use_of_shared_inputs").unwrap()).unwrap_or(false);
        let quality_compliance_flag =
            get_bool_cell(row, *map.get("quality_compliance_flag").unwrap()).unwrap_or(false);
        let market_channel_type =
            get_string_cell(row, *map.get("market_channel_type").unwrap()).unwrap_or_default();
        let formal_offtake_agreement =
            get_bool_cell(row, *map.get("formal_offtake_agreement").unwrap()).unwrap_or(false);
        let buyer_concentration_flag =
            get_bool_cell(row, *map.get("buyer_concentration_flag").unwrap()).unwrap_or(false);
        let price_predictability_category =
            get_string_cell(row, *map.get("price_predictability_category").unwrap())
                .unwrap_or_default();
        let access_to_storage =
            get_bool_cell(row, *map.get("access_to_storage").unwrap()).unwrap_or(false);
        let access_to_processing_facilities =
            get_bool_cell(row, *map.get("access_to_processing_facilities").unwrap())
                .unwrap_or(false);
        let transport_coordination =
            get_string_cell(row, *map.get("transport_coordination").unwrap()).unwrap_or_default();
        let climate_exposure_type =
            get_string_cell(row, *map.get("climate_exposure_type").unwrap()).unwrap_or_default();
        let irrigation_access =
            get_bool_cell(row, *map.get("irrigation_access").unwrap()).unwrap_or(false);
        let climate_mitigation_practices =
            get_string_cell(row, *map.get("climate_mitigation_practices").unwrap())
                .unwrap_or_default();

        if cooperative_type.is_empty()
            && primary_activities.is_empty()
            && operational_status.is_empty()
        {
            result.warnings.push(NfParseWarning {
                sheet: SHEET_FARM_COOP.to_string(),
                row: row_index,
                column: "cooperative_type".to_string(),
                rule: "EMPTY_ROW".to_string(),
                message: "Skipping empty row".to_string(),
            });
            continue;
        }

        result.farm_coop.push(FarmCoopRecord {
            cooperative_type,
            primary_activities,
            year_of_establishment,
            operational_status,
            active_producer_flag,
            production_type,
            participation_frequency,
            delivery_compliance,
            production_cycle_type,
            use_of_production_planning,
            use_of_shared_inputs,
            quality_compliance_flag,
            market_channel_type,
            formal_offtake_agreement,
            buyer_concentration_flag,
            price_predictability_category,
            access_to_storage,
            access_to_processing_facilities,
            transport_coordination,
            climate_exposure_type,
            irrigation_access,
            climate_mitigation_practices,
        });
    }
}

/// Levenshtein edit distance between two strings.
/// Used in pass 2 fuzzy matching to catch typos (e.g. "memberess" vs "memberid").
fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (m, n) = (a.len(), b.len());
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for (i, row) in dp.iter_mut().enumerate().take(m + 1) {
        row[0] = i;
    }
    for (j, cell) in dp[0].iter_mut().enumerate().take(n + 1) {
        *cell = j;
    }
    for i in 1..=m {
        for j in 1..=n {
            dp[i][j] = if a[i - 1] == b[j - 1] {
                dp[i - 1][j - 1]
            } else {
                1 + dp[i - 1][j].min(dp[i][j - 1]).min(dp[i - 1][j - 1])
            };
        }
    }
    dp[m][n]
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
    fn test_nf_section_parse() {
        assert_eq!(NfSection::parse("members"), Some(NfSection::Members));
        assert_eq!(NfSection::parse("Membership"), Some(NfSection::Members));
        assert_eq!(NfSection::parse("NF MSHIP"), Some(NfSection::Members));
        assert_eq!(NfSection::parse("shares"), Some(NfSection::Members));
        assert_eq!(NfSection::parse("savings"), Some(NfSection::Savings));
        assert_eq!(NfSection::parse("NF S"), Some(NfSection::Savings));
        assert_eq!(NfSection::parse("loans"), Some(NfSection::Loans));
        assert_eq!(
            NfSection::parse("fixed_deposits"),
            Some(NfSection::FixedDeposits)
        );
        assert_eq!(
            NfSection::parse("fixed-deposits"),
            Some(NfSection::FixedDeposits)
        );
        assert_eq!(
            NfSection::parse("fixed deposit"),
            Some(NfSection::FixedDeposits)
        );
        assert_eq!(NfSection::parse("NF FS"), Some(NfSection::FixedDeposits));
        assert_eq!(NfSection::parse("farm"), Some(NfSection::FarmCoop));
        assert_eq!(NfSection::parse("bogus"), None);
        assert_eq!(NfSection::parse(""), None);
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

    #[tokio::test]
    async fn test_build_column_map_success() {
        let header_row = vec![
            Data::String("member_id".to_string()),
            Data::String("join_date".to_string()),
            Data::String("status".to_string()),
        ];
        let mut result = NfParseResult::default();
        let map = build_column_map(
            &header_row,
            &["member_id", "join_date", "status"],
            "TEST",
            &mut result,
            None,
        )
        .await;
        assert!(map.is_some());
        assert!(result.errors.is_empty());
        let map = map.unwrap();
        assert_eq!(map.get("member_id"), Some(&0));
        assert_eq!(map.get("status"), Some(&2));
    }

    #[tokio::test]
    async fn test_build_column_map_missing_header() {
        let header_row = vec![
            Data::String("member_id".to_string()),
            Data::String("join_date".to_string()),
        ];
        let mut result = NfParseResult::default();
        let map = build_column_map(
            &header_row,
            &["member_id", "join_date", "status"],
            "TEST",
            &mut result,
            None,
        )
        .await;
        assert!(map.is_none());
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].rule, "MISSING_HEADERS");
    }

    #[tokio::test]
    async fn test_build_column_map_case_insensitive() {
        let header_row = vec![
            Data::String("Member_ID".to_string()),
            Data::String("JOIN_DATE".to_string()),
        ];
        let mut result = NfParseResult::default();
        let map = build_column_map(
            &header_row,
            &["member_id", "join_date"],
            "TEST",
            &mut result,
            None,
        )
        .await;
        assert!(map.is_some());
        assert!(result.errors.is_empty());
    }
}
