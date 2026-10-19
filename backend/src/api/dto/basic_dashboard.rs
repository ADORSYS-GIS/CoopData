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
    /// Restrict to the cooperatives of one federation.
    pub federation_id: Option<Uuid>,
    /// Restrict to the cooperatives of one apex.
    pub apex_id: Option<Uuid>,
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
    /// Currency of every monetary value in the response. Always the
    /// cooperative's own reporting currency ("SZL") — nothing is converted.
    pub currency: String,
    pub native_currency: String,
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
    /// membership | savings | risk | capital | profitability | governance | training | coa
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

/// Money totals and loan quality from the questionnaire answers, so questionnaire
/// cooperatives get the same balance boxes and charts as statement-based ones.
/// `None` when the questions behind a figure were not answered.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct Balances {
    pub total_assets: Option<f64>,
    pub gross_loans: Option<f64>,
    pub member_deposits: Option<f64>,
    pub net_surplus: Option<f64>,
    /// Loans overdue more than 30 days, as a share of outstanding loans.
    pub par_30_pct: Option<f64>,
    /// Institutional capital as a share of total assets.
    pub capital_ratio_pct: Option<f64>,
    /// Outstanding loans overdue more than 30 and more than 90 days (amounts).
    pub overdue_gt_30: Option<f64>,
    pub overdue_gt_90: Option<f64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CooperativeRow {
    pub cooperative_id: Uuid,
    pub name: String,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub total_members: f64,
    pub active_members_pct: Option<f64>,
    pub women_members_pct: Option<f64>,
    pub par_gt_30_pct: Option<f64>,
    pub total_operating_margin_pct: Option<f64>,
    pub monetary_reserve_coverage_pct: Option<f64>,
}

/// Response of `GET /api/v1/analytics/basic-dashboard`.
///
/// `series` has one key per indicator group (membership, savings, risk,
/// capital, profitability, governance, training, coa); each is a chronological
/// list of points whose `values` map indicator keys to their value.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BasicDashboardResponse {
    pub scope: DashboardScope,
    pub thresholds: DashboardThresholds,
    pub indicators: Vec<IndicatorValue>,
    pub series: HashMap<String, Vec<SeriesPoint>>,
    pub demographics: Demographics,
    pub balances: Balances,
    /// Administrators only; per-cooperative rows for the ranking table.
    pub cooperatives: Vec<CooperativeRow>,
}
