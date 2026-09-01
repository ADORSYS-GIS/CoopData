# Rust API Handlers Guide

> **Goal**: Build clean, type-safe HTTP handlers with proper error handling and documentation.
> **Rule**: One Handler = One Responsibility. Handlers orchestrate services, they don't contain business logic.

## File Structure

```
src/api/
├── handlers/
│   ├── mod.rs                 # Re-exports all handlers
│   ├── users.rs               # User-related handlers
│   ├── organizations.rs       # Organization handlers
│   ├── submission.rs          # Submission/workflow handlers
│   ├── cooperative.rs         # Cooperative handlers
│   ├── federation.rs          # Federation handlers
│   ├── apex.rs                # Apex handlers
│   ├── extraction.rs          # AI extraction handlers
│   ├── financial_statement.rs # Financial statement handlers
│   ├── non_financial.rs       # Non-financial indicator handlers
│   ├── questionnaire.rs       # Questionnaire handlers
│   └── ... (23+ handlers total)
├── dto/
│   ├── mod.rs
│   ├── organization.rs        # Request/Response DTOs
│   └── submission.rs
└── routes/
    ├── mod.rs
    ├── api.rs                 # Main router assembly
    ├── shared.rs             # Routes accessible by all roles
    ├── ministry.rs            # Ministry-level routes
    ├── federation.rs          # Federation-level routes
    ├── apex.rs                # Apex-level routes
    ├── cooperative.rs        # Cooperative-level routes
    └── users.rs               # User management routes
```

---

## Pattern 1: Standard CRUD Handler

**File**: `src/api/handlers/organizations.rs`

```rust
use crate::{
    api::dto::{
        CreateOrganizationRequest, OrganizationResponse,
        PaginatedOrganizationResponse, PaginatedResponse, PaginationParams,
    },
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::repositories::OrganizationRepository;

// ============================================
// CREATE - Create a new organization
// ============================================
#[utoipa::path(
    post,
    path = "/api/v1/organizations",
    tag = "Organizations",
    request_body = CreateOrganizationRequest,
    responses(
        (status = 201, description = "Organization created", body = OrganizationResponse),
        (status = 400, description = "Invalid input"),
        (status = 409, description = "Organization already exists")
    )
)]
pub async fn create_organization(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,  // ← Auth via Claims, not token string
    Json(body): Json<CreateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Organization name is required".into()));
    }

    let repo = OrganizationRepository::new(state.db.clone());
    let model = organization::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(body.name.clone()),
        // ... other fields
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };

    let created = repo.create(model).await?;

    tracing::info!(org_id = %created.id, "Organization created");

    Ok((StatusCode::CREATED, Json(OrganizationResponse::from(created))))
}

// ============================================
// READ - Get organization by ID
// ============================================
#[utoipa::path(
    get,
    path = "/api/v1/organizations/{id}",
    tag = "Organizations",
    params(("id" = Uuid, Path, description = "Organization ID")),
    responses(
        (status = 200, description = "Organization found", body = OrganizationResponse),
        (status = 404, description = "Organization not found")
    )
)]
pub async fn get_organization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    let org = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Organization {} not found", id)))?;

    Ok((StatusCode::OK, Json(OrganizationResponse::from(org))))
}
```

**Why**:

- Uses `Extension<Arc<Claims>>` for authentication (not raw token string)
- Creates repository instance with `Repository::new(state.db.clone())`
- Input validation at the start
- Returns proper DTOs (not raw entities)
- Consistent error handling with `AppResult<T>`

---

## Pattern 2: Handler with Repository + Claims

**File**: `src/api/handlers/submission.rs`

