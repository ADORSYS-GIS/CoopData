pub mod api;
pub mod auth;
pub mod config;
pub mod database;
pub mod entities;
pub mod error;
pub mod models;
pub mod repositories;
pub mod services;
pub mod utils;

pub use config::AppConfig;
pub use database::Database;
pub use error::{forbidden_with_roles, AppError, AppResult};
pub use repositories::audit_log::AuditLogRepository;
pub use repositories::{
    ApexRepository, CooperativeRepository, FederationRepository, OrganizationRepository,
    UserRepository,
};
pub use services::keycloak::KeycloakService;
pub use services::AuditService;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
    pub keycloak: KeycloakService,
    pub jwt_validator: std::sync::Arc<auth::JwtValidator>,
    pub federation_repo: FederationRepository,
    pub apex_repo: ApexRepository,
    pub cooperative_repo: CooperativeRepository,
    pub organization_repo: OrganizationRepository,
    pub user_repo: UserRepository,
    pub audit: AuditService,
}
