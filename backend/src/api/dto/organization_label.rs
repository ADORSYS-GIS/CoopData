use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateOrganizationLabelRequest {
    pub label: String,
    pub short_label: String,
    pub plural_label: String,
    pub description: Option<String>,
    pub icon: String,
    pub translations: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct OrganizationLabelResponse {
    pub key: String,
    pub label: String,
    pub short_label: String,
    pub plural_label: String,
    pub description: Option<String>,
    pub icon: String,
    pub translations: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::entities::organization_label::Model> for OrganizationLabelResponse {
    fn from(m: crate::entities::organization_label::Model) -> Self {
        Self {
            key: m.key,
            label: m.label,
            short_label: m.short_label,
            plural_label: m.plural_label,
            description: m.description,
            icon: m.icon,
            translations: m.translations,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}
