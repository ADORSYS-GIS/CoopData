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
