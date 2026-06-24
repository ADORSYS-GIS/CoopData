pub mod api;
pub mod auth;
pub mod config;
pub mod database;
pub mod entities;
pub mod error;
pub mod models;
pub mod repositories;
pub mod services;

pub use config::AppConfig;
pub use database::Database;
pub use error::{AppError, AppResult};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
}