use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
    #[serde(default)]
    pub logout_sessions: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ChangePasswordResponse {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SecuritySettingsResponse {
    /// True when the user has an OTP (TOTP) credential configured in Keycloak,
    /// or a CONFIGURE_TOTP required action is pending (setup initiated but not
    /// yet completed at next sign-in).
    pub mfa_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DisableMfaRequest {
    pub password: String,
    pub otp: String,
}

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
pub struct UpdateMemberRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MemberResponse {
    pub id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub status: String,
}

impl From<crate::models::keycloak::KeycloakMember> for MemberResponse {
    fn from(m: crate::models::keycloak::KeycloakMember) -> Self {
        let status = m.derive_status().to_string();
        Self {
            id: m.id,
            username: m.username,
            email: m.email,
            first_name: m.first_name,
            last_name: m.last_name,
            status,
        }
    }
}

pub fn derive_status_from_user(email_verified: bool, required_actions: &[String]) -> &'static str {
    if email_verified && !required_actions.iter().any(|a| a == "VERIFY_EMAIL") {
        "ACTIVE"
    } else {
        "PENDING"
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_change_password_request_deserialization() {
        let json = r#"{"current_password": "old123", "new_password": "new456"}"#;
        let req: ChangePasswordRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.current_password, "old123");
        assert_eq!(req.new_password, "new456");
        assert!(req.logout_sessions.is_none());
    }

    #[test]
    fn test_change_password_request_with_logout_sessions() {
        let json =
            r#"{"current_password": "old123", "new_password": "new456", "logout_sessions": false}"#;
        let req: ChangePasswordRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.logout_sessions, Some(false));
    }

    #[test]
    fn test_add_member_request_deserialization() {
        let json = r#"{"email": "test@example.com", "first_name": "John", "last_name": "Doe", "role": "cooperative"}"#;
        let req: AddMemberRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.email, "test@example.com");
        assert_eq!(req.first_name, "John");
        assert_eq!(req.last_name, "Doe");
        assert_eq!(req.role, "cooperative");
        assert!(req.assigned_dimensions.is_none());
    }

    #[test]
    fn test_add_member_request_with_dimensions() {
        let json = r#"{"email": "test@example.com", "first_name": "John", "last_name": "Doe", "role": "cooperative", "assigned_dimensions": ["dim1", "dim2"]}"#;
        let req: AddMemberRequest = serde_json::from_str(json).unwrap();
        assert_eq!(
            req.assigned_dimensions,
            Some(vec!["dim1".to_string(), "dim2".to_string()])
        );
    }

    #[test]
    fn test_update_member_request_deserialization() {
        let json = r#"{"first_name": "Jane", "last_name": "Smith"}"#;
        let req: UpdateMemberRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.first_name, Some("Jane".to_string()));
        assert_eq!(req.last_name, Some("Smith".to_string()));
    }

    #[test]
    fn test_update_member_request_partial() {
        let json = r#"{"first_name": "Jane"}"#;
        let req: UpdateMemberRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.first_name, Some("Jane".to_string()));
        assert!(req.last_name.is_none());
    }

    #[test]
    fn test_member_response_from_keycloak_member() {
        let member = crate::models::keycloak::KeycloakMember {
            id: "user-1".to_string(),
            username: Some("johndoe".to_string()),
            email: Some("john@example.com".to_string()),
            first_name: Some("John".to_string()),
            last_name: Some("Doe".to_string()),
            email_verified: true,
            required_actions: vec![],
            attributes: None,
        };
        let response = MemberResponse::from(member);
        assert_eq!(response.id, "user-1");
        assert_eq!(response.username, Some("johndoe".to_string()));
        assert_eq!(response.email, Some("john@example.com".to_string()));
        assert_eq!(response.first_name, Some("John".to_string()));
        assert_eq!(response.last_name, Some("Doe".to_string()));
        assert_eq!(response.status, "ACTIVE");
    }

    #[test]
    fn test_member_response_pending_status() {
        let member = crate::models::keycloak::KeycloakMember {
            id: "user-2".to_string(),
            username: Some("pending".to_string()),
            email: Some("pending@example.com".to_string()),
            first_name: Some("Pen".to_string()),
            last_name: Some("Ding".to_string()),
            email_verified: false,
            required_actions: vec!["VERIFY_EMAIL".to_string()],
            attributes: None,
        };
        let response = MemberResponse::from(member);
        assert_eq!(response.status, "PENDING");
    }

    #[test]
    fn test_derive_status_from_user_active() {
        assert_eq!(derive_status_from_user(true, &[]), "ACTIVE");
        assert_eq!(
            derive_status_from_user(true, &["UPDATE_PASSWORD".to_string()]),
            "ACTIVE"
        );
    }

    #[test]
    fn test_derive_status_from_user_pending() {
        assert_eq!(derive_status_from_user(false, &[]), "PENDING");
        assert_eq!(
            derive_status_from_user(false, &["VERIFY_EMAIL".to_string()]),
            "PENDING"
        );
        assert_eq!(
            derive_status_from_user(true, &["VERIFY_EMAIL".to_string()]),
            "PENDING"
        );
    }

    #[test]
    fn test_change_password_response_serialization() {
        let response = ChangePasswordResponse {
            message: "Password changed successfully.".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("Password changed successfully"));
    }
}
