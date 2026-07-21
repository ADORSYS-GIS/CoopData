use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CustomKpiDto {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub formula: String,
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
}

impl From<crate::entities::custom_kpi::Model> for CustomKpiDto {
    fn from(model: crate::entities::custom_kpi::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            description: model.description,
            formula: model.formula,
            created_at: model.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CreateCustomKpiRequest {
    pub name: String,
    pub description: Option<String>,
    pub formula: String,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct EvaluateKpiRequest {
    pub formula: String,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct EvaluateKpiResponse {
    pub value: f64,
    pub is_valid: bool,
    pub error: Option<String>,
}
