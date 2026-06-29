use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateUserRequest {
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
    pub organization_id: Option<Uuid>,
    pub region: Option<String>,
    pub temporary_password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateUserRequest {
    pub full_name: Option<String>,
    pub role: Option<String>,
    pub organization_id: Option<Uuid>,
    pub region: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AssignRoleRequest {
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserResponse {
    pub id: Uuid,
    pub keycloak_id: String,
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
    pub organization_id: Option<Uuid>,
    pub region: Option<String>,
    pub is_active: bool,
    pub last_login_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::entities::user::Model> for UserResponse {
    fn from(m: crate::entities::user::Model) -> Self {
        Self {
            id: m.id,
            keycloak_id: m.keycloak_id,
            email: m.email,
            full_name: m.full_name,
            role: m.role,
            organization_id: m.organization_id,
            region: m.region,
            is_active: m.is_active,
            last_login_at: m.last_login_at.map(|dt| dt.to_rfc3339()),
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}
