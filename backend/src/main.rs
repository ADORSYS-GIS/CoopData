use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use coop_data_backend::{
    api::routes::create_app, auth::JwtValidator, config::AppConfig, database,
    services::cache::CacheService, services::keycloak::KeycloakService, AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file if present (dev convenience — production uses real env vars)
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env()?;
    tracing::info!("Configuration loaded");

    let db = connect_db_with_retry(&config.database_url).await?;
    tracing::info!("Database connected");

    let cache = CacheService::new(&config.redis_url).await?;
    tracing::info!("Redis cache connected");

    let keycloak = KeycloakService::new(&config);

    tracing::info!("Initializing JWT validator from Keycloak JWKS...");
    let jwt_validator = init_jwt_validator_with_retry(&config).await?;
    tracing::info!("JWT validator initialized (issuer: {})", config.jwt_issuer);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    tracing::info!("Server listening on {}", addr);
    tracing::info!("Swagger UI available at http://{}/swagger-ui/", addr);

    let state = AppState {
        db,
        config,
        cache,
        keycloak,
        jwt_validator,
    };
    let app = create_app(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn init_jwt_validator_with_retry(
    config: &AppConfig,
) -> anyhow::Result<std::sync::Arc<JwtValidator>> {
    let max_retries = 30u32;
    let mut attempt = 0;

    loop {
        attempt += 1;
        match JwtValidator::from_keycloak(
            &config.keycloak_url,
            &config.keycloak_realm,
            &config.jwt_audiences(),
            &config.jwt_issuer_aliases,
        )
        .await
        {
            Ok(validator) => return Ok(std::sync::Arc::new(validator)),
            Err(e) => {
                if attempt >= max_retries {
                    tracing::error!(
                        "Failed to initialize JWT validator after {} attempts: {}",
                        attempt,
                        e
                    );
                    return Err(anyhow::anyhow!("Failed to initialize JWT validator: {}", e));
                }
                tracing::warn!(
                    attempt,
                    max_retries,
                    error = %e,
                    "Waiting for Keycloak JWKS endpoint... retrying in 2s",
                );
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        }
    }
}

async fn connect_db_with_retry(database_url: &str) -> anyhow::Result<coop_data_backend::Database> {
    let max_retries = 20u32;
    let mut attempt = 0;

    loop {
        attempt += 1;
        match database::connect(database_url).await {
            Ok(db) => return Ok(db),
            Err(e) => {
                if attempt >= max_retries {
                    tracing::error!(
                        "Failed to connect to database after {} attempts: {}",
                        attempt,
                        e
                    );
                    return Err(anyhow::anyhow!("Database connection failed: {}", e));
                }
                tracing::warn!(
                    attempt,
                    max_retries,
                    error = %e,
                    "Waiting for database... retrying in 3s",
                );
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
        }
    }
}
