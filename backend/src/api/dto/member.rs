use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AddMemberRequest {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    #[serde(default)]
    pub assigned_dimensions: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MemberResponse {
    pub id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

impl From<crate::models::keycloak::KeycloakMember> for MemberResponse {
    fn from(m: crate::models::keycloak::KeycloakMember) -> Self {
        Self {
            id: m.id,
            username: m.username,
            email: m.email,
            first_name: m.first_name,
            last_name: m.last_name,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserProfileResponse {
    pub sub: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub roles: Vec<String>,
    pub organization_id: Option<String>,
    pub organization_name: Option<String>,
    pub cooperation_paths: Vec<String>,
    pub assigned_dimensions: Vec<String>,
}