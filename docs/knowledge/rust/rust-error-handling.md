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
    #[error("Database error: {0}")]
    DatabaseError(#[from] sea_orm::DbErr),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal server error: {0}")]
    InternalServerError(String),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("File storage error: {0}")]
    FileStorageError(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("External service error: {0}")]
    ExternalServiceError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
}

/// Type alias for Result with AppError
pub type AppResult<T> = Result<T, AppError>;

/// Convert AppError into HTTP responses
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::DatabaseError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
            }
            AppError::ValidationError(_) => {
                (StatusCode::BAD_REQUEST, "Validation error")
            }
            AppError::NotFound(_) => {
                (StatusCode::NOT_FOUND, "Resource not found")
            }
            AppError::Unauthorized(_) => {
                (StatusCode::UNAUTHORIZED, "Unauthorized")
            }
            AppError::BadRequest(_) => {
                (StatusCode::BAD_REQUEST, "Bad request")
            }
            AppError::InternalServerError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
            AppError::AuthError(_) => {
                (StatusCode::UNAUTHORIZED, "Authentication error")
            }
            AppError::FileStorageError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "File storage error")
            }
            AppError::Conflict(_) => {
                (StatusCode::CONFLICT, "Conflict")
            }
            AppError::ExternalServiceError(_) => {
                (StatusCode::BAD_GATEWAY, "External service error")
            }
            AppError::RateLimitExceeded(_) => {
                (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded")
            }
            AppError::AnyhowError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
            }
        };

        // Log the error for debugging (but don't expose internals to client)
        tracing::error!(
            status_code = status.as_u16(),
            error = %self,
            "Request failed"
        );

        let body = Json(json!({
            "error": error_message,
            "message": self.to_string(),
            "code": status.as_u16(),
        }));

        (status, body).into_response()
    }
}
```

**Why**:
- Single source of truth for all error types
- Automatic conversion via `#[from]` attribute
- Structured logging for debugging
- Safe error messages to clients (no internals exposed)
- HTTP status codes are mapped consistently

---

## Pattern 2: Validation Errors with Details

**File**: `src/error.rs` (extension)

```rust
use serde::Serialize;

/// Detailed validation error for structured error responses
#[derive(Debug, Serialize)]
pub struct ValidationErrorDetail {
    pub field: String,
    pub message: String,
    pub code: String,
}

impl ValidationErrorDetail {
    pub fn new(field: impl Into<String>, message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
            code: code.into(),
        }
    }
}

/// Multiple validation errors
#[derive(Debug, Error)]
pub struct ValidationErrors {
    pub errors: Vec<ValidationErrorDetail>,
}

impl ValidationErrors {
    pub fn new(errors: Vec<ValidationErrorDetail>) -> Self {
        Self { errors }
    }

    pub fn single(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            errors: vec![ValidationErrorDetail::new(field, message, "validation_failed")],
        }
    }
}

impl IntoResponse for ValidationErrors {
    fn into_response(self) -> Response {
        tracing::warn!(
            errors = ?self.errors,
            "Validation failed"
        );

        let body = Json(json!({
            "error": "Validation error",
            "details": self.errors,
            "code": 400,
        }));

        (StatusCode::BAD_REQUEST, body).into_response()
    }
}
```

**Usage in handlers**:

```rust
use crate::error::{AppError, ValidationErrors, ValidationErrorDetail};

pub async fn create_user(
    Json(payload): Json<CreateUserRequest>,
) -> AppResult<impl IntoResponse> {
    // Validation with detailed errors
    let mut errors = Vec::new();

    if payload.email.is_empty() {
        errors.push(ValidationErrorDetail::new(
            "email","Email is required",
            "required_field"
        ));
    }

    if payload.name.len() < 2 {
        errors.push(ValidationErrorDetail::new(
            "name","Name must be at least 2 characters",
            "min_length"
        ));
    }

    if !errors.is_empty() {
        return Err(AppError::ValidationError(
            ValidationErrors::new(errors).to_string()
        ));
    }

    // ... rest of handler
    Ok((StatusCode::CREATED, Json(created_user)))
}
```

