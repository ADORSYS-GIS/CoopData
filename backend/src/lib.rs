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
pub use error::{AppError, AppResult};
pub use services::keycloak::KeycloakService;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
    pub keycloak: KeycloakService,
    pub jwt_validator: std::sync::Arc<auth::JwtValidator>,
}
