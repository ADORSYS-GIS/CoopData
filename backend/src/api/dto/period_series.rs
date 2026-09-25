use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::api::dto::common::RateUsed;

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct PeriodSeriesParams {
    pub reporting_year: Option<i32>,
    /// YEARLY, SEMI_ANNUAL, QUARTERLY or MONTHLY. Defaults to YEARLY.
    pub period_type: Option<String>,
    /// Last period of the series. Omit or use "all" for the year's latest.
    pub period_value: Option<String>,
    /// Number of periods to return, 1 to 12. Defaults to 8.
    pub limit: Option<usize>,
    pub cooperative_id: Option<Uuid>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PeriodSeriesPoint {
    pub period_label: String,
    pub reporting_year: i32,
    pub period_type: String,
    pub period_value: String,
    pub cooperatives_reporting: i64,
    /// USD, from the approved financial statements.
    pub assets: f64,
    pub loans: f64,
    pub liquid_assets: f64,
    pub savings: f64,
    pub liabilities: f64,
    pub equity: f64,
    pub total_income: f64,
    pub total_expenses: f64,
    pub net_income: f64,
    pub arrears_1_30: f64,
    pub arrears_31_60: f64,
    pub arrears_61_90: f64,
    pub non_performing: f64,
    pub provisions: f64,
    pub borrowings: f64,
    pub share_capital: f64,
    pub reserves: f64,
    pub statutory_reserve: f64,
    pub retained_earnings: f64,
    pub financial_income: f64,
    pub other_income: f64,
    pub financial_expenses: f64,
    pub operating_expenses: f64,
    pub credit_loss_expense: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PeriodSeriesResponse {
    pub period_type: String,
    pub points: Vec<PeriodSeriesPoint>,
    pub rates_used: Vec<RateUsed>,
}