---

## Pattern 3: Error Propagation with Context

**File**: Handler with context

```rust
use crate::error::{AppError, AppResult};
use tracing::instrument;

/// Handler that demonstrates proper error propagation
#[instrument(skip(state), fields(user_id = %user_id))]
pub async fn get_user(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    // Repository call with automatic error conversion
    let user = UserRepository::find_by_id(&state.db, &user_id)
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

    Ok(Json(user))
}
```

**Why**:
- `?` operator for clean error propagation
- `map_err` adds context and logging
- `ok_or_else` converts Option to Result
- `instrument` attribute for tracing

---

## Pattern 4: External Service Error Handling

**File**: Service layer error handling

```rust
use anyhow::Context;
use crate::error::{AppError, AppResult};

impl KeycloakService {
    /// All external service calls should handle errors explicitly
    pub async fn get_user_by_id(
        &self,
        token: &str,
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
            .bearer_auth(token)
            .send()
            .await
            .context("Failed to send request to Keycloak")
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
                    .context("Failed to parse Keycloak response")
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

## Pattern 5: Database Transaction Errors

**File**: Repository with transaction handling

```rust
use sea_orm::*;
use crate::error::{AppError, AppResult};
use uuid::Uuid;

impl UserRepository {
    /// Create user with transaction and rollback on error
    pub async fn create_with_audit(
        db: &DbConn,
        user_data: users::ActiveModel,
        audit_data: audit_logs::ActiveModel,
    ) -> AppResult<users::Model> {
        // Start transaction
        let txn = db.begin().await.map_err(|e| {
            tracing::error!(error = %e, "Failed to begin transaction");
            AppError::DatabaseError(e)
        })?;

        // Create user
        let user = users::ActiveModel {
            ..user_data
        }
        .insert(&txn)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to insert user");
            AppError::DatabaseError(e)
        })?;

        // Create audit log
        audit_logs::ActiveModel {
            user_id: Set(user.id),
            action: Set("user_created".to_string()),
            ..audit_data
        }
        .insert(&txn)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to insert audit log");
            AppError::DatabaseError(e)
        })?;

        // Commit transaction
        txn.commit().await.map_err(|e| {
            tracing::error!(error = %e, "Failed to commit transaction");
            AppError::DatabaseError(e)
        })?;

        tracing::info!(
            user_id = %user.id,
            "User created successfully"
        );

        Ok(user)
    }
}
```

---

## Pattern 6: Request Validation Middleware

**File**: `src/api/middleware/validation.rs`

```rust
use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
};
use crate::error::AppError;

/// Request size limit middleware
pub async fn limit_request_size(
    req: Request,
    next: Next,
) -> Result<impl IntoResponse, AppError> {
    const MAX_SIZE: usize = 10 * 1024 * 1024; // 10MB

    if let Some(content_length) = req.headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<usize>().ok())
    {
        if content_length > MAX_SIZE {
            return Err(AppError::BadRequest(
                format!("Request body too large. Maximum size is {} bytes", MAX_SIZE)
            ));
        }
    }

    Ok(next.run(req).await)
}

/// Request ID middleware for tracing
pub async fn add_request_id(
    mut req: Request,
    next: Next,
) -> Result<impl IntoResponse, AppError> {
    let request_id = uuid::Uuid::new_v4().to_string();
    req.headers_mut().insert(
        "X-Request-Id",
        request_id.parse().unwrap(),
    );

    let res = next.run(req).await;

    // Add request ID to response headers
    let mut res = res;
    res.headers_mut().insert(
        "X-Request-Id",
        request_id.parse().unwrap(),
    );

    Ok(res)
}
```

---

## Pattern 7: Error Recovery and Fallbacks

**File**: Service with fallback

```rust
use crate::error::{AppError, AppResult};

impl CacheService {
    /// Get with fallback to database
    pub async fn get_with_fallback<T>(
        &self,
        key: &str,
        db_fetch: impl Future<Output = AppResult<T>>,
    ) -> AppResult<T>
    where
        T: Serialize + for<'de> Deserialize<'de> + Clone,
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