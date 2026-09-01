# Rust Routes Guide

> **Goal**: Define clean, documented API routes that are easy to navigate and maintain.
> **Rule**: Routes ONLY wire handlers to URLs. No business logic in route files.

## File Structure

```
src/api/routes/
├── mod.rs           # Re-exports all routers
├── api.rs           # Main API router (combines all, role guards)
├── shared.rs        # Routes accessible by all authenticated roles
├── ministry.rs      # Ministry-level routes (Level 1)
├── federation.rs    # Federation-level routes (Level 2)
├── apex.rs          # Apex-level routes (Level 3)
├── cooperative.rs   # Cooperative-level routes (Level 4)
└── users.rs         # User management routes
```

### Route Hierarchy (4-Tier IAM)

```
/api/v1
├── /me                    ← Shared: Current user profile
├── /benchmarks            ← Shared: Analytics
├── /analytics/*           ← Shared: Analytics endpoints
├── /non-financial-indicators/*  ← Shared: NF catalog
├── /settings/*           ← Shared: Settings
│
├── /users                ← Ministry/Federation/Apex: User management
│
├── /ministry/*           ← Ministry only (Level 1)
├── /federation/*         ← Federation only (Level 2)
├── /apex/*               ← Apex only (Level 3)
└── /cooperative/*        ← Cooperative/Apex/Federation/Ministry (Level 4)
```

---

## Pattern 1: Feature Router

**File**: `src/api/routes/shared.rs`

```rust
use axum::{
    extract::{Extension, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use std::sync::Arc;

use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

/// Shared routes accessible by all authenticated users
pub fn shared_routes() -> Router<AppState> {
    Router::new()
        .route("/me", get(get_current_user_profile))
        .route("/me/password", post(crate::api::handlers::me::change_password))
        .route("/me/verify-identity", post(crate::api::handlers::me::verify_identity))
        .route("/me/security", get(crate::api::handlers::me::get_security_settings))
        // Non-financial indicator catalog
        .route(
            "/non-financial-indicators/catalog",
            get(crate::api::handlers::non_financial_indicator::list_catalog),
        )
        // Analytics endpoints
        .route("/benchmarks", get(crate::api::handlers::financial_statement::get_benchmarks))
        .route("/analytics/monthly-trend", get(crate::api::handlers::financial_statement::get_monthly_trend))
        .route("/analytics/national-overview", get(crate::api::handlers::national_overview::get_national_overview))
}
```

---

## Pattern 2: Main API Router with Role Guards

**File**: `src/api/routes/api.rs`

```rust
use axum::routing::get;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use crate::api::handlers;
use crate::auth::middleware::auth_layer;
use crate::auth::rbac::roles;
use crate::AppState;

/// Creates a role-checking middleware layer for route groups
pub fn role_guard_layer(
    allowed_roles: &'static [&'static str],
) -> impl Fn(
    axum::extract::Request,
    axum::middleware::Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = axum::response::Response> + Send>>
       + Clone
       + 'static {
    move |request: Request, next: Next| {
        Box::pin(async move {
            let claims = request.extensions().get::<Arc<Claims>>().cloned();
            match claims {
                Some(claims) => {
                    if claims.has_any_role(roles) || claims.is_service_account() {
                        next.run(request).await
                    } else {
                        Response::builder()
                            .status(axum::http::StatusCode::FORBIDDEN)
                            .body(Body::from(serde_json::json!({
                                "error": "forbidden",
                                "message": format!("Access denied. Required role: {}", roles.join(" or "))
                            }).to_string()))
                            .unwrap()
                    }
                }
                None => Response::builder()
                    .status(axum::http::StatusCode::UNAUTHORIZED)
                    .body(Body::from(serde_json::json!({
                        "error": "unauthorized"
                    }).to_string()))
                    .unwrap(),
            }
        })
    }
}

/// Creates the main application router
pub fn create_app(state: AppState) -> Router {
    let protected = Router::new()
        .merge(shared_routes())           // All authenticated users
        .merge(user_routes())             // Ministry/Federation/Apex
        .nest("/ministry", ministry_routes().layer(role_guard_layer(&[roles::MINISTRY])))
        .nest("/federation", federation_routes().layer(role_guard_layer(&[roles::FEDERATION])))
        .nest("/apex", apex_routes().layer(role_guard_layer(&[roles::APEX, roles::MINISTRY])))
        .nest("/cooperative", cooperative_routes().layer(role_guard_layer(&[roles::COOPERATIVE, roles::APEX, roles::FEDERATION, roles::MINISTRY])))
        .layer(axum::middleware::from_fn_with_state(state.clone(), auth_layer));

    Router::new()
        .nest("/api/v1", public_routes().merge(protected))
        .merge(crate::api::openapi::serve_openapi())
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state)
}
```

**Key patterns**:
- Role guards applied at route group level (not per-handler)
- `auth_layer` middleware validates JWT and extracts Claims
- `merge()` for flat routes, `nest()` for grouped routes
- CORS and tracing layers applied globally

---

## How to Add a New Route

### Step 1: Create Handler (if not exists)

File: `src/api/handlers/my_feature.rs`

```rust
use crate::{error::AppResult, AppState};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json, Extension};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::claims::Claims;

#[utoipa::path(
    get,
    path = "/api/v1/my-feature/{id}",
    params(("id" = Uuid, Path, description = "Feature ID")),
    responses((status = 200, description = "Success")),
    tag = "MyFeature"
)]
pub async fn get_my_entity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    // Implementation
    Ok((StatusCode::OK, Json(serde_json::json!({}))))
}
```

### Step 2: Create Router

File: `src/api/routes/my_feature.rs`

```rust
use axum::{routing::get, Router};

use crate::api::handlers::my_feature::*;
use crate::AppState;

pub fn my_feature_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_my_entities))
        .route("/{id}", get(get_my_entity))
}
```

### Step 3: Register in Main Router

File: `src/api/routes/api.rs`

```rust
// Add import
use crate::api::routes::my_feature::my_feature_routes;

// Add to the appropriate route group:
// For shared routes (all authenticated):
//   .merge(shared_routes())  // Add to shared_routes() function

// For role-specific routes:
//   .nest("/my-feature", my_feature_routes().layer(role_guard_layer(&[roles::APEX])))
```

---

## Best Practices

1. **Group by tier**: `/ministry`, `/federation`, `/apex`, `/cooperative`
2. **Shared routes**: `/me`, `/benchmarks`, `/analytics` accessible to all
3. **Consistent patterns**: `GET /` for list, `POST /` for create
4. **RESTful naming**: `/resource/{id}/sub-resource`
5. **No logic in routes**: Just wire handlers
6. **Use .nest()**: For grouping related routes under tier prefix
7. **Use .merge()**: For flat routes in same prefix
8. **Role guards at group level**: Apply `role_guard_layer()` to route groups, not individual routes
9. **Version prefix**: All routes under `/api/v1`

## Checklist

- [ ] Handler created in `src/api/handlers/`
- [ ] Handler uses `Extension<Arc<Claims>>` for auth
- [ ] `#[utoipa::path]` annotation with tag
- [ ] Router created in `src/api/routes/`
- [ ] Registered in appropriate tier (shared/federation/apex/cooperative)
- [ ] Role guard layer applied to tier-specific routes
- [ ] OpenAPI annotation added
