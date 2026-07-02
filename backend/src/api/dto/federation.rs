use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateFederationRequest {
    pub name: String,
    #[serde(default)]
    pub domains: Vec<DomainRequest>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DomainRequest {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateFederationRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub domains: Option<Vec<DomainRequest>>,
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FederationResponse {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub description: Option<String>,
    pub domains: Vec<DomainResponse>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DomainResponse {
    pub name: String,
    pub verified: bool,
}

impl From<crate::models::keycloak::KeycloakOrganization> for FederationResponse {
    fn from(org: crate::models::keycloak::KeycloakOrganization) -> Self {
        let description = org
            .attributes
            .as_ref()
            .and_then(|attrs| attrs.get("description"))
            .and_then(|vals| vals.first())
            .cloned();

        Self {
            id: org.id,
            name: org.name,
            enabled: org.enabled,
            description: description.or(org.description),
            domains: org
                .domains
                .into_iter()
                .map(|d| DomainResponse {
                    name: d.name,
                    verified: d.verified,
                })
                .collect(),
        }
    }
}

impl From<crate::models::keycloak::KeycloakOrganizationDomain> for DomainResponse {
    fn from(d: crate::models::keycloak::KeycloakOrganizationDomain) -> Self {
        Self {
            name: d.name,
            verified: d.verified,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FederationStatsResponse {
    pub total_apexes: u64,
    pub total_members: u64,
    pub federation: FederationResponse,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_keycloak_org(
        id: &str,
        name: &str,
        enabled: bool,
        description: Option<String>,
        domains: Vec<crate::models::keycloak::KeycloakOrganizationDomain>,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> crate::models::keycloak::KeycloakOrganization {
        crate::models::keycloak::KeycloakOrganization {
            id: id.to_string(),
            name: name.to_string(),
            enabled,
            description,
            domains,
            attributes,
        }
    }

    #[test]
    fn test_federation_response_from_org_basic() {
        let org = make_keycloak_org("fed-1", "Test Federation", true, None, vec![], None);
        let response = FederationResponse::from(org);
        assert_eq!(response.id, "fed-1");
        assert_eq!(response.name, "Test Federation");
        assert!(response.enabled);
        assert!(response.description.is_none());
        assert!(response.domains.is_empty());
    }

    #[test]
    fn test_federation_response_extracts_description_from_attributes() {
        let mut attrs = HashMap::new();
        attrs.insert("description".to_string(), vec!["A federation".to_string()]);
        let org = make_keycloak_org("fed-2", "Test Fed", true, None, vec![], Some(attrs));
        let response = FederationResponse::from(org);
        assert_eq!(response.description, Some("A federation".to_string()));
    }

    #[test]
    fn test_federation_response_uses_org_description_when_no_attr() {
        let org = make_keycloak_org(
            "fed-3",
            "Test Fed",
            true,
            Some("Org description".to_string()),
            vec![],
            None,
        );
        let response = FederationResponse::from(org);
        assert_eq!(response.description, Some("Org description".to_string()));
    }

    #[test]
    fn test_federation_response_maps_domains() {
        let org = make_keycloak_org(
            "fed-4",
            "Test Fed",
            true,
            None,
            vec![
                crate::models::keycloak::KeycloakOrganizationDomain {
                    name: "example.com".to_string(),
                    verified: true,
                },
                crate::models::keycloak::KeycloakOrganizationDomain {
                    name: "test.org".to_string(),
                    verified: false,
                },
            ],
            None,
        );
        let response = FederationResponse::from(org);
        assert_eq!(response.domains.len(), 2);
        assert_eq!(response.domains[0].name, "example.com");
        assert!(response.domains[0].verified);
        assert_eq!(response.domains[1].name, "test.org");
        assert!(!response.domains[1].verified);
    }

    #[test]
    fn test_create_federation_request_deserialization() {
        let json = r#"{"name": "New Federation", "description": "A test federation"}"#;
        let req: CreateFederationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "New Federation");
        assert_eq!(req.description, Some("A test federation".to_string()));
        assert!(req.domains.is_empty());
    }

    #[test]
    fn test_create_federation_request_with_domains() {
        let json = r#"{"name": "Fed", "domains": [{"name": "example.com"}]}"#;
        let req: CreateFederationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.domains.len(), 1);
        assert_eq!(req.domains[0].name, "example.com");
    }

    #[test]
    fn test_update_federation_request_deserialization() {
        let json = r#"{"name": "Updated Fed"}"#;
        let req: UpdateFederationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Updated Fed".to_string()));
        assert!(req.description.is_none());
    }

    #[test]
    fn test_domain_response_from_keycloak_domain() {
        let domain = crate::models::keycloak::KeycloakOrganizationDomain {
            name: "test.com".to_string(),
            verified: true,
        };
        let response = DomainResponse::from(domain);
        assert_eq!(response.name, "test.com");
        assert!(response.verified);
    }
}
