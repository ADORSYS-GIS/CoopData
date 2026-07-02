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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_organization_request_deserialization_full() {
        let json = r#"{
            "name": "Test Org",
            "organization_type": "federation",
            "registration_number": "REG-123",
            "sector": "Agriculture",
            "region": "Hhohho",
            "contact_email": "org@example.com",
            "contact_phone": "+26812345678",
            "address": "123 Main St"
        }"#;
        let req: CreateOrganizationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "Test Org");
        assert_eq!(req.organization_type, "federation");
        assert_eq!(req.registration_number, Some("REG-123".to_string()));
        assert_eq!(req.sector, Some("Agriculture".to_string()));
        assert_eq!(req.region, Some("Hhohho".to_string()));
        assert_eq!(req.contact_email, Some("org@example.com".to_string()));
    }

    #[test]
    fn test_create_organization_request_default_type() {
        let json = r#"{"name": "Test Org"}"#;
        let req: CreateOrganizationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "Test Org");
        assert_eq!(req.organization_type, "cooperative"); // default
    }

    #[test]
    fn test_update_organization_request_deserialization() {
        let json = r#"{"name": "Updated Org", "is_active": false}"#;
        let req: UpdateOrganizationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Updated Org".to_string()));
        assert_eq!(req.is_active, Some(false));
        assert!(req.organization_type.is_none());
    }

    #[test]
    fn test_update_organization_request_empty() {
        let json = r#"{}"#;
        let req: UpdateOrganizationRequest = serde_json::from_str(json).unwrap();
        assert!(req.name.is_none());
        assert!(req.organization_type.is_none());
        assert!(req.is_active.is_none());
    }
}
