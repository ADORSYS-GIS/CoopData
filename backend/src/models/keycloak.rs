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
    // Keycloak 26 returns this field as "createdAt" (camelCase epoch ms integer)
    #[serde(rename = "createdAt", alias = "created_at", default)]
    pub created_at: Option<i64>,
    #[serde(rename = "firstName", default)]
    pub first_name: Option<String>,
    #[serde(rename = "lastName", default)]
    pub last_name: Option<String>,
    // Keycloak 26 has a "status" field ("PENDING" | "ACCEPTED" | "EXPIRED")
    #[serde(default)]
    pub status: Option<String>,
    // Not returned by Keycloak; we set this synthetically after sending
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
