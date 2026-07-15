use std::collections::HashMap;
use uuid::Uuid;

use crate::services::kpi_engine::KpiValue;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct NationalOverviewResponse {
    pub total_cooperatives: u64,
    pub cooperatives_with_data: u64,
    /// KPI name → traffic light distribution
    pub distributions: HashMap<String, TrafficLightDistribution>,
    /// Per-cooperative KPI breakdown
    pub cooperatives: Vec<CoopKpiRow>,
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
    pub name: String,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub institution_type: Option<String>,
    pub has_data: bool,
    /// KPI name → computed value
    pub kpis: HashMap<String, KpiValue>,
}
