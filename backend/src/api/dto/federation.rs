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
    pub region: Option<String>,
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
    pub region: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DomainResponse {
    pub name: String,
    pub verified: bool,
}

impl From<crate::models::keycloak::KeycloakOrganization> for FederationResponse {
    fn from(org: crate::models::keycloak::KeycloakOrganization) -> Self {
        let attrs = org.attributes.as_ref();

        // Prefer the human-readable display_name stored in attributes,
        // fall back to the slug name Keycloak stores internally
        let display_name = attrs
            .and_then(|a| a.get("display_name"))
            .and_then(|v| v.first())
            .cloned()
            .unwrap_or_else(|| org.name.clone());

        let description = attrs
            .and_then(|a| a.get("description"))
            .and_then(|v| v.first())
            .cloned()
            .or(org.description);

        let region = attrs
            .and_then(|a| a.get("region"))
            .and_then(|v| v.first())
            .cloned();

        let created_at = attrs
            .and_then(|a| a.get("created_at"))
            .and_then(|v| v.first())
            .cloned();

        Self {
            id: org.id,
            name: display_name,
            enabled: org.enabled,
            description,
            domains: org
                .domains
                .into_iter()
                .map(|d| DomainResponse {
                    name: d.name,
                    verified: d.verified,
                })
                .collect(),
            region,
            created_at,
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
