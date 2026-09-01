# Rust Error Handling Guide

> **Goal**: Build robust, type-safe error handling that provides clear feedback to clients and maintains system stability.
> **Rule**: EVERY function that can fail MUST return a `Result` type. NEVER panic in production code.

## File Structure

```
src/
├── error.rs                    # Central error types and implementations
└── api/
    └── handlers/
        └── *.rs                # Handlers return AppResult<T>
```

---

## Pattern 1: Central Error Enum

**File**: `src/error.rs`

```rust
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Central error type for the entire application.
/// All errors should be converted to this type using From implementations.
#[derive(Error, Debug)]
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

    #[error("Conflict: {message}")]
    ConflictWithSubmission {
        message: String,
        submission_id: Uuid,
    },

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

    #[error("Precondition required: {0}")]
    PreconditionRequired(String),

    #[error("Forbidden: missing required role(s): {required_roles:?}")]
    MissingRole {
        message: String,
        required_roles: Vec<String>,
    },
}

/// Type alias for Result with AppError
pub type AppResult<T> = Result<T, AppError>;

/// Error response structure for API errors
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_roles: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submission_id: Option<String>,
}

/// Convert AppError into HTTP responses
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_response) = match &self {
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    error: "bad_request".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                ErrorResponse {
                    error: "unauthorized".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::Forbidden(msg) => (
                StatusCode::FORBIDDEN,
                ErrorResponse {
                    error: "forbidden".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                ErrorResponse {
                    error: "not_found".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                ErrorResponse {
                    error: "conflict".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::ConflictWithSubmission { message, submission_id } => (
                StatusCode::CONFLICT,
                ErrorResponse {
                    error: "conflict".to_string(),
                    message: Some(message.clone()),
                    required_roles: None,
                    submission_id: Some(submission_id.to_string()),
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
                        submission_id: None,
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
                        submission_id: None,
                    },
                )
            }
            AppError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                ErrorResponse {
                    error: "validation_error".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::CacheError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                ErrorResponse {
                    error: "cache_error".to_string(),
                    message: Some("Failed to process cache request".to_string()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::ExternalServiceError(msg) => (
                StatusCode::BAD_GATEWAY,
                ErrorResponse {
                    error: "external_service_error".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::PreconditionRequired(msg) => (
                StatusCode::PRECONDITION_REQUIRED,
                ErrorResponse {
                    error: "precondition_required".to_string(),
                    message: Some(msg.clone()),
                    required_roles: None,
                    submission_id: None,
                },
            ),
            AppError::MissingRole { message, required_roles } => (
                StatusCode::FORBIDDEN,
                ErrorResponse {
                    error: "forbidden".to_string(),
                    message: Some(message.clone()),
                    required_roles: Some(required_roles.clone()),
                    submission_id: None,
                },
            ),
        };

        (status, Json(json!(error_response))).into_response()
    }
}

/// Helper function for forbidden errors with roles
pub fn forbidden_with_roles(
    message: impl Into<String>,
    required_roles: Vec<&'static str>,
) -> AppError {
    AppError::MissingRole {
        message: message.into(),
        required_roles: required_roles.iter().map(|s| s.to_string()).collect(),
    }
}
```

**Why**:

- Single source of truth for all error types
- Automatic conversion via `#[from]` attribute
- Structured logging for debugging
- Safe error messages to clients (no internals exposed)
- HTTP status codes are mapped consistently
- `ErrorResponse` struct for consistent JSON format

---

## Pattern 2: Error Propagation with Context

**File**: Handler with context

```rust
use crate::error::{AppError, AppResult};
use uuid::Uuid;

/// Handler that demonstrates proper error propagation
pub async fn get_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = UserRepository::new(state.db.clone());
    
    // Repository call with automatic error conversion
    let user = repo.find_by_id(user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                user_id = %user_id,
                error = %e,
                "Failed to fetch user"
            );
            AppError::InternalServerError(
                format!("Failed to retrieve user: {}", user_id)
            )
        })?
        .ok_or_else(|| {
            AppError::NotFound(format!("User not found: {}", user_id))
        })?;

    Ok(Json(UserResponse::from(user)))
}
```

**Why**:

- `?` operator for clean error propagation
- `map_err` adds context and logging
- `ok_or_else` converts Option to Result
- Repository created with `new()` pattern

---

## Pattern 3: External Service Error Handling

**File**: Service layer error handling

