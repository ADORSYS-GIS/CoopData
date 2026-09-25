use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, IntoParams, ToSchema)]
pub struct BasicDashboardParams {
    pub reporting_year: Option<i32>,
    /// YEARLY | SEMI_ANNUAL | QUARTERLY | MONTHLY
    pub period_type: Option<String>,
    /// e.g. "Q1", "H2", "2026", "03"
    pub period_value: Option<String>,
    pub region: Option<String>,
    pub sector: Option<String>,
    /// Restrict to one cooperative (individual view).
    pub cooperative_id: Option<Uuid>,
    /// `usd` (default, converted with the submission's rate) or `native` (as entered).
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PeriodOption {
    pub reporting_year: i32,
    pub period_type: String,
    pub period_value: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DashboardScope {
    /// "individual" (one cooperative) or "consolidated" (several).
    pub level: String,
    pub cooperatives_reporting: u32,
    pub cooperatives_in_scope: u32,
    pub reporting_year: Option<i32>,
    pub period_type: Option<String>,
    pub period_value: Option<String>,
    pub period_label: String,
    /// Currency of every monetary value in the response ("USD" or "SZL").
    pub currency: String,
    pub native_currency: String,
    /// Units of native currency per 1 USD when converted, else null.
    pub rate_to_usd: Option<f64>,
    pub available_periods: Vec<PeriodOption>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DashboardThresholds {
    pub liquidity_minimum_pct: f64,
    pub institutional_capital_minimum_pct: f64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct IndicatorValue {
    pub key: String,
    /// membership | savings | loans | risk | liquidity | structure | capital | profitability | governance
    pub group: String,
    pub value: Option<f64>,
    /// count | currency | percent | ratio
    pub unit: String,
    /// computed | approximate | not_reported
    pub status: String,
    pub previous: Option<f64>,
    pub change_pct: Option<f64>,
    /// Human-readable formula used for the value.
    pub formula: String,
    /// Questionnaire field keys the value is derived from.
    pub sources: Vec<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SeriesPoint {
    pub period_label: String,
    pub reporting_year: i32,
    pub period_type: String,
    pub period_value: String,
    /// series-specific named values (see `series` docs on the response)
    pub values: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ShareRow {
    pub cooperative_id: Uuid,
    pub name: String,
    pub value: f64,
    pub share_pct: f64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MarketShare {
    pub by_assets: Vec<ShareRow>,
    pub by_loans: Vec<ShareRow>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct GenderCount {
    pub male: f64,
    pub female: f64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AgeBands {
    pub age_18_25: f64,
    pub age_26_35: f64,
    pub age_36_60: f64,
    pub age_61_plus: f64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Demographics {
    pub registered: GenderCount,
    pub active: GenderCount,
    pub age: AgeBands,
    pub board: GenderCount,
    pub executive: GenderCount,
    pub credit_committee: GenderCount,
    pub savings_accounts: GenderCount,
    pub loan_accounts: GenderCount,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CooperativeRow {
    pub cooperative_id: Uuid,
    pub name: String,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub total_members: f64,
    pub total_assets: Option<f64>,
    pub total_deposits: Option<f64>,
    pub gross_loans: Option<f64>,
    pub par_gt_30_pct: Option<f64>,
    pub liquidity_ratio_pct: Option<f64>,
    pub institutional_capital_ratio_pct: Option<f64>,
    pub net_income: Option<f64>,
}

/// Response of `GET /api/v1/analytics/basic-dashboard`.
///
/// `series` keys (each a chronological list of points, `values` keys in brackets):
/// - `asset_evolution` (total_assets)
/// - `savings_trend` (total_deposits)
/// - `loan_portfolio` (gross_loans)
/// - `par_trend` (par_gt_30_pct, par_gt_90_pct, portfolio_at_risk_pct)
/// - `liquidity` (maintained_pct, minimum_pct, gap_pct)
/// - `financial_structure` (earning_asset_ratio, member_savings_ratio, member_share_ratio, borrowed_funds_ratio)
/// - `profitability` (net_income)
/// - `institutional_capital` (ratio_pct, minimum_pct, excess_pct)
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BasicDashboardResponse {
    pub scope: DashboardScope,
    pub thresholds: DashboardThresholds,
    pub indicators: Vec<IndicatorValue>,
    pub series: HashMap<String, Vec<SeriesPoint>>,
    /// Administrators only; `None` for cooperative callers.
    pub market_share: Option<MarketShare>,
    pub demographics: Demographics,
    /// Administrators only; per-cooperative rows for the ranking table.
    pub cooperatives: Vec<CooperativeRow>,
}
