use std::sync::Arc;

use coop_data_backend::auth::JwtValidator;
use coop_data_backend::config::Environment;
use coop_data_backend::services::cache::CacheService;
use coop_data_backend::{
    ApexRepository, AppConfig, AppState, AuditLogRepository, AuditService,
    CooperativeRepository, FederationRepository, KeycloakService, OrganizationRepository,
    UserRepository,
};
use sea_orm::DatabaseConnection;

/// A test application with a disconnected database, an offline Redis client
/// (never contacted in DB-free tests), a no-op Keycloak client, and a permissive
/// JWT validator. Only suitable for tests that do not require a live backend.
pub struct TestApp {
    pub state: AppState,
}

impl TestApp {
    pub async fn new() -> Self {
        let config = test_config();
        let db = DatabaseConnection::default();
        let cache = CacheService::new("redis://localhost:6379")
            .await
            .expect("Failed to create cache service");
        let keycloak = KeycloakService::new(&config);
        let jwt_validator = Arc::new(JwtValidator::new_for_testing());

        let federation_repo = FederationRepository::new(db.clone());
        let apex_repo = ApexRepository::new(db.clone());
        let cooperative_repo = CooperativeRepository::new(db.clone());
        let organization_repo = OrganizationRepository::new(db.clone());
        let user_repo = UserRepository::new(db.clone());
        let audit = AuditService::new(
            AuditLogRepository::new(db.clone()),
            user_repo.clone(),
        );

        let state = AppState {
            db,
            config,
            cache,
            keycloak,
            jwt_validator,
            federation_repo,
            apex_repo,
            cooperative_repo,
            organization_repo,
            user_repo,
            audit,
        };

        TestApp { state }
    }
}

/// Build an `AppConfig` populated with dummy-but-valid values for tests.
/// No environment variables are required.
pub fn test_config() -> AppConfig {
    AppConfig {
        host: "0.0.0.0".to_string(),
        port: 3000,
        database_url: "postgres://test:test@localhost:5432/test_db".to_string(),
        redis_url: "redis://localhost:6379".to_string(),
        keycloak_url: "http://localhost:8080".to_string(),
        keycloak_realm: "test-realm".to_string(),
        keycloak_client_id: "test-client".to_string(),
        keycloak_client_secret: "test-secret".to_string(),
        jwt_issuer: "test-issuer".to_string(),
        jwt_audience: "test-audience".to_string(),
        jwt_issuer_aliases: vec![],
        frontend_url: "http://localhost:5173".to_string(),
        environment: Environment::Development,
    }
}