```rust
use crate::error::{AppError, AppResult};

impl KeycloakService {
    /// All external service calls should handle errors explicitly
    pub async fn get_user_by_id(
        &self,
        user_id: &str,
    ) -> AppResult<KeycloakUser> {
        let url = format!(
            "{}/admin/realms/{}/users/{}",
            self.config.keycloak.url,
            self.config.keycloak.realm,
            user_id
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                tracing::error!(
                    user_id = %user_id,
                    error = %e,
                    "Keycloak request failed"
                );
                AppError::ExternalServiceError(
                    "Authentication service unavailable".to_string()
                )
            })?;

        match response.status() {
            StatusCode::OK => {
                response.json::<KeycloakUser>()
                    .await
                    .map_err(|e| {
                        tracing::error!(
                            user_id = %user_id,
                            error = %e,
                            "Failed to deserialize user"
                        );
                        AppError::InternalServerError(
                            "Failed to process user data".to_string()
                        )
                    })
            }
            StatusCode::NOT_FOUND => {
                Err(AppError::NotFound(format!("User not found: {}", user_id)))
            }
            StatusCode::UNAUTHORIZED => {
                Err(AppError::Unauthorized("Invalid or expired token".to_string()))
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                tracing::error!(
                    status = %status,
                    error = %error_text,
                    user_id = %user_id,
                    "Unexpected Keycloak error"
                );
                Err(AppError::ExternalServiceError(
                    format!("Authentication service error: {}", status)
                ))
            }
        }
    }
}
```

---

## Pattern 4: Database Transaction Errors

**File**: Repository with transaction handling

```rust
use sea_orm::*;
use crate::error::{AppError, AppResult};
use uuid::Uuid;

impl SubmissionRepository {
    /// Create submission with sections in a transaction
    pub async fn create_with_sections(
        &self,
        submission: ActiveModel,
        sections: Vec<SubmissionSectionActiveModel>,
    ) -> AppResult<submission::Model> {
        // Start transaction
        let txn = self.db.begin().await.map_err(|e| {
            tracing::error!(error = %e, "Failed to begin transaction");
            AppError::DatabaseError(e)
        })?;

        // Create submission
        let created = submission.insert(&txn)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to insert submission");
                AppError::DatabaseError(e)
            })?;

        // Create all sections
        for mut section in sections {
            section.submission_id = Set(created.id);
            section.insert(&txn)
                .await
                .map_err(|e| {
                    tracing::error!(error = %e, "Failed to insert section");
                    AppError::DatabaseError(e)
                })?;
        }

        // Commit transaction
        txn.commit().await.map_err(|e| {
            tracing::error!(error = %e, "Failed to commit transaction");
            AppError::DatabaseError(e)
        })?;

        tracing::info!(
            submission_id = %created.id,
            "Submission created successfully"
        );

        Ok(created)
    }
}
```

---

## Pattern 5: Cache Error Handling

**File**: Service with fallback

```rust
use crate::error::AppResult;

impl CacheService {
    /// Get with fallback to database
    pub async fn get_with_fallback<T>(
        &self,
        key: &str,
        db_fetch: impl Future<Output = AppResult<T>>,
    ) -> AppResult<T>
    where
        T: serde::Serialize + for<'de> serde::Deserialize<'de> + Clone,
    {
        // Try cache first
        match self.get::<T>(key).await {
            Ok(Some(value)) => {
                tracing::debug!(key = %key, "Cache hit");
                return Ok(value);
            }
            Ok(None) => {
                tracing::debug!(key = %key, "Cache miss");
            }
            Err(e) => {
                // Log but don't fail - fallback to database
                tracing::warn!(
                    key = %key,
                    error = %e,
                    "Cache error, falling back to database"
                );
            }
        }

        // Fetch from database
        let value = db_fetch.await?;

        // Store in cache asynchronously (fire and forget)
        let cache = self.clone();
        let key = key.to_string();
        let value_clone = value.clone();
        tokio::spawn(async move {
            if let Err(e) = cache.set(&key, &value_clone).await {
                tracing::warn!(key = %key, error = %e, "Failed to cache value");
            }
        });

        Ok(value)
    }
}
```

---

## Best Practices

1. **Never Panic**: Use `Result` instead of `unwrap()` or `expect()`
2. **Always Log**: Include error context in logs
3. **Safe Messages**: Don't expose internals in error messages
4. **Typed Errors**: Use strongly typed error variants
5. **Propagation**: Use `?` operator with context
6. **Transactions**: Handle rollback and commit errors
7. **External Services**: Wrap and convert all external errors
8. **Validation**: Provide structured error details
9. **Recovery**: Implement fallbacks for non-critical failures
10. **Tracing**: Use `instrument` for request tracing

## Checklist

- [ ] All fallible functions return `Result`
- [ ] `AppError` enum covers all error cases
- [ ] `IntoResponse` implemented for error types
- [ ] Errors are logged with context
- [ ] No `unwrap()` or `expect()` in handlers
- [ ] Validation errors include field names
- [ ] External service errors are wrapped
- [ ] Transactions handle rollback properly
- [ ] Request size limits are enforced
- [ ] Error responses are JSON with consistent format
