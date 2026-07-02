use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakUser {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub enabled: bool,
    #[serde(rename = "createdTimestamp")]
    pub created_timestamp: Option<i64>,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
    #[serde(default)]
    pub required_actions: Vec<String>,
}

impl KeycloakUser {
    pub fn first_name_str(&self) -> &str {
        self.first_name.as_deref().unwrap_or("")
    }

    pub fn last_name_str(&self) -> &str {
        self.last_name.as_deref().unwrap_or("")
    }

    pub fn get_attribute(&self, key: &str) -> Option<&String> {
        self.attributes
            .as_ref()
            .and_then(|attrs| attrs.get(key))
            .and_then(|vals| vals.first())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakToken {
    pub access_token: String,
    #[serde(default)]
    pub expires_in: i64,
    #[serde(default)]
    pub refresh_expires_in: i64,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub session_state: Option<String>,
    #[serde(default)]
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakOrganization {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub domains: Vec<KeycloakOrganizationDomain>,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakOrganizationDomain {
    pub name: String,
    #[serde(default)]
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeycloakOrganizationCreate {
    pub name: String,
    #[serde(default)]
    pub domains: Vec<KeycloakOrganizationDomain>,
    #[serde(default)]
    pub redirect_url: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakGroup {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
    #[serde(rename = "subGroups", default)]
    pub sub_groups: Vec<KeycloakGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeycloakGroupCreate {
    pub name: String,
    #[serde(default)]
    pub attributes: Option<std::collections::HashMap<String, Vec<String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakInvitation {
    pub id: String,
    pub email: Option<String>,
    pub created_at: Option<i64>,
    #[serde(default)]
    pub email_sent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakMember {
    pub id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakRole {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub composite: bool,
    #[serde(default)]
    pub client_role: bool,
    #[serde(default)]
    pub container_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeycloakClientRole {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub composite: bool,
    #[serde(default)]
    pub container_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keycloak_user_first_name_str() {
        let user = KeycloakUser {
            id: "user-1".to_string(),
            username: "johndoe".to_string(),
            email: Some("john@example.com".to_string()),
            email_verified: true,
            first_name: Some("John".to_string()),
            last_name: Some("Doe".to_string()),
            enabled: true,
            created_timestamp: Some(1234567890),
            attributes: None,
            required_actions: vec![],
        };
        assert_eq!(user.first_name_str(), "John");
    }

    #[test]
    fn test_keycloak_user_first_name_str_none() {
        let user = KeycloakUser {
            id: "user-2".to_string(),
            username: "janedoe".to_string(),
            email: None,
            email_verified: false,
            first_name: None,
            last_name: None,
            enabled: true,
            created_timestamp: None,
            attributes: None,
            required_actions: vec![],
        };
        assert_eq!(user.first_name_str(), "");
    }

    #[test]
    fn test_keycloak_user_last_name_str() {
        let user = KeycloakUser {
            id: "user-3".to_string(),
            username: "test".to_string(),
            email: None,
            email_verified: false,
            first_name: Some("Jane".to_string()),
            last_name: Some("Smith".to_string()),
            enabled: true,
            created_timestamp: None,
            attributes: None,
            required_actions: vec![],
        };
        assert_eq!(user.last_name_str(), "Smith");
    }

    #[test]
    fn test_keycloak_user_last_name_str_none() {
        let user = KeycloakUser {
            id: "user-4".to_string(),
            username: "test".to_string(),
            email: None,
            email_verified: false,
            first_name: None,
            last_name: None,
            enabled: true,
            created_timestamp: None,
            attributes: None,
            required_actions: vec![],
        };
        assert_eq!(user.last_name_str(), "");
    }

    #[test]
    fn test_keycloak_user_get_attribute() {
        let mut attrs = std::collections::HashMap::new();
        attrs.insert("org_id".to_string(), vec!["123".to_string()]);
        attrs.insert("type".to_string(), vec!["apex".to_string()]);

        let user = KeycloakUser {
            id: "user-5".to_string(),
            username: "test".to_string(),
            email: None,
            email_verified: false,
            first_name: None,
            last_name: None,
            enabled: true,
            created_timestamp: None,
            attributes: Some(attrs),
            required_actions: vec![],
        };

        assert_eq!(user.get_attribute("org_id"), Some(&"123".to_string()));
        assert_eq!(user.get_attribute("type"), Some(&"apex".to_string()));
        assert_eq!(user.get_attribute("nonexistent"), None);
    }

    #[test]
    fn test_keycloak_user_get_attribute_no_attributes() {
        let user = KeycloakUser {
            id: "user-6".to_string(),
            username: "test".to_string(),
            email: None,
            email_verified: false,
            first_name: None,
            last_name: None,
            enabled: true,
            created_timestamp: None,
            attributes: None,
            required_actions: vec![],
        };

        assert!(user.get_attribute("org_id").is_none());
    }

    #[test]
    fn test_keycloak_user_deserialization() {
        let json = r#"{
            "id": "user-7",
            "username": "testuser",
            "email": "test@example.com",
            "email_verified": true,
            "firstName": "Test",
            "lastName": "User",
            "enabled": true,
            "required_actions": []
        }"#;
        let user: KeycloakUser = serde_json::from_str(json).unwrap();
        assert_eq!(user.id, "user-7");
        assert_eq!(user.username, "testuser");
        assert_eq!(user.email, Some("test@example.com".to_string()));
        assert!(user.email_verified);
        assert_eq!(user.first_name, Some("Test".to_string()));
        assert_eq!(user.last_name, Some("User".to_string()));
        assert!(user.enabled);
    }

    #[test]
    fn test_keycloak_group_deserialization() {
        let json = r#"{
            "id": "group-1",
            "name": "Test Group",
            "path": "/test-group",
            "subGroups": []
        }"#;
        let group: KeycloakGroup = serde_json::from_str(json).unwrap();
        assert_eq!(group.id, "group-1");
        assert_eq!(group.name, "Test Group");
        assert_eq!(group.path, Some("/test-group".to_string()));
        assert!(group.sub_groups.is_empty());
    }

    #[test]
    fn test_keycloak_group_with_subgroups() {
        let json = r#"{
            "id": "parent-1",
            "name": "Parent",
            "path": "/parent",
            "subGroups": [
                {
                    "id": "child-1",
                    "name": "Child",
                    "path": "/parent/child",
                    "subGroups": []
                }
            ]
        }"#;
        let group: KeycloakGroup = serde_json::from_str(json).unwrap();
        assert_eq!(group.sub_groups.len(), 1);
        assert_eq!(group.sub_groups[0].id, "child-1");
        assert_eq!(group.sub_groups[0].name, "Child");
    }

    #[test]
    fn test_keycloak_organization_deserialization() {
        let json = r#"{
            "id": "org-1",
            "name": "Test Federation",
            "enabled": true,
            "domains": [{"name": "test.com", "verified": true}]
        }"#;
        let org: KeycloakOrganization = serde_json::from_str(json).unwrap();
        assert_eq!(org.id, "org-1");
        assert_eq!(org.name, "Test Federation");
        assert!(org.enabled);
        assert_eq!(org.domains.len(), 1);
        assert_eq!(org.domains[0].name, "test.com");
        assert!(org.domains[0].verified);
    }

    #[test]
    fn test_keycloak_invitation_deserialization() {
        let json = r#"{
            "id": "inv-1",
            "email": "invited@example.com",
            "createdAt": 1234567890,
            "email_sent": true
        }"#;
        let inv: KeycloakInvitation = serde_json::from_str(json).unwrap();
        assert_eq!(inv.id, "inv-1");
        assert_eq!(inv.email, Some("invited@example.com".to_string()));
        assert!(inv.email_sent);
    }

    #[test]
    fn test_keycloak_member_deserialization() {
        let json = r#"{
            "id": "member-1",
            "username": "testmember",
            "email": "member@example.com",
            "firstName": "Test",
            "lastName": "Member"
        }"#;
        let member: KeycloakMember = serde_json::from_str(json).unwrap();
        assert_eq!(member.id, "member-1");
        assert_eq!(member.username, Some("testmember".to_string()));
        assert_eq!(member.email, Some("member@example.com".to_string()));
        assert_eq!(member.first_name, Some("Test".to_string()));
        assert_eq!(member.last_name, Some("Member".to_string()));
    }

    #[test]
    fn test_keycloak_role_deserialization() {
        let json = r#"{
            "id": "role-1",
            "name": "ministry",
            "composite": false,
            "clientRole": false
        }"#;
        let role: KeycloakRole = serde_json::from_str(json).unwrap();
        assert_eq!(role.id, "role-1");
        assert_eq!(role.name, "ministry");
        assert!(!role.composite);
        assert!(!role.client_role);
    }
}
