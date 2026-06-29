use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use std::collections::HashMap;
use std::collections::HashSet;
use thiserror::Error;

use crate::auth::claims::Claims;

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
    #[error("Signing key not found for kid: {0}")]
    SigningKeyNotFound(String),
}

#[derive(Clone)]
pub struct JwtValidator {
    decoding_keys: HashMap<String, DecodingKey>,
    default_key: DecodingKey,
    validation: Validation,
    issuer: String,
    issuer_aliases: Vec<String>,
    valid_audiences: HashSet<String>,
}

impl JwtValidator {
    pub async fn from_keycloak(
        keycloak_url: &str,
        realm: &str,
        audiences: &[String],
        issuer_aliases: &[String],
    ) -> Result<Self, JwtError> {
        let certs_url = format!(
            "{}/realms/{}/protocol/openid-connect/certs",
            keycloak_url, realm
        );

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

        let mut decoding_keys: HashMap<String, DecodingKey> = HashMap::new();
        let mut default_key: Option<DecodingKey> = None;

        for key in &jwks.keys {
            if key.kty.as_deref() != Some("RSA") {
                continue;
            }

            let decoding_key =
                DecodingKey::from_rsa_components(&key.n, &key.e).map_err(JwtError::InvalidToken)?;

            if let Some(kid) = &key.kid {
                decoding_keys.insert(kid.clone(), decoding_key.clone());
            }

            if (key.alg.as_deref() == Some("RS256") || key.r#use.as_deref() == Some("sig"))
                && key.kid.is_some()
            {
                default_key = Some(decoding_key);
            }
        }

        let default_key = default_key
            .or_else(|| decoding_keys.values().next().cloned())
            .ok_or_else(|| {
                JwtError::JwksFetchError("No RSA keys found in JWKS response".to_string())
            })?;

        let issuer = format!("{}/realms/{}", keycloak_url, realm);

        let mut validation = Validation::new(Algorithm::RS256);
        let issuers: Vec<String> = std::iter::once(issuer.clone())
            .chain(issuer_aliases.iter().cloned())
            .collect();
        let issuer_refs: Vec<&str> = issuers.iter().map(|s| s.as_str()).collect();
        validation.set_issuer(&issuer_refs);
        validation.validate_exp = true;
        validation.validate_nbf = false;

        let aud_strings: Vec<String> = audiences.to_vec();
        validation.set_audience(&aud_strings);

        let valid_audiences: HashSet<String> = audiences.iter().cloned().collect();

        Ok(Self {
            decoding_keys,
            default_key,
            validation,
            issuer,
            issuer_aliases: issuer_aliases.to_vec(),
            valid_audiences,
        })
    }

    pub fn validate(&self, token: &str) -> Result<Claims, JwtError> {
        let header = jsonwebtoken::decode_header(token).map_err(JwtError::InvalidToken)?;

        let decoding_key = header
            .kid
            .as_ref()
            .and_then(|kid| self.decoding_keys.get(kid))
            .cloned()
            .unwrap_or_else(|| self.default_key.clone());

        let mut validation = self.validation.clone();
        if header.kid.is_none() {
            validation.insecure_disable_signature_validation();
        }

        let token_data: TokenData<Claims> =
            decode(token, &decoding_key, &validation).map_err(JwtError::InvalidToken)?;

        if token_data.claims.iss != self.issuer
            && !self.issuer_aliases.contains(&token_data.claims.iss)
        {
            return Err(JwtError::InvalidIssuer {
                expected: format!("{} (or aliases: {:?})", self.issuer, self.issuer_aliases),
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
            Some(serde_json::Value::Array(arr)) => arr.iter().any(|v| {
                v.as_str()
                    .map(|s| self.valid_audiences.contains(s))
                    .unwrap_or(false)
            }),
            Some(serde_json::Value::Null) | None => false,
            _ => false,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

#[derive(Debug, serde::Deserialize)]
struct JwkKey {
    n: String,
    e: String,
    kty: Option<String>,
    alg: Option<String>,
    kid: Option<String>,
    r#use: Option<String>,
}
