use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub iss: String,
    pub aud: String,
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
    #[error("Invalid issuer")]
    InvalidIssuer,
    #[error("Invalid audience")]
    InvalidAudience,
    #[error("Missing required claim: {0}")]
    MissingClaim(String),
}

pub struct JwtValidator {
    decoding_key: DecodingKey,
    validation: Validation,
    issuer: String,
    audience: String,
}

impl JwtValidator {
    pub fn new(issuer: &str, audience: &str, public_key: &str) -> Result<Self, JwtError> {
        let decoding_key =
            DecodingKey::from_rsa_pem(public_key.as_bytes()).map_err(JwtError::InvalidToken)?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[issuer]);
        validation.set_audience(&[audience]);
        validation.validate_exp = true;
        validation.validate_nbf = false;

        Ok(Self {
            decoding_key,
            validation,
            issuer: issuer.to_string(),
            audience: audience.to_string(),
        })
    }

    pub fn validate(&self, token: &str) -> Result<Claims, JwtError> {
        let token_data: TokenData<Claims> =
            decode(token, &self.decoding_key, &self.validation).map_err(JwtError::InvalidToken)?;

        if token_data.claims.iss != self.issuer {
            return Err(JwtError::InvalidIssuer);
        }

        if token_data.claims.aud != self.audience {
            return Err(JwtError::InvalidAudience);
        }

        Ok(token_data.claims)
    }

    pub fn extract_roles(&self, claims: &Claims) -> HashSet<String> {
        let mut roles = HashSet::new();

        if let Some(realm_access) = &claims.realm_access {
            roles.extend(realm_access.roles.iter().cloned());
        }

        roles
    }

    pub fn has_role(&self, claims: &Claims, role: &str) -> bool {
        claims
            .realm_access
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
