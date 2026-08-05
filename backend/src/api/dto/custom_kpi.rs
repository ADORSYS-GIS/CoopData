use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CustomKpiDto {
    pub id: Uuid,
    /// Canonical, stable identifier used as the key for computed KPI values and in formulas.
    pub name: String,
    /// Human-facing label resolved into the requested language (falls back to name).
    pub display_name: String,
    pub description: Option<String>,
    pub formula: String,
    pub translations: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
}

impl CustomKpiDto {
    fn make(model: crate::entities::custom_kpi::Model, lang: Option<String>) -> Self {
        let translations = if model.translations.is_null() {
            serde_json::json!({})
        } else {
            model.translations.clone()
        };
        let display_name = crate::services::localization::resolve_label(
            &model.name,
            &translations,
            "display_name",
            &lang,
        );
        let description = model.description.as_deref().map(|d| {
            crate::services::localization::resolve_opt_str(
                Some(d),
                &translations,
                "description",
                &lang,
            )
            .unwrap_or_else(|| d.to_string())
        });
        Self {
            id: model.id,
            name: model.name,
            display_name,
            description,
            formula: model.formula,
            translations,
            created_at: model.created_at,
        }
    }

    /// Build a DTO resolved into a requested language.
    pub fn from_model_resolved(
        model: crate::entities::custom_kpi::Model,
        lang: Option<String>,
    ) -> Self {
        Self::make(model, lang)
    }
}

impl From<crate::entities::custom_kpi::Model> for CustomKpiDto {
    fn from(model: crate::entities::custom_kpi::Model) -> Self {
        Self::make(model, None)
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CreateCustomKpiRequest {
    pub name: String,
    pub description: Option<String>,
    pub formula: String,
    #[serde(default)]
    pub translations: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct UpdateCustomKpiRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub formula: Option<String>,
    #[serde(default)]
    pub translations: Option<serde_json::Value>,
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