```rust
use crate::{
    api::dto::submission::{CreateSubmissionRequest, SubmissionResponse},
    auth::claims::Claims,
    entities::submission::ActiveModel,
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sea_orm::{Set, TransactionTrait};
use std::sync::Arc;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions",
    tag = "Cooperative",
    request_body = CreateSubmissionRequest,
    responses(
        (status = 201, description = "Submission created", body = SubmissionResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden"),
        (status = 409, description = "Submission already exists for this year")
    )
)]
pub async fn create_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,  // ← Claims for auth context
    Json(body): Json<CreateSubmissionRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input
    if body.reporting_year < 1900 || body.reporting_year > 2100 {
        return Err(AppError::BadRequest(
            "reporting_year must be between 1900 and 2100".to_string(),
        ));
    }

    // Resolve cooperative from claims (scope enforcement)
    let coop = resolve_caller_cooperative(&state, &claims).await?;

    // Check for existing submission
    if let Some(existing) = state
        .submission_repo
        .find_by_cooperative_and_year(coop.id, body.reporting_year)
        .await?
    {
        return Err(AppError::ConflictWithSubmission {
            message: format!(
                "A submission already exists for year {} (Status: {})",
                body.reporting_year,
                existing.status.as_str()
            ),
            submission_id: existing.id,
        });
    }

    // Create active model
    let model = ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop.id),
        reporting_year: Set(body.reporting_year),
        status: Set(SubmissionStatus::Draft),
        // ... other fields
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };

    let submission = state.submission_repo.create(model).await?;

    tracing::info!(
        submission_id = %submission.id,
        cooperative_id = %coop.id,
        "Submission created"
    );

    Ok((StatusCode::CREATED, Json(SubmissionResponse::from(submission))))
}
```

**Key differences from Pattern 1**:
- Uses `Extension<Arc<Claims>>` to get authenticated user context
- Calls helper functions like `resolve_caller_cooperative()` for scope enforcement
- Uses `state.submission_repo` (repository on AppState) instead of creating new instance
- Returns `ConflictWithSubmission` error for duplicate submissions

---

## Pattern 3: Batch Operations Handler

**File**: `src/api/handlers/cooperative.rs`

```rust
use crate::{
    api::dto::cooperative::{CooperativeResponse, CreateCooperativeRequest},
    auth::claims::Claims,
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives",
    tag = "Cooperative",
    request_body = CreateCooperativeRequest,
    responses(
        (status = 201, description = "Cooperative created", body = CooperativeResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden - apex role required")
    )
)]
pub async fn create_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Cooperative name is required".into()));
    }

    // Scope enforcement: apex can only create cooperatives in their group
    let apex_id = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

    // Create in Keycloak
    let keycloak_group = state
        .keycloak
        .create_group(&apex_id, &body.name)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    // Create in PostgreSQL
    let model = cooperative::ActiveModel {
        id: Set(Uuid::new_v4()),
        keycloak_id: Set(keycloak_group.id),
        display_name: Set(body.name.clone()),
        // ... other fields
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };

    let created = state.cooperative_repo.create(model).await?;

    tracing::info!(
        cooperative_id = %created.id,
        keycloak_id = %keycloak_group.id,
        "Cooperative created"
    );

    Ok((StatusCode::CREATED, Json(CooperativeResponse::from(created))))
}
```

**Key patterns for batch/cooperative operations**:
- Scope enforcement via `Claims` methods (`get_apex_group_id()`, etc.)
- Keycloak integration for group management
- Dual-write: Keycloak + PostgreSQL
- Proper error types for different failure modes

---

## Pattern 4: Search/Filter Handler with Pagination

**File**: `src/api/handlers/users.rs`

```rust
use crate::{
    api::dto::{
        PaginatedResponse, PaginatedUserResponse, PaginationParams, UserResponse,
    },
    error::AppResult,
    repositories::UserRepository,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

#[utoipa::path(
    get,
    path = "/api/v1/users",
    tag = "Users",
    params(
        PaginationParams  // page, per_page
    ),
    responses(
        (status = 200, description = "List of users", body = PaginatedUserResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_users(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<impl IntoResponse> {
    let repo = UserRepository::new(state.db.clone());
    let users = repo.find_all().await?;

    let responses: Vec<UserResponse> = users.into_iter().map(Into::into).collect();
    let total = responses.len() as u64;

    Ok((
        StatusCode::OK,
        Json(PaginatedUserResponse::from(PaginatedResponse::new(
            responses,
            total,
            params.page,
            params.per_page,
        ))),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/users/{id}",
    tag = "Users",
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User found", body = UserResponse),
        (status = 404, description = "User not found")
    )
)]
pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = UserRepository::new(state.db.clone());
    let user_model = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    Ok((StatusCode::OK, Json(UserResponse::from(user_model))))
}
```

