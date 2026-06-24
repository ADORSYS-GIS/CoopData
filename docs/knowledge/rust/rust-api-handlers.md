# Rust API Handlers Guide

> **Goal**: Build clean, type-safe HTTP handlers with proper error handling and documentation.
> **Rule**: One Handler = One Responsibility. Handlers orchestrate services, they don't contain business logic.

## File Structure

```
src/api/
├── handlers/
│   ├── mod.rs                 # Re-exports all handlers
│   ├── user.rs                # User-related handlers
│   ├── organization.rs        # Organization handlers
│   └── assessment.rs          # Assessment handlers
├── dto/
│   ├── mod.rs
│   └── user.rs                # Request/Response DTOs
└── routes/
    ├── mod.rs
    └── api.rs                 # Route definitions
```

---

## Pattern 1: Standard CRUD Handler

**File**: `src/api/handlers/organization.rs`

```rust
use crate::{
    api::dto::organization::{OrganizationCreateRequest, OrganizationUpdateRequest},
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use tracing::instrument;

// ============================================
// CREATE - Create a new organization
// ============================================
#[utoipa::path(
    post,
    path = "/admin/organizations",
    tag = "Organization",
    request_body = OrganizationCreateRequest,
    responses(
        (status = 201, description = "Created", body = KeycloakOrganization),
        (status = 400, description = "Bad Request"),
        (status = 401, description = "Unauthorized")
    )
)]
#[instrument(skip(state), fields(name = %request.name))]
pub async fn create_organization(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Json(request): Json<OrganizationCreateRequest>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(?request, "Received organization create request");

    // Validate input
    if request.name.is_empty() {
        return Err(AppError::BadRequest("Organization name is required".to_string()));
    }

    // Get admin token from keycloak service
    let admin_token = state.keycloak_service.get_admin_token().await?;

    // Call service layer
    let organization = state.keycloak_service
        .create_organization(
            &admin_token,
            &request.name,
            request.domains,
            request.redirect_url,
            request.enabled,
            request.attributes,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to create organization: {}", e);
            AppError::InternalServerError(format!("Failed to create organization: {}", e))
        })?;

    tracing::info!(
        org_id = %organization.id,
        "Organization created successfully"
    );

    Ok((StatusCode::CREATED, Json(organization)))
}

// ============================================
// READ - Get all organizations
// ============================================
#[utoipa::path(
    get,
    path = "/admin/organizations",
    tag = "Organization",
    responses(
        (status = 200, description = "Success", body = Vec<KeycloakOrganization>)
    )
)]
pub async fn get_organizations(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
) -> AppResult<impl IntoResponse> {
    tracing::info!("Fetching all organizations");

    let admin_token = state.keycloak_service.get_admin_token().await?;

    let organizations = state.keycloak_service
        .get_organizations(&admin_token)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get organizations: {}", e);
            AppError::InternalServerError("Failed to get organizations".to_string())
        })?;

    Ok((StatusCode::OK, Json(organizations)))
}

// ============================================
// READ - Get single organization by ID
// ============================================
#[utoipa::path(
    get,
    path = "/admin/organizations/{org_id}",
    tag = "Organization",
    params(("org_id" = String, Path, description = "Organization ID")),
    responses(
        (status = 200, description = "Success", body = KeycloakOrganization),
        (status = 404, description = "Not Found")
    )
)]
pub async fn get_organization(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Path(org_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(org_id = %org_id, "Fetching organization");

    let admin_token = state.keycloak_service.get_admin_token().await?;

    let organization = state.keycloak_service
        .get_organization(&admin_token, &org_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get organization: {}", e);
            AppError::InternalServerError("Failed to get organization".to_string())
        })?;

    Ok((StatusCode::OK, Json(organization)))
}

// ============================================
// UPDATE - Update organization
// ============================================
#[utoipa::path(
    put,
    path = "/admin/organizations/{org_id}",
    tag = "Organization",
    params(("org_id" = String, Path, description = "Organization ID")),
    request_body = OrganizationUpdateRequest,
    responses(
        (status = 204, description = "Updated successfully"),
        (status = 404, description = "Not Found")
    )
)]
pub async fn update_organization(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Path(org_id): Path<String>,
    Json(request): Json<OrganizationUpdateRequest>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(org_id = %org_id, ?request, "Updating organization");

    let admin_token = state.keycloak_service.get_admin_token().await?;

    state.keycloak_service
        .update_organization(
            &admin_token,
            &org_id,
            &request.name,
            request.domains,
            request.attributes,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to update organization: {}", e);
            AppError::InternalServerError("Failed to update organization".to_string())
        })?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================
// DELETE - Delete organization
// ============================================
#[utoipa::path(
    delete,
    path = "/admin/organizations/{org_id}",
    tag = "Organization",
    params(("org_id" = String, Path, description = "Organization ID")),
    responses(
        (status = 204, description = "Deleted successfully"),
        (status = 404, description = "Not Found")
    )
)]
pub async fn delete_organization(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Path(org_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(org_id = %org_id, "Deleting organization");

    let admin_token = state.keycloak_service.get_admin_token().await?;

    // Fetch members before deletion for cleanup
    let members = state.keycloak_service
        .get_organization_members(&admin_token, &org_id)
        .await
        .unwrap_or_default();

    // Delete organization
    state.keycloak_service
        .delete_organization(&admin_token, &org_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete organization: {}", e);
            AppError::InternalServerError("Failed to delete organization".to_string())
        })?;

    // Cleanup: Delete all users that belonged to this organization
    for member in &members {
        if let Err(e) = state.keycloak_service.delete_user(&admin_token, &member.id).await {
            tracing::warn!("Failed to delete user {}: {}", member.id, e);
        }
    }

    // Cleanup: Delete associated database records
    let db = &state.db;
    let assessments = crate::repositories::assessments::AssessmentsRepository::find_by_organization_id(
        db.as_ref(),
        org_id.clone(),
    )
    .await
    .unwrap_or_default();

    for assessment in assessments {
        let _ = crate::repositories::assessments::AssessmentsRepository::delete(
            db.as_ref(),
            assessment.assessment_id,
        ).await;
    }

    tracing::info!(
        org_id = %org_id,
        members_deleted = members.len(),
        "Organization deleted successfully"
    );

    Ok(StatusCode::NO_CONTENT)
}
```

