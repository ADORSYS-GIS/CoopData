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
