use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApexRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateApexRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ApexResponse {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub sub_groups: Vec<CooperativeBriefResponse>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CooperativeBriefResponse {
    pub id: String,
    pub name: String,
}

impl From<crate::models::keycloak::KeycloakGroup> for ApexResponse {
    fn from(group: crate::models::keycloak::KeycloakGroup) -> Self {
        let description = group
            .attributes
            .as_ref()
            .and_then(|attrs| attrs.get("description"))
            .and_then(|vals| vals.first())
            .cloned();

        Self {
            id: group.id,
            name: group.name,
            path: group.path,
            description,
            sub_groups: group
                .sub_groups
                .into_iter()
                .map(|sg| CooperativeBriefResponse {
                    id: sg.id,
                    name: sg.name,
                })
                .collect(),
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
    fn test_apex_response_from_group_basic() {
        let group = make_keycloak_group("apex-1", "Test Apex", Some("/apex-1"), None, vec![]);
        let response = ApexResponse::from(group);
        assert_eq!(response.id, "apex-1");
        assert_eq!(response.name, "Test Apex");
        assert_eq!(response.path, Some("/apex-1".to_string()));
        assert!(response.description.is_none());
        assert!(response.sub_groups.is_empty());
    }

    #[test]
    fn test_apex_response_extracts_description() {
        let mut attrs = HashMap::new();
        attrs.insert("description".to_string(), vec!["An apex org".to_string()]);
        let group =
            make_keycloak_group("apex-2", "Test Apex", Some("/apex-2"), Some(attrs), vec![]);
        let response = ApexResponse::from(group);
        assert_eq!(response.description, Some("An apex org".to_string()));
    }

    #[test]
    fn test_apex_response_maps_sub_groups() {
        let sub_groups = vec![
            make_keycloak_group(
                "coop-1",
                "Cooperative 1",
                Some("/apex-1/coop-1"),
                None,
                vec![],
            ),
            make_keycloak_group(
                "coop-2",
                "Cooperative 2",
                Some("/apex-1/coop-2"),
                None,
                vec![],
            ),
        ];
        let group = make_keycloak_group("apex-1", "Test Apex", Some("/apex-1"), None, sub_groups);
        let response = ApexResponse::from(group);
        assert_eq!(response.sub_groups.len(), 2);
        assert_eq!(response.sub_groups[0].id, "coop-1");
        assert_eq!(response.sub_groups[0].name, "Cooperative 1");
        assert_eq!(response.sub_groups[1].id, "coop-2");
        assert_eq!(response.sub_groups[1].name, "Cooperative 2");
    }

    #[test]
    fn test_create_apex_request_deserialization() {
        let json = r#"{"name": "New Apex", "description": "A test apex"}"#;
        let req: CreateApexRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "New Apex");
        assert_eq!(req.description, Some("A test apex".to_string()));
    }

    #[test]
    fn test_create_apex_request_minimal() {
        let json = r#"{"name": "New Apex"}"#;
        let req: CreateApexRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "New Apex");
        assert!(req.description.is_none());
    }

    #[test]
    fn test_update_apex_request_deserialization() {
        let json = r#"{"name": "Updated Apex"}"#;
        let req: UpdateApexRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Updated Apex".to_string()));
        assert!(req.description.is_none());
    }

    #[test]
    fn test_update_apex_request_empty() {
        let json = r#"{}"#;
        let req: UpdateApexRequest = serde_json::from_str(json).unwrap();
        assert!(req.name.is_none());
        assert!(req.description.is_none());
    }
}
