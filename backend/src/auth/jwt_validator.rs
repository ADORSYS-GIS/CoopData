use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm, TokenData};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub iss: String,
    pub aud: Option<serde_json::Value>,
    pub preferred_username: Option<String>,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub realm_access: Option<RealmAccess>,
    pub resource_access: Option<ResourceAccess>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RealmAccess {
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceAccess {
    #[serde(flatten)]
    pub resources: std::collections::HashMap<String, ResourceRoles>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceRoles {
    pub roles: Vec<String>,
}

#[derive(Debug, Error)]
pub enum JwtError {
    #[error("Invalid token: {0}")]
    InvalidToken(#[from] jsonwebtoken::errors::Error),
    #[error("Token expired")]
    ExpiredToken,
    #[error("Invalid issuer: expected {expected}, got {actual}")]
    InvalidIssuer { expected: String, actual: String },
    #[error("Invalid audience")]
    InvalidAudience,
    #[error("Missing required claim: {0}")]
    MissingClaim(String),
    #[error("Failed to fetch JWKS from Keycloak: {0}")]
    JwksFetchError(String),
}

#[derive(Clone)]
pub struct JwtValidator {
    decoding_key: DecodingKey,
    validation: Validation,
    issuer: String,
    valid_audiences: HashSet<String>,
}

impl JwtValidator {
    pub fn new(issuer: &str, audiences: &[String], public_key_pem: &str) -> Result<Self, JwtError> {
        let decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
            .map_err(JwtError::InvalidToken)?;

        let valid_audiences: HashSet<String> = audiences.iter().cloned().collect();

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[issuer]);
        validation.validate_exp = true;
        validation.validate_nbf = false;

        let aud_strings: Vec<String> = valid_audiences.iter().cloned().collect();
        validation.set_audience(&aud_strings);

        Ok(Self {
            decoding_key,
            validation,
            issuer: issuer.to_string(),
            valid_audiences,
        })
    }

    pub async fn from_keycloak(keycloak_url: &str, realm: &str, audiences: &[String]) -> Result<Self, JwtError> {
        let certs_url = format!("{}/realms/{}/protocol/openid-connect/certs", keycloak_url, realm);

        let client = reqwest::Client::new();
        let response = client
            .get(&certs_url)
            .send()
            .await
            .map_err(|e| JwtError::JwksFetchError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(JwtError::JwksFetchError(format!(
                "Failed to fetch JWKS: status {}",
                response.status()
            )));
        }

        let jwks: JwksResponse = response
            .json()
            .await
            .map_err(|e| JwtError::JwksFetchError(format!("Failed to parse JWKS: {}", e)))?;

        let key = jwks.keys.first()
            .ok_or_else(|| JwtError::JwksFetchError("No keys found in JWKS response".to_string()))?;

        let decoding_key = DecodingKey::from_rsa_components(&key.n, &key.e)
            .map_err(JwtError::InvalidToken)?;

        let issuer = format!("{}/realms/{}", keycloak_url, realm);

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&issuer]);
        validation.validate_exp = true;
        validation.validate_nbf = false;

        let aud_strings: Vec<String> = audiences.iter().cloned().collect();
        validation.set_audience(&aud_strings);

        let valid_audiences: HashSet<String> = audiences.iter().cloned().collect();

        Ok(Self {
            decoding_key,
            validation,
            issuer,
            valid_audiences,
        })
    }

    pub fn validate(&self, token: &str) -> Result<Claims, JwtError> {
        let token_data: TokenData<Claims> = decode(token, &self.decoding_key, &self.validation)
            .map_err(JwtError::InvalidToken)?;

        if token_data.claims.iss != self.issuer {
            return Err(JwtError::InvalidIssuer {
                expected: self.issuer.clone(),
                actual: token_data.claims.iss,
            });
        }

        if !self.is_valid_audience(&token_data.claims) {
            return Err(JwtError::InvalidAudience);
        }

        Ok(token_data.claims)
    }

    fn is_valid_audience(&self, claims: &Claims) -> bool {
        match &claims.aud {
            Some(serde_json::Value::String(s)) => self.valid_audiences.contains(s),
            Some(serde_json::Value::Array(arr)) => {
                arr.iter().any(|v| {
                    v.as_str()
                        .map(|s| self.valid_audiences.contains(s))
                        .unwrap_or(false)
                })
            }
            Some(serde_json::Value::Null) | None => false,
            _ => false,
        }
    }

    pub fn extract_roles(&self, claims: &Claims) -> HashSet<String> {
        let mut roles = HashSet::new();

        if let Some(realm_access) = &claims.realm_access {
            roles.extend(realm_access.roles.iter().cloned());
        }

        roles
    }

    pub fn has_role(&self, claims: &Claims, role: &str) -> bool {
        claims.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }
}

impl Claims {
    pub fn user_id(&self) -> &str {
        &self.sub
    }

    pub fn username(&self) -> Option<&str> {
        self.preferred_username.as_deref()
    }

    pub fn is_admin(&self) -> bool {
        self.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == "admin"))
            .unwrap_or(false)
    }
}

#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct JwkKey {
    n: String,
    e: String,
    kty: Option<String>,
    alg: Option<String>,
    kid: Option<String>,
    r#use: Option<String>,
}