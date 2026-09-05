# Rust OpenAPI Documentation Guide

> **Goal**: Auto-document all API endpoints with OpenAPI/Swagger for discoverability and client generation.
> **Rule**: EVERY handler MUST have `#[utoipa::path(...)]` annotation with complete documentation.

---

## How to Add OpenAPI Documentation

### Step 1: Add utoipa Annotations to Handler

**File:** `src/api/handlers/submission.rs`

```rust
use utoipa::ToSchema;
use std::sync::Arc;
use crate::auth::claims::Claims;

/// Handler documentation format:
/// 1. HTTP method and path
/// 2. Tag for grouping
/// 3. Path parameters
/// 4. Request body schema
/// 5. All possible responses

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
    Extension(claims): Extension<Arc<Claims>>,  // Note: Claims, not String token
    Json(request): Json<CreateSubmissionRequest>,
) -> AppResult<impl IntoResponse> {
    // Handler implementation
}
```

### Step 2: Document All Path Parameters

```rust
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}",
    tag = "Cooperative",
    params(
        ("id" = Uuid, Path, description = "Submission unique identifier")
    ),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 404, description = "Submission not found", body = ErrorResponse)
    )
)]
pub async fn get_submission(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    // ...
}
```

### Step 3: Document Query Parameters

```rust
#[derive(Debug, Deserialize, IntoParams)]
pub struct PaginationParams {
    /// Page number (default: 1)
    #[param(default = 1)]
    pub page: Option<u32>,
    /// Items per page (default: 20, max: 100)
    #[param(default = 20)]
    pub per_page: Option<u32>,
}

#[utoipa::path(
    get,
    path = "/api/v1/organizations",
    tag = "Organizations",
    params(PaginationParams),
    responses(
        (status = 200, description = "List of organizations", body = PaginatedOrganizationResponse)
    )
)]
pub async fn list_organizations(
    Query(params): Query<PaginationParams>,
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    // ...
}
```

### Step 4: Define Response Schemas

**File:** `src/api/dto/submission.rs`

```rust
use utoipa::ToSchema;

/// Submission response schema
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionResponse {
    /// Unique identifier
    pub id: Uuid,
    /// Reference number
    pub reference: Option<String>,
    /// Cooperative ID
    pub cooperative_id: Uuid,
    /// Reporting year
    pub reporting_year: i32,
    /// Current status
    #[schema(example = "draft")]
    pub status: String,
}

/// Error response schema (defined in common.rs)
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    /// Error type
    pub error: String,
    /// Human-readable message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
```

### Step 5: Register Tag in OpenAPI

**File:** `src/api/openapi.rs`

```rust
use utoipa::OpenApi;
use utoipa::openapi::security::{SecurityScheme, ApiKey};

#[derive(OpenApi)]
#[openapi(
    paths(
        // Handlers
        crate::api::handlers::assessment::create_assessment,
        crate::api::handlers::assessment::get_assessment,
        crate::api::handlers::assessment::list_assessments,
        // Add all handlers here
    ),
    components(
        schemas(
            // DTOs
            crate::api::dto::assessment::AssessmentCreateRequest,
            crate::api::dto::assessment::AssessmentResponse,
            crate::api::dto::common::ErrorResponse,
            crate::api::dto::common::PaginatedResponse,
            // Add all response/request DTOs
        )
    ),
    tags(
        (name = "Assessment", description = "Assessment management endpoints"),
        (name = "Organization", description = "Organization management endpoints"),
        (name = "User", description = "User management endpoints"),
        (name = "Dimension", description = "Dimension management endpoints"),
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        // Add JWT security scheme
        openapi.components.as_mut().unwrap().add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(utoipa::openapi::security::HttpBuilder::new()
                .scheme("bearer")
                .bearer_format("JWT")
                .build()),
        );
    }
}
```

### Step 6: Serve Swagger UI

**File:** `src/api/openapi.rs`

```rust
use axum::Router;
use utoipa_swagger_ui::SwaggerUi;

pub fn docs_routes(config: &Config) -> Router {
    let mut openapi = ApiDoc::openapi();

    // Add server URL
    let server = utoipa::openapi::Server::new(&config.server_url);
    openapi.servers = Some(vec![server]);

    SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", openapi)
        .into()
}
```

---

## Documentation Checklist Per Endpoint

```rust
#[utoipa::path(
    method,                              // GET, POST, PUT, DELETE
    path = "/resource/{id}",             // URL path
    tag = "ResourceName",                // Group tag
    params(                              // Path/query parameters
        ("id" = Uuid, Path, description = "Resource ID"),
    ),
    request_body = CreateRequest,       // For POST/PUT
    responses(                           // All possible responses
        (status = 200, description = "Success", body = Response),
        (status = 400, description = "Bad Request"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Not Found"),
        (status = 500, description = "Internal Error"),
    ),
    security(                            // If auth required
        ("bearer_auth" = [])
    )
)]
```

---

## Running Swagger UI

### Development

```bash
# Start server
cargo run

# Open in browser
http://localhost:3000/swagger-ui
```

### Validate OpenAPI Spec (CI)

```bash
# Add to tests
cargo test test_openapi_spec_is_valid
```

---

## Best Practices

1. **Document ALL endpoints**: No undocumented routes
2. **Add examples**: Use `#[schema(example = "...")]`
3. **Include all responses**: 200, 400, 401, 404, 500
4. **Use meaningful descriptions**: Explain what the endpoint does
5. **Tag consistently**: Same tag name for related endpoints
6. **Add security**: Mark protected endpoints
7. **Validate spec**: Run spec validation in CI
8. **Keep schemas updated**: Add new DTOs to components

---

## Checklist

- [ ] `#[utoipa::path(...)]` on every handler
- [ ] All path parameters documented
- [ ] All query parameters documented
- [ ] Request body schema defined
- [ ] All response schemas defined
- [ ] Tags configured in openapi.rs
- [ ] Components/schemas registered
- [ ] Security scheme added
- [ ] Swagger UI accessible
- [ ] Spec validation in CI
