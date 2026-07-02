use once_cell::sync::Lazy;
use serde::Deserialize;
use std::env;

static CONFIG: Lazy<AppConfig> = Lazy::new(AppConfig::from_env_unchecked);

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub keycloak_url: String,
    pub keycloak_realm: String,
    pub keycloak_client_id: String,
    pub keycloak_client_secret: String,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub jwt_issuer_aliases: Vec<String>,
    pub frontend_url: String,
    pub environment: Environment,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub enum Environment {
    Development,
    Staging,
    Production,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .and_then(|s| s.parse().map_err(|_| env::VarError::NotPresent))
                .unwrap_or(3000),
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
            keycloak_url: env::var("KEYCLOAK_URL").expect("KEYCLOAK_URL must be set"),
            keycloak_realm: env::var("KEYCLOAK_REALM").unwrap_or_else(|_| "coopdata".into()),
            keycloak_client_id: env::var("KEYCLOAK_CLIENT_ID")
                .expect("KEYCLOAK_CLIENT_ID must be set"),
            keycloak_client_secret: env::var("KEYCLOAK_CLIENT_SECRET")
                .expect("KEYCLOAK_CLIENT_SECRET must be set"),
            jwt_issuer: env::var("JWT_ISSUER").unwrap_or_else(|_| "coopdata".into()),
            jwt_audience: env::var("JWT_AUDIENCE").unwrap_or_else(|_| "coopdata-api".into()),
            jwt_issuer_aliases: env::var("JWT_ISSUER_ALIASES")
                .unwrap_or_else(|_| String::new())
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            frontend_url: env::var("FRONTEND_URL").expect("FRONTEND_URL must be set"),
            environment: env::var("ENVIRONMENT")
                .map(|s| match s.to_lowercase().as_str() {
                    "production" => Environment::Production,
                    "staging" => Environment::Staging,
                    _ => Environment::Development,
                })
                .unwrap_or(Environment::Development),
        })
    }

    fn from_env_unchecked() -> Self {
        Self::from_env().expect("Failed to load configuration from environment")
    }

    pub fn global() -> &'static Self {
        &CONFIG
    }

    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }

    pub fn jwt_audiences(&self) -> Vec<String> {
        vec![
            self.keycloak_client_id.clone(),
            "coopdata-frontend".to_string(),
            "coopdata-backend".to_string(),
        ]
    }

    pub fn is_development(&self) -> bool {
        self.environment == Environment::Development
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_production_true() {
        let config = AppConfig {
            host: "0.0.0.0".into(),
            port: 3000,
            database_url: "x".into(),
            redis_url: "x".into(),
            keycloak_url: "x".into(),
            keycloak_realm: "x".into(),
            keycloak_client_id: "x".into(),
            keycloak_client_secret: "x".into(),
            jwt_issuer: "x".into(),
            jwt_audience: "x".into(),
            jwt_issuer_aliases: vec![],
            frontend_url: "x".into(),
            environment: Environment::Production,
        };
        assert!(config.is_production());
        assert!(!config.is_development());
    }

    #[test]
    fn test_is_development_true() {
        let config = AppConfig {
            host: "0.0.0.0".into(),
            port: 3000,
            database_url: "x".into(),
            redis_url: "x".into(),
            keycloak_url: "x".into(),
            keycloak_realm: "x".into(),
            keycloak_client_id: "x".into(),
            keycloak_client_secret: "x".into(),
            jwt_issuer: "x".into(),
            jwt_audience: "x".into(),
            jwt_issuer_aliases: vec![],
            frontend_url: "x".into(),
            environment: Environment::Development,
        };
        assert!(config.is_development());
        assert!(!config.is_production());
    }

    #[test]
    fn test_jwt_audiences_includes_defaults() {
        let config = AppConfig {
            host: "0.0.0.0".into(),
            port: 3000,
            database_url: "x".into(),
            redis_url: "x".into(),
            keycloak_url: "x".into(),
            keycloak_realm: "x".into(),
            keycloak_client_id: "my-client".into(),
            keycloak_client_secret: "x".into(),
            jwt_issuer: "x".into(),
            jwt_audience: "x".into(),
            jwt_issuer_aliases: vec![],
            frontend_url: "x".into(),
            environment: Environment::Development,
        };
        let audiences = config.jwt_audiences();
        assert!(audiences.contains(&"my-client".to_string()));
        assert!(audiences.contains(&"coopdata-frontend".to_string()));
        assert!(audiences.contains(&"coopdata-backend".to_string()));
        assert_eq!(audiences.len(), 3);
    }
}