**Why**:
- Clear separation: CREATE, READ, UPDATE, DELETE sections
- `#[instrument]` for automatic tracing
- Input validation at the start
- Service layer orchestration
- Cleanup operations after delete
- Consistent error handling with `AppResult<T>`

---

## Pattern 2: Handler with Repository

**File**: `src/api/handlers/assessment.rs`

```rust
use crate::{
    api::dto::assessment::{AssessmentCreateRequest, AssessmentUpdateRequest},
    entities::assessments::{self, Entity as Assessments, AssessmentStatus},
    error::{AppError, AppResult},
    repositories::assessments::AssessmentsRepository,
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sea_orm::*;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/assessments",
    tag = "Assessment",
    request_body = AssessmentCreateRequest,
    responses((status = 201, description = "Created", body = Assessment))
)]
pub async fn create_assessment(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Json(request): Json<AssessmentCreateRequest>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(?request, "Creating assessment");

    // Validate request
    if request.organization_id.is_empty() {
        return Err(AppError::BadRequest("Organization ID is required".to_string()));
    }

    // Create active model
    let assessment = assessments::ActiveModel {
        assessment_id: Set(Uuid::new_v4()),
        organization_id: Set(request.organization_id),
        cooperation_id: Set(request.cooperation_id),
        document_title: Set(request.document_title),
        status: Set(AssessmentStatus::Draft),
        started_at: Set(None),
        completed_at: Set(None),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
        dimensions_id: Set(request.dimensions_id),
    };

    // Persist via repository
    let created = AssessmentsRepository::create(&state.db, assessment)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to create assessment");
            AppError::DatabaseError(e)
        })?;

    tracing::info!(
        assessment_id = %created.assessment_id,
        "Assessment created successfully"
    );

    Ok((StatusCode::CREATED, Json(created)))
}

#[utoipa::path(
    get,
    path = "/assessments/{id}",
    tag = "Assessment",
    params(("id" = Uuid, Path, description = "Assessment ID")),
    responses((status = 200, description = "Success", body = Assessment))
)]
pub async fn get_assessment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(assessment_id = %id, "Fetching assessment");

    let assessment = AssessmentsRepository::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Assessment not found: {}", id)))?;

    Ok((StatusCode::OK, Json(assessment)))
}
```

---

## Pattern 3: Batch Operations Handler

**File**: `src/api/handlers/dimension.rs`

```rust
use crate::{
    api::dto::dimension::{BatchUpdateRequest, DimensionResponse},
    error::{AppError, AppResult},
    repositories::dimensions::DimensionsRepository,
    AppState,
};
use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/dimensions/batch",
    tag = "Dimension",
    request_body = BatchUpdateRequest,
    responses((status = 200, description = "Batch updated successfully"))
)]
pub async fn batch_update_dimensions(
    State(state): State<AppState>,
    Json(request): Json<BatchUpdateRequest>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(count = request.dimensions.len(), "Batch updating dimensions");

    let mut updated = Vec::new();
    let mut errors = Vec::new();

    for dimension_data in request.dimensions {
        match DimensionsRepository::update(&state.db, dimension_data.id, dimension_data.into())
            .await
        {
            Ok(model) => updated.push(DimensionResponse::from(model)),
            Err(e) => {
                tracing::error!(error = %e, "Failed to update dimension");
                errors.push(format!("Failed to update dimension {}: {}", dimension_data.id, e));
            }
        }
    }

    if !errors.is_empty() {
        tracing::warn!(errors = ?errors, "Some dimensions failed to update");
    }

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "updated": updated,
            "errors": errors,
            "total": request.dimensions.len(),
            "successful": updated.len(),
            "failed": errors.len(),
        })),
    ))
}
```

