use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateOrganizationRequest {
    pub name: String,
    #[serde(default = "default_org_type")]
    pub organization_type: String,
    pub registration_number: Option<String>,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub federation_id: Option<Uuid>,
}

fn default_org_type() -> String {
    "cooperative".to_string()
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateOrganizationRequest {
    pub name: Option<String>,
    pub organization_type: Option<String>,
    pub registration_number: Option<String>,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub federation_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub organization_type: String,
    pub registration_number: Option<String>,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub federation_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::entities::organization::Model> for OrganizationResponse {
    fn from(m: crate::entities::organization::Model) -> Self {
        Self {
            id: m.id,
            name: m.name,
            organization_type: m.organization_type,
            registration_number: m.registration_number,
            sector: m.sector,
            region: m.region,
            contact_email: m.contact_email,
            contact_phone: m.contact_phone,
            address: m.address,
            federation_id: m.federation_id,
            is_active: m.is_active,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}
