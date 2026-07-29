use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::balance_sheet_line_item::Model as LineItemModel;
use crate::entities::chart_of_account::Model as CoaModel;
use crate::entities::financial_statement::Model as FsModel;
use crate::services::kpi_engine::KpiValue;

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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
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

// ── KPI response types ───────────────────────────────────────────────────────

/// A single computed KPI item for API responses.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct KpiItemResponse {
    pub name: String,
    pub value: f64,
    pub formatted: String,
    /// "percent" | "currency" | "ratio"
    pub unit: String,
    /// "green" | "amber" | "red"
    pub status: Option<String>,
    pub benchmark: Option<f64>,
    pub description: String,
}

impl From<KpiValue> for KpiItemResponse {
    fn from(k: KpiValue) -> Self {
        Self {
            name: k.name,
            value: k.value,
            formatted: k.formatted,
            unit: k.unit,
            status: k.status,
            benchmark: k.benchmark,
            description: k.description,
        }
    }
}

/// Full KPI response for a submission.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionKpisResponse {
    pub submission_id: Uuid,
    pub reporting_year: i32,
    pub computed_at: DateTime<Utc>,
    /// Reflects the submission's current status (draft / submitted / in_review / approved)
    pub submission_status: String,
    pub kpis: Vec<KpiItemResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prior_year_kpis: Option<Vec<KpiItemResponse>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionLineItemsResponse {
    pub submission_id: Uuid,
    pub current_year: Vec<LineItemResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prior_year: Option<Vec<LineItemResponse>>,
}

// ── Benchmark response types ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BenchmarkResponse {
    pub kpi_name: String,
    pub cooperative_type: Option<String>,
    pub reporting_year: i32,
    pub sector_average: f64,
    pub national_average: f64,
    pub percentile_25: f64,
    pub percentile_50: f64,
    pub percentile_75: f64,
    pub sample_count: usize,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BenchmarkQueryParams {
    pub kpi_name: String,
    pub cooperative_type: Option<String>,
    pub reporting_year: Option<i32>,
}

// ── Export params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct ExportParams {
    /// "xlsx" or "csv"
    pub format: String,
}

// ── Ministry stats ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MinistryStatsResponse {
    pub total_cooperatives: i64,
    pub total_submissions: i64,
    pub pending_review_count: i64,
    pub approved_count: i64,
    pub rejected_count: i64,
    /// National average PAR30 across all approved submissions
    pub average_par30: Option<f64>,
    /// National average Capital Adequacy Ratio across all approved submissions
    pub average_car: Option<f64>,
}

// ── Monthly trend ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MonthlyTrendResponse {
    pub year: i32,
    pub months: Vec<MonthlyTrendPoint>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MonthlyTrendPoint {
    pub month: i16,
    pub month_label: String,
    /// Member savings and deposits (COA 2101–2103).
    pub savings: f64,
    /// Gross loan portfolio (COA 1201–1205).
    pub loans: f64,
    /// Total assets (COA 1999).
    pub assets: f64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionActivityResponse {
    pub year: i32,
    pub months: Vec<SubmissionActivityPoint>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionActivityPoint {
    pub month: i16,
    pub month_label: String,
    pub submitted: u64,
    pub approved: u64,
    pub rejected: u64,
    pub in_review: u64,
}

// ── Region compliance ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RegionComplianceResponse {
    pub regions: Vec<RegionCompliancePoint>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RegionCompliancePoint {
    pub name: String,
    pub score: f64,
    pub coops: i64,
}

// ── Sector breakdown ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SectorBreakdownResponse {
    pub sectors: Vec<SectorBreakdownPoint>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SectorBreakdownPoint {
    pub name: String,
    pub value: i64,
    pub count: i64,
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::kpi_engine::KpiValue;
    use chrono::Utc;

    fn sample_kpi_value(name: &str, value: f64) -> KpiValue {
        KpiValue {
            name: name.to_string(),
            value,
            formatted: format!("{:.1}%", value),
            unit: "percent".to_string(),
            status: Some("green".to_string()),
            benchmark: Some(5.0),
            description: "Test KPI".to_string(),
        }
    }

    #[test]
    fn test_kpi_item_response_from_kpi_value() {
        let kv = sample_kpi_value("par30", 3.5);
        let resp = KpiItemResponse::from(kv);
        assert_eq!(resp.name, "par30");
        assert!((resp.value - 3.5).abs() < f64::EPSILON);
        assert_eq!(resp.unit, "percent");
        assert_eq!(resp.status, Some("green".to_string()));
        assert_eq!(resp.benchmark, Some(5.0));
    }

    #[test]
    fn test_submission_kpis_response_serialization() {
        let resp = SubmissionKpisResponse {
            submission_id: Uuid::new_v4(),
            reporting_year: 2025,
            computed_at: Utc::now(),
            submission_status: "approved".to_string(),
            kpis: vec![KpiItemResponse::from(sample_kpi_value("roa", 3.2))],
            prior_year_kpis: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("submission_id"));
        assert!(json.contains("reporting_year"));
        assert!(json.contains("roa"));
    }

    #[test]
    fn test_benchmark_response_serialization() {
        let resp = BenchmarkResponse {
            kpi_name: "par30".to_string(),
            cooperative_type: Some("sacco".to_string()),
            reporting_year: 2025,
            sector_average: 4.2,
            national_average: 5.1,
            percentile_25: 2.1,
            percentile_50: 4.0,
            percentile_75: 7.5,
            sample_count: 42,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("sector_average"));
        assert!(json.contains("sample_count"));
    }

    #[test]
    fn test_ministry_stats_response_serialization() {
        let resp = MinistryStatsResponse {
            total_cooperatives: 100,
            total_submissions: 85,
            pending_review_count: 12,
            approved_count: 68,
            rejected_count: 5,
            average_par30: Some(4.5),
            average_car: Some(12.3),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("total_cooperatives"));
        assert!(json.contains("pending_review_count"));
        assert!(json.contains("average_par30"));
        assert!(json.contains("average_car"));
    }
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
