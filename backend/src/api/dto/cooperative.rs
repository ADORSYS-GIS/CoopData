use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateCooperativeRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub institution_type: String,
    pub reg_no: String,
    #[serde(default)]
    pub tin: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub georeference: Option<String>,
    pub region: String,
    pub geographic_classif: String,
    #[serde(default)]
    pub phone: Option<String>,
    pub sector: String,
    #[serde(default)]
    pub responsible_financial: Option<Uuid>,
    #[serde(default)]
    pub responsible_non_financial: Option<Uuid>,
    #[serde(default = "default_status")]
    pub status: String,
    pub registered_on: NaiveDate,
    #[serde(default = "default_accounting_year")]
    pub accounting_year: String,
    #[serde(default = "default_tier")]
    pub tier: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateCooperativeRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CooperativeResponse {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub parent_group_id: Option<String>,
    pub description: Option<String>,
    pub institution_type: Option<String>,
    pub region: Option<String>,
}

impl From<crate::models::keycloak::KeycloakGroup> for CooperativeResponse {
    fn from(group: crate::models::keycloak::KeycloakGroup) -> Self {
        let description = group
            .attributes
            .as_ref()
            .and_then(|attrs| attrs.get("description"))
            .and_then(|vals| vals.first())
            .cloned();

        let parent_group_id = group.path.as_ref().and_then(|p| {
            let parts: Vec<&str> = p
                .trim_end_matches(&format!("/{}", group.name))
                .split('/')
                .filter(|s| !s.is_empty())
                .collect();
            parts.last().map(|s| s.to_string())
        });

        Self {
            id: group.id,
            name: group.name,
            path: group.path,
            parent_group_id,
            description,
            institution_type: None,
            region: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateCooperativeProfileRequest {
    pub name: String,
    pub institution_type: String,
    pub reg_no: String,
    #[serde(default)]
    pub tin: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub georeference: Option<String>,
    pub region: String,
    pub geographic_classif: String,
    #[serde(default)]
    pub phone: Option<String>,
    pub sector: String,
    #[serde(default)]
    pub responsible_financial: Option<Uuid>,
    #[serde(default)]
    pub responsible_non_financial: Option<Uuid>,
    #[serde(default = "default_status")]
    pub status: String,
    pub registered_on: NaiveDate,
    #[serde(default = "default_accounting_year")]
    pub accounting_year: String,
    #[serde(default = "default_tier")]
    pub tier: String,
    #[serde(default)]
    pub apex_group_id: Option<Uuid>,
    #[serde(default)]
    pub federation_org_id: Option<Uuid>,
}

fn default_status() -> String {
    "Active".to_string()
}

fn default_accounting_year() -> String {
    "calendar".to_string()
}

fn default_tier() -> String {
    "standard".to_string()
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateCooperativeProfileRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub institution_type: Option<String>,
    #[serde(default)]
    pub reg_no: Option<String>,
    #[serde(default)]
    pub tin: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub georeference: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub geographic_classif: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub sector: Option<String>,
    #[serde(default)]
    pub responsible_financial: Option<Uuid>,
    #[serde(default)]
    pub responsible_non_financial: Option<Uuid>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub registered_on: Option<NaiveDate>,
    #[serde(default)]
    pub accounting_year: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CooperativeProfileResponse {
    pub id: Uuid,
    pub keycloak_id: Option<String>,
    pub apex_id: Option<Uuid>,
    pub keycloak_group_id: Option<Uuid>,
    pub apex_group_id: Option<Uuid>,
    pub federation_org_id: Option<Uuid>,
    pub name: String,
    pub institution_type: Option<String>,
    pub reg_no: Option<String>,
    pub tin: Option<String>,
    pub address: Option<String>,
    pub georeference: Option<String>,
    pub region: Option<String>,
    pub geographic_classif: Option<String>,
    pub phone: Option<String>,
    pub sector: Option<String>,
    pub responsible_financial: Option<Uuid>,
    pub responsible_non_financial: Option<Uuid>,
    pub status: String,
    pub registered_on: Option<NaiveDate>,
    pub accounting_year: String,
    pub tier: String,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

impl From<crate::entities::cooperative::Model> for CooperativeProfileResponse {
    fn from(m: crate::entities::cooperative::Model) -> Self {
        Self {
            id: m.id,
            keycloak_id: Some(m.keycloak_id),
            apex_id: Some(m.apex_id),
            keycloak_group_id: m.keycloak_group_id,
            apex_group_id: m.apex_group_id,
            federation_org_id: m.federation_org_id,
            name: m.name,
            institution_type: m.institution_type.map(|t| t.as_str().to_string()),
            reg_no: m.reg_no,
            tin: m.tin,
            address: m.address,
            georeference: m.georeference,
            region: m.region.map(|r| r.as_str().to_string()),
            geographic_classif: m.geographic_classif.map(|g| g.as_str().to_string()),
            phone: m.phone,
            sector: m.sector.map(|s| s.as_str().to_string()),
            responsible_financial: m.responsible_financial,
            responsible_non_financial: m.responsible_non_financial,
            status: m.status.as_str().to_string(),
            registered_on: m.registered_on,
            accounting_year: m.accounting_year.as_str().to_string(),
            tier: m.tier,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_keycloak_group(
        id: &str,
        name: &str,
        path: Option<&str>,
        attributes: Option<HashMap<String, Vec<String>>>,
        sub_groups: Vec<crate::models::keycloak::KeycloakGroup>,
    ) -> crate::models::keycloak::KeycloakGroup {
        crate::models::keycloak::KeycloakGroup {
            id: id.to_string(),
            name: name.to_string(),
            path: path.map(|s| s.to_string()),
            attributes,
            sub_groups,
        }
    }

    #[test]
    fn test_cooperative_response_from_keycloak_group_basic() {
        let group = make_keycloak_group(
            "coop-1",
            "Test Cooperative",
            Some("/apex-1/Test Cooperative"),
            None,
            vec![],
        );
        let response = CooperativeResponse::from(group);
        assert_eq!(response.id, "coop-1");
        assert_eq!(response.name, "Test Cooperative");
        assert_eq!(response.path, Some("/apex-1/Test Cooperative".to_string()));
        assert!(response.description.is_none());
        assert_eq!(response.parent_group_id, Some("apex-1".to_string()));
    }

    #[test]
    fn test_cooperative_response_extracts_description() {
        let mut attrs = HashMap::new();
        attrs.insert(
            "description".to_string(),
            vec!["A test cooperative".to_string()],
        );
        let group = make_keycloak_group(
            "coop-2",
            "Test Coop",
            Some("/apex-1/coop-2"),
            Some(attrs),
            vec![],
        );
        let response = CooperativeResponse::from(group);
        assert_eq!(response.description, Some("A test cooperative".to_string()));
    }

    #[test]
    fn test_cooperative_response_no_path() {
        let group = make_keycloak_group("coop-3", "No Path Coop", None, None, vec![]);
        let response = CooperativeResponse::from(group);
        assert!(response.path.is_none());
        assert!(response.parent_group_id.is_none());
    }

    #[test]
    fn test_create_cooperative_request_deserialization() {
        let json = r#"{
            "name": "My Coop",
            "description": "A description",
            "institution_type": "sacco",
            "reg_no": "COOP001",
            "region": "Hhohho",
            "geographic_classif": "Urban",
            "sector": "Finance",
            "registered_on": "2020-01-15"
        }"#;
        let req: CreateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "My Coop");
        assert_eq!(req.description, Some("A description".to_string()));
        assert_eq!(req.institution_type, "sacco");
        assert_eq!(req.reg_no, "COOP001");
    }

    #[test]
    fn test_create_cooperative_request_minimal() {
        let json = r#"{
            "name": "My Coop",
            "institution_type": "sacco",
            "reg_no": "COOP001",
            "region": "Hhohho",
            "geographic_classif": "Urban",
            "sector": "Finance",
            "registered_on": "2020-01-15"
        }"#;
        let req: CreateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "My Coop");
        assert!(req.description.is_none());
        assert_eq!(req.status, "Active");
        assert_eq!(req.accounting_year, "calendar");
    }

    #[test]
    fn test_update_cooperative_request_deserialization() {
        let json = r#"{"name": "Updated Coop", "description": "New desc"}"#;
        let req: UpdateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Updated Coop".to_string()));
        assert_eq!(req.description, Some("New desc".to_string()));
    }

    #[test]
    fn test_update_cooperative_request_empty() {
        let json = r#"{}"#;
        let req: UpdateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert!(req.name.is_none());
        assert!(req.description.is_none());
    }

    #[test]
    fn test_create_profile_request_deserialization() {
        let json = r#"{
            "name": "Test Coop",
            "institution_type": "sacco",
            "reg_no": "COOP001",
            "region": "Hhohho",
            "geographic_classif": "Urban",
            "sector": "Finance",
            "registered_on": "2020-01-15"
        }"#;
        let req: CreateCooperativeProfileRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "Test Coop");
        assert_eq!(req.institution_type, "sacco");
        assert_eq!(req.reg_no, "COOP001");
        assert_eq!(req.region, "Hhohho");
        assert_eq!(req.geographic_classif, "Urban");
        assert_eq!(req.sector, "Finance");
        assert_eq!(req.status, "Active");
        assert_eq!(req.accounting_year, "calendar");
    }

    #[test]
    fn test_update_profile_request_empty() {
        let json = r#"{}"#;
        let req: UpdateCooperativeProfileRequest = serde_json::from_str(json).unwrap();
        assert!(req.name.is_none());
        assert!(req.reg_no.is_none());
    }
}
