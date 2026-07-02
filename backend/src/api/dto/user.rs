use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateUserRequest {
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
    pub organization_id: Option<Uuid>,
    #[serde(default)]
    pub group_id: Option<String>,
    pub region: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateUserPasswordRequest {
    pub current_password: String,
    pub new_password: String,
    pub confirm_password: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_user_request_deserialization_full() {
        let json = r#"{
            "email": "test@example.com",
            "full_name": "Test User",
            "role": "cooperative",
            "organization_id": "550e8400-e29b-41d4-a716-446655440000",
            "group_id": "group-123",
            "region": "Hhohho"
        }"#;
        let req: CreateUserRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.email, "test@example.com");
        assert_eq!(req.full_name, Some("Test User".to_string()));
        assert_eq!(req.role, "cooperative");
        assert!(req.organization_id.is_some());
        assert_eq!(req.group_id, Some("group-123".to_string()));
        assert_eq!(req.region, Some("Hhohho".to_string()));
    }

    #[test]
    fn test_create_user_request_deserialization_minimal() {
        let json = r#"{"email": "test@example.com", "role": "ministry"}"#;
        let req: CreateUserRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.email, "test@example.com");
        assert_eq!(req.role, "ministry");
        assert!(req.full_name.is_none());
        assert!(req.organization_id.is_none());
        assert!(req.group_id.is_none());
        assert!(req.region.is_none());
    }

    #[test]
    fn test_update_user_request_deserialization() {
        let json = r#"{"full_name": "Updated Name", "role": "apex"}"#;
        let req: UpdateUserRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.full_name, Some("Updated Name".to_string()));
        assert_eq!(req.role, Some("apex".to_string()));
        assert!(req.organization_id.is_none());
        assert!(req.region.is_none());
        assert!(req.is_active.is_none());
    }

    #[test]
    fn test_update_user_request_empty() {
        let json = r#"{}"#;
        let req: UpdateUserRequest = serde_json::from_str(json).unwrap();
        assert!(req.full_name.is_none());
        assert!(req.role.is_none());
        assert!(req.organization_id.is_none());
        assert!(req.region.is_none());
        assert!(req.is_active.is_none());
    }

    #[test]
    fn test_assign_role_request_deserialization() {
        let json = r#"{"role": "federation"}"#;
        let req: AssignRoleRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.role, "federation");
    }

    #[test]
    fn test_user_response_serialization() {
        let response = UserResponse {
            id: uuid::Uuid::new_v4(),
            keycloak_id: "kc-123".to_string(),
            email: "test@example.com".to_string(),
            full_name: Some("Test User".to_string()),
            role: "cooperative".to_string(),
            organization_id: None,
            region: Some("Hhohho".to_string()),
            is_active: true,
            last_login_at: None,
            created_at: "2024-01-01T00:00:00+00:00".to_string(),
            updated_at: "2024-01-01T00:00:00+00:00".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("test@example.com"));
        assert!(json.contains("cooperative"));
        assert!(json.contains("Test User"));
    }

    #[test]
    fn test_update_user_password_request_deserialization() {
        let json = r#"{"current_password": "old123", "new_password": "new456", "confirm_password": "new456"}"#;
        let req: UpdateUserPasswordRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.current_password, "old123");
        assert_eq!(req.new_password, "new456");
        assert_eq!(req.confirm_password, "new456");
    }
}
