use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal server error: {0}")]
    InternalServerError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sea_orm::DbErr),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("External service error: {0}")]
    ExternalServiceError(String),

    #[error("Forbidden: missing required role(s): {required_roles:?}")]
    MissingRole {
        message: String,
        required_roles: Vec<String>,
    },
}

/// Error response structure for API errors.
/// Provides consistent error format across all endpoints.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_roles: Option<Vec<String>>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_response) = match &self {
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    error: "bad_request".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                ErrorResponse {
                    error: "unauthorized".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::Forbidden(msg) => (
                StatusCode::FORBIDDEN,
                ErrorResponse {
                    error: "forbidden".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::MissingRole { message, required_roles } => (
                StatusCode::FORBIDDEN,
                ErrorResponse {
                    error: "forbidden".to_string(),
                    message: Some(message.clone()),
                    required_roles: Some(required_roles.clone()),
                },
            ),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                ErrorResponse {
                    error: "not_found".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                ErrorResponse {
                    error: "conflict".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::InternalServerError(_) => {
                tracing::error!("Internal server error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorResponse {
                        error: "internal_server_error".to_string(),
                        message: Some("An internal error occurred".to_string()),
                        required_roles: None,
                    },
                )
            }
            AppError::DatabaseError(err) => {
                tracing::error!("Database error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorResponse {
                        error: "database_error".to_string(),
                        message: Some("Failed to process database request".to_string()),
                        required_roles: None,
                    },
                )
            }
            AppError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorResponse {
                    error: "validation_error".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                },
            ),
            AppError::CacheError(_) => {
                tracing::error!("Cache error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorResponse {
                        error: "cache_error".to_string(),
                        message: Some("Failed to process cache request".to_string()),
                        required_roles: None,
                    },
                )
            }
            AppError::ExternalServiceError(_) => {
                tracing::error!("External service error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorResponse {
                        error: "external_service_error".to_string(),
                        message: Some("Failed to communicate with external service".to_string()),
                        required_roles: None,
                    },
                )
            }
        };

        (status, Json(json!(error_response))).into_response()
    }
}

impl From<redis::RedisError> for AppError {
    fn from(err: redis::RedisError) -> Self {
        AppError::CacheError(err.to_string())
    }
}

/// Helper function to create a forbidden error with role requirements.
pub fn forbidden_with_roles(message: impl Into<String>, required_roles: Vec<&'static str>) -> AppError {
    AppError::MissingRole {
        message: message.into(),
        required_roles: required_roles.iter().map(|s| s.to_string()).collect(),
    }
}