**Key patterns for list handlers**:
- Use `PaginationParams` struct for standardized pagination
- Return `PaginatedResponse<T>` wrapper for consistent API shape
- Create repository with `Repository::new(state.db.clone())`
- Convert entities to response DTOs with `Into::into`

---

## Pattern 5: Current User Profile Handler

**File**: `src/api/handlers/me.rs`

```rust
use crate::{
    api::dto::member::{ChangePasswordRequest, UserProfileResponse},
    auth::claims::Claims,
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

#[utoipa::path(
    get,
    path = "/api/v1/me",
    tag = "Auth",
    responses(
        (status = 200, description = "Current user profile", body = UserProfileResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_current_user_profile(
    State(_state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    // Build profile from JWT claims (no DB lookup needed)
    let profile = UserProfileResponse {
        sub: claims.sub.clone(),
        username: claims.username().map(String::from),
        email: claims.email.clone(),
        name: claims.name.clone(),
        roles: claims.all_roles(),
        organization_id: claims.get_organization_id(),
        organization_name: claims.get_organization_name(),
        cooperation_paths: claims.get_cooperation_paths(),
        assigned_dimensions: claims.get_assigned_dimensions(),
    };

    Ok((StatusCode::OK, Json(profile)))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/password",
    tag = "Auth",
    request_body = ChangePasswordRequest,
    responses(
        (status = 200, description = "Password changed successfully"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input
    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "New password must be at least 8 characters".to_string(),
        ));
    }

    if body.current_password == body.new_password {
        return Err(AppError::BadRequest(
            "New password must be different from current password".to_string(),
        ));
    }

    // Call Keycloak to change password
    let username = claims.username().or(claims.email.as_deref()).ok_or_else(|| {
        AppError::BadRequest("Unable to verify credentials for this account".to_string())
    })?;

    state
        .keycloak
        .update_user_password(username, &body.current_password, &body.new_password)
        .await?;

    tracing::info!(user_id = %claims.sub, "Password changed successfully");

    Ok((StatusCode::OK, Json(serde_json::json!({
        "message": "Password changed successfully"
    }))))
}
```

**Key patterns for `/me` handlers**:
- Build response directly from JWT claims (no DB lookup)
- Use `claims.username()`, `claims.all_roles()`, etc. for user data
- Keycloak integration for user operations (`state.keycloak`)
- Audit context available via `Extension<AuditContext>`

---

## Best Practices

1. **One responsibility**: Handlers orchestrate, they don't calculate
2. **Always return AppResult**: Use `Result<T, AppError>` wrapper
3. **Use Claims for auth**: `Extension<Arc<Claims>>` not raw token strings
4. **Validate early**: Check inputs at the start of handler
5. **Use proper HTTP codes**: 201 for CREATE, 204 for UPDATE/DELETE, 200 for READ
6. **Never expose internals**: Sanitize error messages for client
7. **Use Query structs**: For complex query parameters (e.g., `PaginationParams`)
8. **Implement pagination**: Always paginate list endpoints with `PaginatedResponse<T>`
9. **Document with utoipa**: Add `#[utoipa::path]` annotations with all params
10. **Scope enforcement**: Use `Claims` methods for data-level access control
11. **Create repos with `new()`**: `Repository::new(state.db.clone())`
12. **Convert to DTOs**: Return response types, not raw entities

## Checklist

- [ ] Handler returns `AppResult<impl IntoResponse>`
- [ ] Input validation at the start
- [ ] `Extension<Arc<Claims>>` for authenticated endpoints
- [ ] Proper HTTP status codes
- [ ] Error handling with context
- [ ] Repository or AppState repo used for data access
- [ ] Response converted to DTO
- [ ] Pagination implemented for lists
- [ ] OpenAPI documentation with `#[utoipa::path]`
- [ ] Scope enforcement via Claims methods
