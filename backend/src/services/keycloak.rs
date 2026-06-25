use reqwest::Client;

use crate::config::AppConfig;
use crate::error::AppError;
use crate::models::keycloak::{KeycloakToken, KeycloakUser};

pub struct KeycloakService {
    client: Client,
    base_url: String,
    realm: String,
    client_id: String,
    client_secret: String,
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
        format!("{}/realms/{}", self.base_url, self.realm)
    }

    pub async fn verify_token(&self, token: &str) -> Result<KeycloakUser, AppError> {
        let url = format!("{}/protocol/openid-connect/userinfo", self.realm_url());

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

    pub async fn get_admin_token(&self) -> Result<KeycloakToken, AppError> {
        let url = format!("{}/protocol/openid-connect/token", self.realm_url());

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

        Ok(token)
    }
}
