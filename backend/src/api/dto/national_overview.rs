use std::collections::HashMap;
use uuid::Uuid;

use crate::services::kpi_engine::KpiValue;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct NationalOverviewResponse {
    pub total_cooperatives: u64,
    pub cooperatives_with_data: u64,
    pub non_financial_summary: NfPortfolioSummary,
    /// KPI name → traffic light distribution
    pub distributions: HashMap<String, TrafficLightDistribution>,
    /// Per-cooperative KPI breakdown
    pub cooperatives: Vec<CoopKpiRow>,
    /// System-wide evaluated Custom KPIs
    pub custom_kpis: HashMap<String, f64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct TrafficLightDistribution {
    pub green_pct: f64,
    pub amber_pct: f64,
    pub red_pct: f64,
    pub no_data_pct: f64,
    pub green_count: u64,
    pub amber_count: u64,
    pub red_count: u64,
    pub no_data_count: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct KpiStatusCount {
    pub green: u64,
    pub amber: u64,
    pub red: u64,
    pub no_data: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct CoopKpiRow {
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub name: String,
    pub apex_id: Option<Uuid>,
    pub apex_name: Option<String>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub institution_type: Option<String>,
    pub has_data: bool,
    pub non_financial: CoopNfSummary,
    /// KPI name → computed value
    pub kpis: HashMap<String, KpiValue>,
    /// Custom KPI name → computed value
    pub custom_kpis: HashMap<String, f64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct NfPortfolioSummary {
    pub cooperatives_with_data: u64,
    pub average_active_members_pct: f64,
    pub average_savings_penetration_pct: f64,
    pub average_credit_penetration_pct: f64,
    pub average_fd_penetration_pct: f64,
    pub average_on_time_repayment_pct: f64,
    pub average_dormancy_pct: f64,
    pub average_agm_participation_pct: f64,
    pub average_arrears_rate_pct: f64,
    pub average_fd_early_withdrawal_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct CoopNfSummary {
    pub has_data: bool,
    pub total_members: u64,
    pub active_members: u64,
    pub active_borrowers: u64,
    pub women_borrowers: u64,
    pub youth_borrowers: u64,
    pub rural_borrowers: u64,
    pub active_members_pct: f64,
    pub savings_penetration_pct: f64,
    pub credit_penetration_pct: f64,
    pub fd_penetration_pct: f64,
    pub on_time_repayment_pct: f64,
    pub dormancy_pct: f64,
    pub agm_participation_pct: f64,
    pub arrears_rate_pct: f64,
    pub fd_early_withdrawal_pct: f64,
}

#[derive(
    Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::IntoParams, utoipa::ToSchema,
)]
pub struct BenchmarkParams {
    pub reporting_year: Option<i32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BenchmarkResponse {
    pub reporting_year: Option<i32>,
    /// The calling cooperative's own KPI row. Structurally cannot contain other cooperatives.
    pub cooperative: CoopKpiRow,
    /// kpi_key -> national average over cooperatives-with-data
    pub national_average: HashMap<String, f64>,
    /// kpi_key -> regional average over cooperatives-with-data in the caller's region.
    /// None when there are too few contributors (see `insufficient_data`).
    pub regional_average: Option<HashMap<String, f64>>,
    /// kpi_key -> sector average over cooperatives-with-data in the caller's sector (nationally).
    /// None when there are too few contributors (see `insufficient_data`).
    pub sector_average: Option<HashMap<String, f64>>,
    /// kpi_key -> sector+regional average over cooperatives-with-data in the caller's
    /// sector within the caller's region. None when there are too few contributors.
    pub sector_regional_average: Option<HashMap<String, f64>>,
    pub insufficient_data: BenchmarkInsufficientData,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BenchmarkInsufficientData {
    /// True when the regional average is withheld because too few cooperatives contribute.
    pub regional: bool,
    /// True when the sector average is withheld because too few cooperatives contribute.
    pub sector: bool,
    /// True when the sector+regional average is withheld because too few cooperatives contribute.
    pub sector_regional: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct ComparativeStatementsParams {
    pub reporting_year: Option<i32>,
    pub cooperative_ids: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct CooperativeLineItem {
    pub account_code: Option<i32>,
    pub account_name: String,
    pub value: f64,
    pub month: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct CooperativeStatementGrid {
    pub cooperative_id: Uuid,
    pub cooperative_name: String,
    pub line_items: Vec<CooperativeLineItem>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct ComparativeStatementsResponse {
    pub year: i32,
    pub grids: Vec<CooperativeStatementGrid>,
}
