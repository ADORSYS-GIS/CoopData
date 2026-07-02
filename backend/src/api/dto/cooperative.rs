use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateCooperativeRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
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
        // parent_group_id is extracted from the path by removing "/{group_name}" suffix
        // and taking the last segment, which is "apex-1"
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
        let json = r#"{"name": "My Coop", "description": "A description"}"#;
        let req: CreateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "My Coop");
        assert_eq!(req.description, Some("A description".to_string()));
    }

    #[test]
    fn test_create_cooperative_request_minimal() {
        let json = r#"{"name": "My Coop"}"#;
        let req: CreateCooperativeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "My Coop");
        assert!(req.description.is_none());
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
}
