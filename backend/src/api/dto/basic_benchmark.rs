use std::collections::HashMap;
use uuid::Uuid;

#[derive(
    Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::IntoParams, utoipa::ToSchema,
)]
pub struct BasicBenchmarkParams {
    pub reporting_year: Option<i32>,
}

/// One questionnaire cooperative's row, used only for benchmarking.
/// The metric keys mirror the questionnaire `answers` JSON fields extracted by
/// `get_questionnaire_analytics` (members, savings, loans, income, …).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BasicBenchmarkRow {
    pub cooperative_id: Uuid,
    pub name: String,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub has_data: bool,
    /// questionnaire metric key → value
    pub metrics: HashMap<String, f64>,
}

/// Privacy-safe benchmark comparison for questionnaire (basic-tier) cooperatives.
/// For cooperative callers the response is structurally incapable of containing
/// other cooperatives' rows: only the caller's own row plus server-computed
/// averages cross the wire. Admin callers (ministry/federation/apex) receive the
/// full population rows because they are authorized to see them.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BasicBenchmarkResponse {
    pub reporting_year: Option<i32>,
    /// The calling cooperative's own questionnaire row (coop callers only).
    /// `None` for admin callers, or when the caller has no questionnaire data.
    pub cooperative: Option<BasicBenchmarkRow>,
    /// All questionnaire cooperatives in the caller's scope (admin callers only).
    /// Always empty for cooperative callers — structural privacy guarantee.
    pub rows: Vec<BasicBenchmarkRow>,
    /// Maps each metric key to the national average over cooperatives-with-data.
    /// None when there are too few contributors (see `insufficient_data`).
    pub national_average: Option<HashMap<String, f64>>,
    /// Maps each metric key to the regional average in the caller's region.
    /// None when there are too few contributors (see `insufficient_data`).
    pub regional_average: Option<HashMap<String, f64>>,
    /// Maps each metric key to the sector average in the caller's sector (nationally).
    /// None when there are too few contributors (see `insufficient_data`).
    pub sector_average: Option<HashMap<String, f64>>,
    /// Maps each metric key to the sector+regional average in the caller's
    /// sector within the caller's region. None when there are too few contributors.
    pub sector_regional_average: Option<HashMap<String, f64>>,
    pub insufficient_data: BasicBenchmarkInsufficientData,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BasicBenchmarkInsufficientData {
    /// True when the national average is withheld because too few cooperatives contribute.
    pub national: bool,
    /// True when the regional average is withheld because too few cooperatives contribute.
    pub regional: bool,
    /// True when the sector average is withheld because too few cooperatives contribute.
    pub sector: bool,
    /// True when the sector+regional average is withheld because too few cooperatives contribute.
    pub sector_regional: bool,
}
