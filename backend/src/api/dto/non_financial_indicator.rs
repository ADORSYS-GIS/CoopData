use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::enums::IndicatorDataType;
use crate::entities::non_financial_indicator_catalog::Model as CatalogModel;
use crate::entities::non_financial_indicator_entry::Model as EntryModel;
use crate::repositories::non_financial_indicator_entry::ConsolidationMetrics;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateIndicatorRequest {
    pub indicator_name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub data_type: IndicatorDataType,
    pub coop_type: Option<String>,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub translations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateIndicatorRequest {
    pub display_name: String,
    pub description: Option<String>,
    pub data_type: IndicatorDataType,
    pub coop_type: Option<String>,
    pub is_required: bool,
    #[serde(default)]
    pub translations: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct IndicatorCatalogResponse {
    pub id: Uuid,
    pub indicator_name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub data_type: IndicatorDataType,
    pub coop_type: Option<String>,
    pub is_required: bool,
    pub translations: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl IndicatorCatalogResponse {
    fn make(m: CatalogModel, lang: Option<String>) -> Self {
        let translations = if m.translations.is_null() {
            serde_json::json!({})
        } else {
            m.translations.clone()
        };
        let display_name = crate::services::localization::resolve_label(
            &m.display_name,
            &translations,
            "display_name",
            &lang,
        );
        let description = m.description.as_deref().map(|d| {
            crate::services::localization::resolve_opt_str(
                Some(d),
                &translations,
                "description",
                &lang,
            )
            .unwrap_or_else(|| d.to_string())
        });
        let coop_type = m.coop_type.as_deref().map(|c| {
            crate::services::localization::resolve_str(c, &translations, "coop_type", &lang)
        });
        Self {
            id: m.id,
            indicator_name: m.indicator_name,
            display_name,
            description,
            data_type: m.data_type,
            coop_type,
            is_required: m.is_required,
            translations,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

impl From<CatalogModel> for IndicatorCatalogResponse {
    fn from(m: CatalogModel) -> Self {
        Self::make(m, None)
    }
}

impl IndicatorCatalogResponse {
    /// Build a response resolved into a requested language.
    pub fn from_model_resolved(m: CatalogModel, lang: Option<String>) -> Self {
        Self::make(m, lang)
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SaveIndicatorEntry {
    pub catalog_id: Uuid,
    pub value_numeric: Option<f64>,
    pub value_text: Option<String>,
    pub value_boolean: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SaveEntriesRequest {
    pub entries: Vec<SaveIndicatorEntry>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct IndicatorEntryResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub catalog_id: Uuid,
    pub value_numeric: Option<f64>,
    pub value_text: Option<String>,
    pub value_boolean: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<EntryModel> for IndicatorEntryResponse {
    fn from(m: EntryModel) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            catalog_id: m.catalog_id,
            value_numeric: m.value_numeric.map(|d| {
                use rust_decimal::prelude::ToPrimitive;
                d.to_f64().unwrap_or(0.0)
            }),
            value_text: m.value_text,
            value_boolean: m.value_boolean,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConsolidationRegionRowResponse {
    pub region: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConsolidationCoopTypeRowResponse {
    pub coop_type: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConsolidationResponse {
    pub indicator_name: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
    pub by_region: Vec<ConsolidationRegionRowResponse>,
    pub by_coop_type: Vec<ConsolidationCoopTypeRowResponse>,
}

impl From<ConsolidationMetrics> for ConsolidationResponse {
    fn from(m: ConsolidationMetrics) -> Self {
        Self {
            indicator_name: m.indicator_name,
            total_sum: m.total_sum,
            average: m.average,
            count: m.count,
            by_region: m
                .by_region
                .into_iter()
                .map(|r| ConsolidationRegionRowResponse {
                    region: r.region,
                    total_sum: r.total_sum,
                    average: r.average,
                    count: r.count,
                })
                .collect(),
            by_coop_type: m
                .by_coop_type
                .into_iter()
                .map(|t| ConsolidationCoopTypeRowResponse {
                    coop_type: t.coop_type,
                    total_sum: t.total_sum,
                    average: t.average,
                    count: t.count,
                })
                .collect(),
        }
    }
}
