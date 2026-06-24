# Rust Routes Guide

> **Goal**: Define clean, documented API routes that are easy to navigate and maintain.
> **Rule**: Routes ONLY wire handlers to URLs. No business logic in route files.

## File Structure

```
src/api/routes/
├── mod.rs           # Re-exports all routers
├── api.rs           # Main API router (combines all)
├── organization.rs  # Organization routes
├── assessment.rs    # Assessment routes
└── user.rs          # User routes
```

---

## Pattern 1: Feature Router

**File**: `src/api/routes/organization.rs`

```rust
use crate::AppState;
use axum::{
    routing::{delete, get, post, put},
    Router,
};
use crate::api::handlers::organization::*;

/// Create organization routes
pub fn create_organization_routes() -> Router<AppState> {
    Router::new()
        // CRUD operations
        .route("/", post(create_organization))
        .route("/", get(get_organizations))
        .route("/{org_id}", get(get_organization))
        .route("/{org_id}", put(update_organization))
        .route("/{org_id}", delete(delete_organization))
        // Nested resources
        .route("/{org_id}/members", get(get_organization_members))
        .route("/{org_id}/dimensions", post(assign_dimension_to_organization))
        .route("/{org_id}/dimensions", get(get_organization_dimensions))
        .route("/{org_id}/dimensions/{dimension_id}", delete(remove_dimension_from_organization))
}
```

---

## Pattern 2: Main API Router

**File**: `src/api/routes/api.rs`

```rust
use crate::AppState;
use axum::Router;
use crate::api::routes::{
    organization::create_organization_routes,
    assessment::create_assessment_routes,
    user::user_routes,
    // ... other routers
};

/// Create the main API routes
pub fn create_api_routes() -> Router<AppState> {
    Router::new()
        // Admin routes (require authentication)
        .nest("/admin/organizations", create_organization_routes())
        .nest("/admin/groups", create_group_routes())
        .nest("/admin/users", user_routes())
        // Public routes
        .nest("/assessments", create_assessment_routes())
        .nest("/dimensions", create_dimension_routes())
        .nest("/recommendations", create_recommendation_routes())
        // User-specific routes
        .route("/user/me", get(get_me).patch(update_me))
        .route("/user/me/password", post(change_password))
}
```

---

## How to Add a New Route

### Step 1: Create Handler (if not exists)
File: `src/api/handlers/my_feature.rs`
```rust
pub async fn create_my_entity(...) -> AppResult<impl IntoResponse> { }
pub async fn get_my_entity(...) -> AppResult<impl IntoResponse> { }
pub async fn list_my_entities(...) -> AppResult<impl IntoResponse> { }
```

### Step 2: Create Router
File: `src/api/routes/my_feature.rs`
```rust
use crate::api::handlers::my_feature::*;

pub fn create_my_feature_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_my_entity))
        .route("/", get(list_my_entities))
        .route("/{id}", get(get_my_entity))
}
```

### Step 3: Register in Main Router
File: `src/api/routes/api.rs`
```rust
// Add import
use crate::api::routes::my_feature::create_my_feature_routes;

// Add to Router::new()
.nest("/my-feature", create_my_feature_routes())
```

---

## Best Practices

1. **Group by resource**: `/users`, `/organizations`, `/assessments`
2. **Consistent patterns**: `GET /` for list, `POST /` for create
3. **RESTful naming**: `/resource/{id}/sub-resource`
4. **No logic in routes**: Just wire handlers
5. **Use .nest()**: For grouping related routes
6. **Version if needed**: `/api/v1/resource`

## Checklist

- [ ] Handler created in handlers/
- [ ] Router created in routes/
- [ ] Registered in api.rs
- [ ] OpenAPI annotation added
- [ ] Route follows REST conventions