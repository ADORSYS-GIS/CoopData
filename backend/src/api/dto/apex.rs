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
