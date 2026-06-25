use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::AppError;
use crate::models::keycloak::{KeycloakToken, KeycloakUser};

#[derive(Clone)]
pub struct KeycloakService {
    client: Client,
    base_url: String,
    realm: String,
    client_id: String,
    client_secret: String,
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
    is_composite: bool,
    client_role: bool,
    container_id: String,
}

impl KeycloakService {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: Client::new(),
            base_url: config.keycloak_url.clone(),
            realm: config.keycloak_realm.clone(),
            client_id: config.keycloak_client_id.clone(),
            client_secret: config.keycloak_client_secret.clone(),
        }
    }

    fn realm_url(&self) -> String {
        format!("{}/admin/realms/{}", self.base_url, self.realm)
    }

    fn openid_url(&self) -> String {
        format!("{}/realms/{}", self.base_url, self.realm)
    }

    pub async fn verify_token(&self, token: &str) -> Result<KeycloakUser, AppError> {
        let url = format!("{}/protocol/openid-connect/userinfo", self.openid_url());
        
        let response = self.client
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

    pub async fn get_admin_token(&self) -> Result<KeycloakToken, AppError> {
        let url = format!("{}/protocol/openid-connect/token", self.openid_url());
        
        let params = [
            ("grant_type", "client_credentials"),
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
        ];

        let response = self.client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::ExternalServiceError("Failed to get admin token".into()));
        }

        let token: KeycloakToken = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        Ok(token)
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
        let token = self.get_admin_token().await?;
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
        };

        let response = self.client
            .post(&url)
            .bearer_auth(&token.access_token)
            .json(&creation)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Failed to create Keycloak user");
            return Err(AppError::ExternalServiceError(format!("Failed to create Keycloak user: {}", status)));
        }

        let location = response.headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        let keycloak_id = location
            .as_ref()
            .and_then(|loc| loc.split('/').next_back())
            .unwrap_or("");

        if keycloak_id.is_empty() {
            let user = self.get_user_by_email(email).await?;
            return Ok(user);
        }

        self.assign_role(keycloak_id, role).await?;

        let user = self.get_user_by_id(keycloak_id).await?;
        Ok(user)
    }

    pub async fn assign_role(&self, keycloak_id: &str, role: &str) -> Result<(), AppError> {
        let token = self.get_admin_token().await?;
        let role = self.get_realm_role(&token.access_token, role).await?;

        let url = format!("{}/users/{}/role-mappings/realm", self.realm_url(), keycloak_id);
        let role_mapping = vec![KeycloakRoleMapping {
            id: role.id.clone(),
            name: role.name.clone(),
            is_composite: role.composite,
            client_role: false,
            container_id: self.realm.clone(),
        }];

        let response = self.client
            .post(&url)
            .bearer_auth(&token.access_token)
            .json(&role_mapping)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Failed to assign Keycloak role");
            return Err(AppError::ExternalServiceError(format!("Failed to assign role: {}", status)));
        }

        tracing::info!(keycloak_id = %keycloak_id, role = %role.name, "Role assigned in Keycloak");
        Ok(())
    }

    pub async fn delete_user(&self, keycloak_id: &str) -> Result<(), AppError> {
        let token = self.get_admin_token().await?;
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);

        let response = self.client
            .delete(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Failed to delete Keycloak user");
            return Err(AppError::ExternalServiceError(format!("Failed to delete Keycloak user: {}", status)));
        }

        tracing::info!(keycloak_id = %keycloak_id, "User deleted from Keycloak");
        Ok(())
    }

    async fn get_realm_role(&self, access_token: &str, role_name: &str) -> Result<KeycloakRealmRole, AppError> {
        let url = format!("{}/roles/{}", self.realm_url(), role_name);

        let response = self.client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::ExternalServiceError(format!("Role '{}' not found in Keycloak", role_name)));
        }

        response.json().await.map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }

    async fn get_user_by_email(&self, email: &str) -> Result<KeycloakUser, AppError> {
        let token = self.get_admin_token().await?;
        let url = format!("{}/users?email={}", self.realm_url(), email);

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        let mut users: Vec<KeycloakUser> = response
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        users.pop().ok_or_else(|| AppError::NotFound(format!("Keycloak user with email {} not found", email)))
    }

    async fn get_user_by_id(&self, keycloak_id: &str) -> Result<KeycloakUser, AppError> {
        let token = self.get_admin_token().await?;
        let url = format!("{}/users/{}", self.realm_url(), keycloak_id);

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

        response.json().await.map_err(|e| AppError::ExternalServiceError(e.to_string()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KeycloakRealmRole {
    id: String,
    name: String,
    composite: bool,
}