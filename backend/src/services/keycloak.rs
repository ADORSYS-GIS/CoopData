use chrono::Utc;
use reqwest::Client;
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::config::AppConfig;
use crate::error::AppError;
use crate::models::keycloak::{
    KeycloakClientRole, KeycloakGroup, KeycloakGroupCreate, KeycloakInvitation, KeycloakMember,
    KeycloakOrganization, KeycloakOrganizationCreate, KeycloakOrganizationDomain, KeycloakRole,
    KeycloakToken, KeycloakUser,
};

#[derive(Clone)]
pub struct KeycloakService {
    client: Client,
    base_url: String,
    realm: String,
    client_id: String,
    client_secret: String,
    admin_token: Arc<RwLock<Option<CachedToken>>>,
    realm_management_client_id: Arc<RwLock<Option<String>>>,
    account_client_id: Arc<RwLock<Option<String>>>,
}

struct CachedToken {
    access_token: String,
    expires_at: chrono::DateTime<Utc>,
}

impl CachedToken {
    fn is_expired(&self) -> bool {
        Utc::now() + chrono::Duration::seconds(30) >= self.expires_at
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct KeycloakUserCreation {
    username: String,
    email: String,
    enabled: bool,
    email_verified: bool,
    first_name: String,
    last_name: String,
    credentials: Vec<KeycloakCredential>,
    required_actions: Vec<String>,
    attributes: Option<HashMap<String, Vec<String>>>,
}

#[derive(Debug, Serialize)]
struct KeycloakCredential {
    #[serde(rename = "type")]
    credential_type: String,
    value: String,
    temporary: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct KeycloakRoleMapping {
    id: String,
    name: String,
}

macro_rules! check_response {
    ($response:expr, $context:expr) => {
        if !$response.status().is_success() {
            let status = $response.status();
            let body = $response.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "{}", $context);
            let detail = if !body.is_empty() {
                // Try to extract the Keycloak error message from JSON
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                    json.get("errorMessage")
                        .or_else(|| json.get("error_description"))
                        .or_else(|| json.get("error"))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                        .unwrap_or_else(|| body.clone())
                } else {
                    body.clone()
                }
            } else {
                format!("HTTP {}", status)
            };
            return Err(AppError::ExternalServiceError(format!(
                "{}: {}", $context, detail
            )));
        }
    };
}

impl KeycloakService {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: Client::new(),
            base_url: config.keycloak_url.clone(),
            realm: config.keycloak_realm.clone(),
            client_id: config.keycloak_client_id.clone(),
            client_secret: config.keycloak_client_secret.clone(),
            admin_token: Arc::new(RwLock::new(None)),
            realm_management_client_id: Arc::new(RwLock::new(None)),
            account_client_id: Arc::new(RwLock::new(None)),
        }
    }

    fn realm_url(&self) -> String {
        format!("{}/admin/realms/{}", self.base_url, self.realm)
    }

    fn openid_url(&self) -> String {
        format!("{}/realms/{}", self.base_url, self.realm)
    }

    pub async fn get_admin_token(&self) -> Result<String, AppError> {
        {
            let cached = self.admin_token.read().await;
            if let Some(ref token) = *cached {
                if !token.is_expired() {
                    return Ok(token.access_token.clone());
                }
            }
        }

        let url = format!("{}/protocol/openid-connect/token", self.openid_url());
        let params = [
            ("grant_type", "client_credentials"),
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
        ];

        let response = self
            .client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::ExternalServiceError(
                "Failed to get admin token".into(),
            ));
        }

        let token: KeycloakToken = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        let access_token = token.access_token.clone();
        let expires_at =
            Utc::now() + chrono::Duration::seconds(token.expires_in.saturating_sub(10));

        {
            let mut cached = self.admin_token.write().await;
            *cached = Some(CachedToken {
                access_token: token.access_token,
                expires_at,
            });
        }

        Ok(access_token)
    }

    async fn get_cached_admin_token(&self) -> Result<String, AppError> {
        self.get_admin_token().await
    }

    pub async fn verify_user_password(
        &self,
        username: &str,
        password: &str,
    ) -> Result<(), AppError> {
        let url = format!("{}/protocol/openid-connect/token", self.openid_url());
        let params = [
            ("grant_type", "password"),
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("username", username),
            ("password", password),
        ];

        let response = self
            .client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().is_success() {
            return Ok(());
        }

        let body = response.text().await.unwrap_or_default();
        let detail = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
            json.get("error_description")
                .or_else(|| json.get("errorMessage"))
                .or_else(|| json.get("error"))
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| "Invalid credentials".to_string())
        } else {
            "Current password is incorrect".to_string()
        };

        Err(AppError::Unauthorized(detail))
    }

    async fn get_realm_management_client_id(&self) -> Result<String, AppError> {
        {
            let cached = self.realm_management_client_id.read().await;
            if let Some(ref id) = *cached {
                return Ok(id.clone());
            }
        }

        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/clients?clientId=realm-management", self.realm_url());
        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to find realm-management client");

        let clients: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        let client_id = clients
            .first()
            .and_then(|c| c.get("id"))
            .and_then(|id| id.as_str())
            .map(String::from)
            .ok_or_else(|| {
                AppError::ExternalServiceError("realm-management client not found".into())
            })?;

        {
            let mut cached = self.realm_management_client_id.write().await;
            *cached = Some(client_id.clone());
        }

        Ok(client_id)
    }

    async fn get_account_client_id(&self) -> Result<String, AppError> {
        {
            let cached = self.account_client_id.read().await;
            if let Some(ref id) = *cached {
                return Ok(id.clone());
            }
        }

        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/clients?clientId=account", self.realm_url());
        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to find account client");

        let clients: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        let client_id = clients
            .first()
            .and_then(|c| c.get("id"))
            .and_then(|id| id.as_str())
            .map(String::from)
            .ok_or_else(|| AppError::ExternalServiceError("account client not found".into()))?;

        {
            let mut cached = self.account_client_id.write().await;
            *cached = Some(client_id.clone());
        }

        Ok(client_id)
    }

    // ═══════════════════════════════════════════════════════════
    // USER OPERATIONS
    // ═══════════════════════════════════════════════════════════

    pub async fn verify_token(&self, token: &str) -> Result<KeycloakUser, AppError> {
        let url = format!("{}/protocol/openid-connect/userinfo", self.openid_url());

        let response = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::Unauthorized("Invalid token".into()));
        }

        let user: KeycloakUser = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        Ok(user)
    }

    pub async fn create_user(
        &self,
        username: &str,
        email: &str,
        password: &str,
        role: &str,
        first_name: &str,
        last_name: &str,
    ) -> Result<KeycloakUser, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users", self.realm_url());

        let creation = KeycloakUserCreation {
            username: username.to_string(),
            email: email.to_string(),
            enabled: true,
            email_verified: true,
            first_name: first_name.to_string(),
            last_name: last_name.to_string(),
            credentials: vec![KeycloakCredential {
                credential_type: "password".to_string(),
                value: password.to_string(),
                temporary: true,
            }],
            required_actions: vec![],
            attributes: None,
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&creation)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().as_u16() == 409 {
            return Err(AppError::Conflict(
                "User with this email already exists".into(),
            ));
        }
        check_response!(response, "Failed to create Keycloak user");

        let location = response
            .headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        let keycloak_id = location
            .as_ref()
            .and_then(|loc| loc.split('/').next_back())
            .unwrap_or("")
            .to_string();

        if keycloak_id.is_empty() {
            let users = self.search_users_by_email(&token, email).await?;
            return users.into_iter().next().ok_or_else(|| {
                AppError::ExternalServiceError("User created but ID not found".into())
            });
        }

        self.assign_realm_role(&token, &keycloak_id, role).await?;

        self.get_user_by_id_raw(&token, &keycloak_id).await
    }

    pub async fn create_user_with_email_verification(
        &self,
        email: &str,
        first_name: &str,
        last_name: &str,
        role: &str,
        temporary_password: &str,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakUser, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users", self.realm_url());

        let creation = KeycloakUserCreation {
            username: email.to_string(),
            email: email.to_string(),
            enabled: true,
            email_verified: false,
            first_name: first_name.to_string(),
            last_name: last_name.to_string(),
            credentials: vec![KeycloakCredential {
                credential_type: "password".to_string(),
                value: temporary_password.to_string(),
                temporary: true,
            }],
            required_actions: vec!["VERIFY_EMAIL".to_string(), "UPDATE_PASSWORD".to_string()],
            attributes: attributes.clone(),
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&creation)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().as_u16() == 409 {
            return Err(AppError::Conflict(
                "User with this email already exists".into(),
            ));
        }
        check_response!(
            response,
            "Failed to create Keycloak user with email verification"
        );

        let location = response
            .headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        let keycloak_id = location
            .as_ref()
            .and_then(|loc| loc.split('/').next_back())
            .unwrap_or("")
            .to_string();

        if keycloak_id.is_empty() {
            let users = self.search_users_by_email(&token, email).await?;
            return users.into_iter().next().ok_or_else(|| {
                AppError::ExternalServiceError("User created but ID not found".into())
            });
        }
        self.assign_realm_role(&token, &keycloak_id, role).await?;

        self.trigger_email_verification(&keycloak_id).await?;

        self.get_user_by_id_raw(&token, &keycloak_id).await
    }

    pub async fn search_users_by_email(
        &self,
        access_token: &str,
        email: &str,
    ) -> Result<Vec<KeycloakUser>, AppError> {
        let url = format!("{}/users?email={}", self.realm_url(), email);
        let response = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to search users by email");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    async fn get_user_by_id_raw(
        &self,
        access_token: &str,
        keycloak_id: &str,
    ) -> Result<KeycloakUser, AppError> {
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);
        let response = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to get Keycloak user by ID");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn get_user_by_id(&self, keycloak_id: &str) -> Result<KeycloakUser, AppError> {
        let token = self.get_cached_admin_token().await?;
        self.get_user_by_id_raw(&token, keycloak_id).await
    }

    pub async fn update_user_attributes(
        &self,
        keycloak_id: &str,
        attributes: HashMap<String, Vec<String>>,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);
        let body = json!({ "attributes": attributes });

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to update user attributes");
        info!(keycloak_id = %keycloak_id, "User attributes updated");
        Ok(())
    }

    pub async fn delete_user(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to delete Keycloak user");
        info!(keycloak_id = %keycloak_id, "User deleted from Keycloak");
        Ok(())
    }

    pub async fn get_user_groups(&self, keycloak_id: &str) -> Result<Vec<KeycloakGroup>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}/groups", self.realm_url(), keycloak_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to get user groups");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn get_user_organizations(
        &self,
        keycloak_id: &str,
    ) -> Result<Vec<KeycloakOrganization>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}/organizations", self.realm_url(), keycloak_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to get user organizations");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    async fn trigger_email_verification(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/users/{}/execute-actions-email",
            self.realm_url(),
            keycloak_id
        );
        let actions = vec!["VERIFY_EMAIL"];

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&actions)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to send verification email");
        info!(keycloak_id = %keycloak_id, "Verification email triggered");
        Ok(())
    }

    pub async fn trigger_email_verification_for_user(
        &self,
        keycloak_id: &str,
    ) -> Result<(), AppError> {
        self.trigger_email_verification(keycloak_id).await
    }

    // ═══════════════════════════════════════════════════════════
    // ROLE OPERATIONS
    // ═══════════════════════════════════════════════════════════

    async fn get_realm_role(
        &self,
        access_token: &str,
        role_name: &str,
    ) -> Result<KeycloakRole, AppError> {
        let url = format!("{}/roles/{}", self.realm_url(), role_name);
        let response = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Realm role not found");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn assign_realm_role(
        &self,
        access_token: &str,
        keycloak_id: &str,
        role_name: &str,
    ) -> Result<(), AppError> {
        let role = self.get_realm_role(access_token, role_name).await?;
        let url = format!(
            "{}/users/{}/role-mappings/realm",
            self.realm_url(),
            keycloak_id
        );
        let body = vec![KeycloakRoleMapping {
            id: role.id.clone(),
            name: role.name.clone(),
        }];

        let response = self
            .client
            .post(&url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to assign realm role");
        info!(keycloak_id = %keycloak_id, role = %role_name, "Realm role assigned");
        Ok(())
    }

    async fn get_client_role(
        &self,
        access_token: &str,
        client_id: &str,
        role_name: &str,
    ) -> Result<KeycloakClientRole, AppError> {
        let url = format!(
            "{}/clients/{}/roles/{}",
            self.realm_url(),
            client_id,
            role_name
        );
        let response = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Client role not found");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    async fn assign_client_role(
        &self,
        access_token: &str,
        keycloak_id: &str,
        client_id: &str,
        role_names: &[&str],
    ) -> Result<(), AppError> {
        let mut roles = Vec::new();
        for role_name in role_names {
            let role = self
                .get_client_role(access_token, client_id, role_name)
                .await?;
            roles.push(json!({
                "id": role.id,
                "name": role.name
            }));
        }

        let url = format!(
            "{}/users/{}/role-mappings/clients/{}",
            self.realm_url(),
            keycloak_id,
            client_id
        );
        let response = self
            .client
            .post(&url)
            .bearer_auth(access_token)
            .json(&roles)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to assign client roles");
        info!(keycloak_id = %keycloak_id, roles = ?role_names, "Client roles assigned");
        Ok(())
    }

    pub async fn assign_federation_roles(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        self.assign_realm_role(&token, keycloak_id, "federation")
            .await?;

        let rm_client_id = self.get_realm_management_client_id().await?;
        let rm_roles = &[
            "manage-users",
            "view-users",
            "query-users",
            "manage-organizations",
            "query-groups",
            "view-realm",
            "query-clients",
            "view-clients",
        ];
        self.assign_client_role(&token, keycloak_id, &rm_client_id, rm_roles)
            .await?;

        let account_client_id = self.get_account_client_id().await?;
        self.assign_client_role(&token, keycloak_id, &account_client_id, &["view-groups"])
            .await?;

        Ok(())
    }

    pub async fn assign_apex_roles(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        self.assign_realm_role(&token, keycloak_id, "apex").await?;

        let rm_client_id = self.get_realm_management_client_id().await?;
        let rm_roles = &[
            "manage-users",
            "view-users",
            "query-users",
            "query-groups",
            "view-realm",
            "query-clients",
            "view-clients",
        ];
        self.assign_client_role(&token, keycloak_id, &rm_client_id, rm_roles)
            .await?;

        let account_client_id = self.get_account_client_id().await?;
        self.assign_client_role(&token, keycloak_id, &account_client_id, &["view-groups"])
            .await?;

        Ok(())
    }

    pub async fn assign_cooperative_roles(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        self.assign_realm_role(&token, keycloak_id, "cooperative")
            .await?;

        let rm_client_id = self.get_realm_management_client_id().await?;
        let rm_roles = &["query-groups", "view-users"];
        self.assign_client_role(&token, keycloak_id, &rm_client_id, rm_roles)
            .await?;

        let account_client_id = self.get_account_client_id().await?;
        self.assign_client_role(&token, keycloak_id, &account_client_id, &["view-groups"])
            .await?;

        Ok(())
    }

    pub async fn assign_role(&self, keycloak_id: &str, role: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        self.assign_realm_role(&token, keycloak_id, role).await
    }

    // ═══════════════════════════════════════════════════════════
    // ORGANIZATION (FEDERATION) OPERATIONS
    // ═══════════════════════════════════════════════════════════

    pub async fn create_organization(
        &self,
        name: &str,
        domains: Vec<KeycloakOrganizationDomain>,
        redirect_url: Option<String>,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakOrganization, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations", self.realm_url());

        let payload = KeycloakOrganizationCreate {
            name: name.to_string(),
            domains,
            redirect_url,
            enabled: true,
            attributes,
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().as_u16() == 409 {
            return Err(AppError::Conflict("Organization already exists".into()));
        }
        check_response!(response, "Failed to create organization");

        self.get_organizations()
            .await?
            .into_iter()
            .find(|o| o.name == name)
            .ok_or_else(|| {
                AppError::ExternalServiceError("Organization created but not found".into())
            })
    }

    pub async fn get_organizations(&self) -> Result<Vec<KeycloakOrganization>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations", self.realm_url());

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to list organizations");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn get_organization_by_id(
        &self,
        org_id: &str,
    ) -> Result<KeycloakOrganization, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}", self.realm_url(), org_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Organization not found");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn update_organization(
        &self,
        org_id: &str,
        name: Option<&str>,
        description: Option<&str>,
        domains: Option<Vec<KeycloakOrganizationDomain>>,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakOrganization, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}", self.realm_url(), org_id);

        let mut body = json!({});
        if let Some(n) = name {
            body["name"] = json!(n);
        }
        if let Some(d) = description {
            body["description"] = json!(d);
        }
        if let Some(domains) = domains {
            body["domains"] = json!(domains);
        }
        if let Some(attrs) = attributes {
            body["attributes"] = json!(attrs);
        }

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to update organization");
        self.get_organization_by_id(org_id).await
    }

    pub async fn delete_organization(&self, org_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}", self.realm_url(), org_id);

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to delete organization");
        info!(org_id = %org_id, "Organization deleted");
        Ok(())
    }

    // ═══════════════════════════════════════════════════════════
    // ORGANIZATION INVITATIONS
    // ═══════════════════════════════════════════════════════════

    pub async fn invite_user_to_organization(
        &self,
        org_id: &str,
        email: &str,
        first_name: &str,
        last_name: &str,
        role: &str,
        _redirect_url: &str,
    ) -> Result<KeycloakInvitation, AppError> {
        let token = self.get_cached_admin_token().await?;

        let users = self.search_users_by_email(&token, email).await?;
        let keycloak_id = if let Some(existing_user) = users.first() {
            let user_groups = self.get_user_groups(&existing_user.id).await?;
            if !user_groups.is_empty() {
                return Err(AppError::Conflict(
                    "User is already a member of a group".into(),
                ));
            }
            let user_orgs = self.get_user_organizations(&existing_user.id).await?;
            if !user_orgs.is_empty() {
                return Err(AppError::Conflict(
                    "User is already a member of another organization".into(),
                ));
            }

            match role {
                "federation" => self.assign_federation_roles(&existing_user.id).await?,
                "apex" => self.assign_apex_roles(&existing_user.id).await?,
                "cooperative" => self.assign_cooperative_roles(&existing_user.id).await?,
                _ => self.assign_role(&existing_user.id, role).await?,
            }

            existing_user.id.clone()
        } else {
            let temp_password = format!("Temp{}!", Utc::now().timestamp());
            let new_user = self
                .create_user_with_email_verification(
                    email,
                    first_name,
                    last_name,
                    role,
                    &temp_password,
                    None,
                )
                .await?;
            new_user.id
        };

        self.add_user_to_organization(&keycloak_id, org_id).await?;

        let url = format!(
            "{}/organizations/{}/members/invite-user",
            self.realm_url(),
            org_id
        );
        let body = json!({
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
        });

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to create organization invitation");
        info!(org_id = %org_id, email = %email, role = %role, "User invited to organization");

        Ok(KeycloakInvitation {
            id: keycloak_id,
            email: Some(email.to_string()),
            created_at: Some(Utc::now().timestamp()),
            email_sent: true,
        })
    }

    pub async fn get_organization_invitations(
        &self,
        org_id: &str,
    ) -> Result<Vec<KeycloakInvitation>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}/invitations", self.realm_url(), org_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to list organization invitations");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn delete_organization_invitation(
        &self,
        org_id: &str,
        invitation_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/organizations/{}/invitations/{}",
            self.realm_url(),
            org_id,
            invitation_id
        );

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to delete organization invitation");
        Ok(())
    }

    pub async fn resend_organization_invitation(
        &self,
        org_id: &str,
        invitation_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/organizations/{}/invitations/{}/resend",
            self.realm_url(),
            org_id,
            invitation_id
        );

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to resend organization invitation");
        Ok(())
    }

    pub async fn get_organization_members(
        &self,
        org_id: &str,
    ) -> Result<Vec<KeycloakMember>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}/members", self.realm_url(), org_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to get organization members");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn add_user_to_organization(
        &self,
        keycloak_id: &str,
        org_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/organizations/{}/members", self.realm_url(), org_id);
        let body = json!({ "id": keycloak_id });

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to add user to organization");
        info!(keycloak_id = %keycloak_id, org_id = %org_id, "User added to organization");
        Ok(())
    }

    // ═══════════════════════════════════════════════════════════
    // GROUP (APEX) OPERATIONS
    // ═══════════════════════════════════════════════════════════

    pub async fn create_group(
        &self,
        name: &str,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakGroup, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups", self.realm_url());
        let payload = KeycloakGroupCreate {
            name: name.to_string(),
            attributes,
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().as_u16() == 409 {
            return Err(AppError::Conflict("Group already exists".into()));
        }
        check_response!(response, "Failed to create group");

        self.get_group_by_name(&token, name).await
    }

    pub async fn create_subgroup(
        &self,
        parent_group_id: &str,
        name: &str,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakGroup, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups/{}/children", self.realm_url(), parent_group_id);
        let payload = KeycloakGroupCreate {
            name: name.to_string(),
            attributes,
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if response.status().as_u16() == 409 {
            return Err(AppError::Conflict("Subgroup already exists".into()));
        }
        check_response!(response, "Failed to create subgroup");

        self.get_group_by_name(&token, name).await
    }

    pub async fn get_groups(&self, search: Option<&str>) -> Result<Vec<KeycloakGroup>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = match search {
            Some(s) => format!(
                "{}/groups?search={}&briefRepresentation=false&max=100",
                self.realm_url(),
                s
            ),
            None => format!(
                "{}/groups?briefRepresentation=false&max=100",
                self.realm_url()
            ),
        };

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to list groups");

        // Keycloak 26+ may return { "count": N, "groups": [...] } or a plain array
        let raw: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        let groups_value = if raw.is_array() {
            raw
        } else {
            raw.get("groups")
                .cloned()
                .unwrap_or(serde_json::Value::Array(vec![]))
        };

        serde_json::from_value(groups_value)
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn get_group_by_id(&self, group_id: &str) -> Result<KeycloakGroup, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups/{}", self.realm_url(), group_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Group not found");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    async fn get_group_by_name(
        &self,
        access_token: &str,
        name: &str,
    ) -> Result<KeycloakGroup, AppError> {
        let url = format!("{}/groups?search={}", self.realm_url(), name);
        let response = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to search groups");
        let groups: Vec<KeycloakGroup> = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        groups
            .into_iter()
            .find(|g| g.name == name)
            .ok_or_else(|| AppError::NotFound(format!("Group '{}' not found", name)))
    }

    pub async fn delete_group(&self, group_id: &str) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups/{}", self.realm_url(), group_id);

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to delete group");
        info!(group_id = %group_id, "Group deleted");
        Ok(())
    }

    pub async fn update_group(
        &self,
        group_id: &str,
        name: Option<&str>,
        attributes: Option<HashMap<String, Vec<String>>>,
    ) -> Result<KeycloakGroup, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups/{}", self.realm_url(), group_id);

        let mut body = json!({});
        if let Some(n) = name {
            body["name"] = json!(n);
        }
        if let Some(attrs) = attributes {
            body["attributes"] = json!(attrs);
        }

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to update group");
        self.get_group_by_id(group_id).await
    }

    // ═══════════════════════════════════════════════════════════
    // GROUP MEMBERSHIP (APEX & COOPERATIVE)
    // ═══════════════════════════════════════════════════════════

    pub async fn add_user_to_group(
        &self,
        keycloak_id: &str,
        group_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/users/{}/groups/{}",
            self.realm_url(),
            keycloak_id,
            group_id
        );

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to add user to group");
        info!(keycloak_id = %keycloak_id, group_id = %group_id, "User added to group");
        Ok(())
    }

    pub async fn remove_user_from_group(
        &self,
        keycloak_id: &str,
        group_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/users/{}/groups/{}",
            self.realm_url(),
            keycloak_id,
            group_id
        );

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to remove user from group");
        info!(keycloak_id = %keycloak_id, group_id = %group_id, "User removed from group");
        Ok(())
    }

    pub async fn get_group_members(&self, group_id: &str) -> Result<Vec<KeycloakMember>, AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/groups/{}/members", self.realm_url(), group_id);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to get group members");
        response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    pub async fn remove_user_from_organization(
        &self,
        keycloak_id: &str,
        org_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!(
            "{}/organizations/{}/members/{}",
            self.realm_url(),
            org_id,
            keycloak_id
        );

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to remove user from organization");
        info!(keycloak_id = %keycloak_id, org_id = %org_id, "User removed from organization");
        Ok(())
    }

    // ═══════════════════════════════════════════════════════════
    // APEX / COOPERATIVE MEMBER ADDITION
    // ═══════════════════════════════════════════════════════════

    pub async fn add_member_to_group(
        &self,
        email: &str,
        first_name: &str,
        last_name: &str,
        role: &str,
        group_id: &str,
        assigned_dimensions: Option<Vec<String>>,
    ) -> Result<KeycloakUser, AppError> {
        let token = self.get_cached_admin_token().await?;
        let users = self.search_users_by_email(&token, email).await?;

        let keycloak_id = if let Some(existing_user) = users.first() {
            let user_groups = self.get_user_groups(&existing_user.id).await?;
            if !user_groups.is_empty() {
                let already_in_this_group = user_groups.iter().any(|g| g.id == group_id);
                if already_in_this_group {
                    return Err(AppError::Conflict(
                        "User is already a member of this group".into(),
                    ));
                }
                return Err(AppError::Conflict(
                    "User is already a member of another group".into(),
                ));
            }

            // Skip organization membership check — the /organizations endpoint is
            // not always available and group membership check above is sufficient.

            if let Some(ref dims) = assigned_dimensions {
                let mut attrs = existing_user.attributes.clone().unwrap_or_default();
                attrs.insert("assigned_dimensions".to_string(), dims.clone());
                self.update_user_attributes(&existing_user.id, attrs)
                    .await?;
            }

            existing_user.id.clone()
        } else {
            let temp_password = format!("Temp{}!", Utc::now().timestamp());
            let mut attrs = HashMap::new();
            if let Some(ref dims) = assigned_dimensions {
                attrs.insert("assigned_dimensions".to_string(), dims.clone());
            }

            let new_user = self
                .create_user_with_email_verification(
                    email,
                    first_name,
                    last_name,
                    role,
                    &temp_password,
                    if attrs.is_empty() { None } else { Some(attrs) },
                )
                .await?;
            new_user.id
        };

        match role {
            "federation" => self.assign_federation_roles(&keycloak_id).await?,
            "apex" => self.assign_apex_roles(&keycloak_id).await?,
            "cooperative" => self.assign_cooperative_roles(&keycloak_id).await?,
            _ => self.assign_role(&keycloak_id, role).await?,
        }

        self.add_user_to_group(&keycloak_id, group_id).await?;

        self.get_user_by_id(&keycloak_id).await
    }

    pub async fn update_user_name(
        &self,
        keycloak_id: &str,
        first_name: Option<&str>,
        last_name: Option<&str>,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);

        let mut body = serde_json::json!({});
        if let Some(f) = first_name {
            body["firstName"] = serde_json::json!(f);
        }
        if let Some(l) = last_name {
            body["lastName"] = serde_json::json!(l);
        }

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to update user name");
        info!(keycloak_id = %keycloak_id, "User name updated");
        Ok(())
    }

    pub async fn reset_user_password(
        &self,
        keycloak_id: &str,
        new_password: &str,
        temporary: bool,
    ) -> Result<(), AppError> {
        let token = self.get_cached_admin_token().await?;
        let url = format!("{}/users/{}/reset-password", self.realm_url(), keycloak_id);

        let body = json!({
            "type": "password",
            "value": new_password,
            "temporary": temporary,
        });

        let response = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        check_response!(response, "Failed to reset user password");
        Ok(())
    }
}