---

## Pattern 4: Search/Filter Handler

**File**: `src/api/handlers/user.rs`

```rust
use crate::{
    error::{AppError, AppResult},
    models::keycloak::KeycloakUser,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UserFilters {
    pub search: Option<String>,
    pub role: Option<String>,
    pub organization_id: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[utoipa::path(
    get,
    path = "/admin/users",
    tag = "User",
    params(
        ("search" = Option<String>, Query, description = "Search term"),
        ("role" = Option<String>, Query, description = "Filter by role"),
        ("organization_id" = Option<String>, Query, description = "Filter by organization"),
        ("page" = Option<u32>, Query, description = "Page number"),
        ("per_page" = Option<u32>, Query, description = "Items per page")
    ),
    responses((status = 200, description = "Success", body = Vec<KeycloakUser>))
)]
pub async fn list_users(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Query(filters): Query<UserFilters>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(?filters, "Listing users with filters");

    let admin_token = state.keycloak_service.get_admin_token().await?;

    // Implement filtering logic
    let mut users = state.keycloak_service
        .get_users(&admin_token)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to fetch users");
            AppError::InternalServerError("Failed to fetch users".to_string())
        })?;

    // Apply filters
    if let Some(search) = &filters.search {
        users.retain(|u| {
            u.email.to_lowercase().contains(&search.to_lowercase()) ||
            u.username.to_lowercase().contains(&search.to_lowercase())
        });
    }

    if let Some(role) = &filters.role {
        users.retain(|u| {
            u.attributes
                .as_ref()
                .and_then(|a| a.get("roles"))
                .and_then(|r| r.as_array())
                .map(|roles| roles.iter().any(|r| r.as_str() == Some(role)))
                .unwrap_or(false)
        });
    }

    // Apply pagination
    let page = filters.page.unwrap_or(1).max(1);
    let per_page = filters.per_page.unwrap_or(20).min(100).max(1);
    let total = users.len();
    let total_pages = (total as f64 / per_page as f64).ceil() as u32;
    let offset = (page - 1) * per_page;

    let paginated_users: Vec<_> = users
        .into_iter()
        .skip(offset as usize)
        .take(per_page as usize)
        .collect();

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "data": paginated_users,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
            },
        })),
    ))
}
```

---

## Pattern 5: Async Handler with Cache

**File**: `src/api/handlers/cached.rs`

```rust
use crate::{
    error::{AppError, AppResult},
    AppState,
};
use axum::{extract::State, http::StatusCode, Json};
use std::time::Duration;

/// Handler that uses caching for frequently accessed data
#[utoipa::path(
    get,
    path = "/dimensions",
    tag = "Dimension",
    responses((status = 200, description = "Success"))
)]
pub async fn list_dimensions_cached(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    let cache_key = "dimensions:all";

    // Try cache first
    if let Some(cached) = state.cache.get::<Vec<DimensionResponse>>(cache_key).await {
        tracing::debug!("Cache hit for dimensions");
        return Ok((StatusCode::OK, Json(cached)));
    }

    tracing::debug!("Cache miss for dimensions");

    // Fetch from repository
    let dimensions = DimensionsRepository::find_all(&state.db).await?;

    // Cache for 5 minutes
    state.cache
        .set(cache_key, dimensions.clone(), Duration::from_secs(300))
        .await;

    Ok((StatusCode::OK, Json(dimensions)))
}
```

---

## Best Practices

1. **One responsibility**: Handlers orchestrate, they don't calculate
2. **Always return AppResult**: Use `Result<T, AppError>` wrapper
3. **Log at start and end**: Use `#[instrument]` attribute
4. **Validate early**: Check inputs at the start of handler
5. **Use proper HTTP codes**: 201 for CREATE, 204 for UPDATE/DELETE, 200 for READ
6. **Never expose internals**: Sanitize error messages for client
7. **Use Query structs**: For complex query parameters
8. **Implement pagination**: Always paginate list endpoints
9. **Document with utoipa**: Add `#[utoipa::path]` annotations
10. **Handle cleanup**: Delete related entities when deleting parent

## Checklist

- [ ] Handler returns `AppResult<impl IntoResponse>`
- [ ] Input validation at the start
- [ ] `#[instrument]` attribute for tracing
- [ ] Proper HTTP status codes
- [ ] Error handling with context
- [ ] Service/Repository used for business logic
- [ ] Response is properly JSON serialized
- [ ] Pagination implemented for lists
- [ ] OpenAPI documentation added
- [ ] Related entities cleaned up on delete