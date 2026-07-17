use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::balance_sheet_line_item::Model as LineItemModel;
use crate::entities::chart_of_account::Model as CoaModel;
use crate::entities::financial_statement::Model as FsModel;

#[derive(Debug, Serialize, ToSchema)]
pub struct FinancialStatementResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub accounting_year: String,
    pub currency: String,
    pub is_validated: bool,
    pub validation_errors: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<FsModel> for FinancialStatementResponse {
    fn from(m: FsModel) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            cooperative_id: m.cooperative_id,
            reporting_year: m.reporting_year,
            accounting_year: m.accounting_year.as_str().to_string(),
            currency: match m.currency {
                crate::entities::enums::Currency::Szl => "SZL".to_string(),
                crate::entities::enums::Currency::Usd => "USD".to_string(),
            },
            is_validated: m.is_validated,
            validation_errors: m.validation_errors,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LineItemResponse {
    pub id: Uuid,
    pub financial_statement_id: Uuid,
    pub account_code: Option<i32>,
    pub account_name: String,
    pub account_category: String,
    pub account_subcategory: String,
    pub month: i16,
    /// Monetary value
    pub value: Option<f64>,
    /// AI extraction confidence (0.0–1.0)
    pub ai_confidence: Option<f64>,
    pub ai_flagged: bool,
    pub manually_edited: bool,
    /// Original text label from the uploaded document
    pub raw_label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<LineItemModel> for LineItemResponse {
    fn from(m: LineItemModel) -> Self {
        use rust_decimal::prelude::ToPrimitive;
        Self {
            id: m.id,
            financial_statement_id: m.financial_statement_id,
            account_code: m.account_code,
            account_name: m.account_name,
            account_category: m.account_category.as_str().to_string(),
            account_subcategory: m.account_subcategory,
            month: m.month,
            value: m.value.and_then(|d| d.to_f64()),
            ai_confidence: m.ai_confidence.and_then(|d| d.to_f64()),
            ai_flagged: m.ai_flagged,
            manually_edited: m.manually_edited,
            raw_label: m.raw_label,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LineItemUpdateRequest {
    pub id: Uuid,
    pub value: Option<f64>,
    pub account_code: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LineItemBulkUpdateRequest {
    pub updates: Vec<LineItemUpdateRequest>,
}

// ── Chart of Accounts DTO ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct ChartOfAccountResponse {
    pub account_code: i32,
    pub account_name: String,
    /// "assets" | "liabilities" | "equity" | "income" | "expenses" | "surplus"
    pub account_category: String,
    pub account_subcategory: Option<String>,
    /// true for roll-up totals (1999, 2999, 3999, etc.)
    pub is_total: bool,
    /// true for display section headers (1000, 2000, etc.)
    pub is_section_header: bool,
    /// e.g. "1101+1102+1103+1104" — present only on total/parent codes
    pub formula: Option<String>,
    pub display_order: i32,
}

impl From<CoaModel> for ChartOfAccountResponse {
    fn from(m: CoaModel) -> Self {
        Self {
            account_code: m.account_code,
            account_name: m.account_name,
            account_category: m.account_category.as_str().to_string(),
            account_subcategory: m.account_subcategory,
            is_total: m.is_total,
            is_section_header: m.is_section_header,
            formula: m.formula,
            display_order: m.display_order,
        }
    }
}
