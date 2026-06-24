# Rust OpenAPI Documentation Guide

> **Goal**: Auto-document all API endpoints with OpenAPI/Swagger for discoverability and client generation.
> **Rule**: EVERY handler MUST have `#[utoipa::path(...)]` annotation with complete documentation.

---

## How to Add OpenAPI Documentation

### Step 1: Add utoipa Annotations to Handler

**File:** `src/api/handlers/assessment.rs`

```rust
use utoipa::ToSchema;

/// Handler documentation format:
/// 1. HTTP method and path
/// 2. Tag for grouping
/// 3. Path parameters
/// 4. Request body schema
/// 5. All possible responses

#[utoipa::path(
    post,
    path = "/assessments",
    tag = "Assessment",
    request_body = AssessmentCreateRequest,
    responses(
        (status = 201, description = "Assessment created successfully", body = Assessment),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_assessment(
    State(state): State<AppState>,
    Extension(_token): Extension<String>,
    Json(request): Json<AssessmentCreateRequest>,
) -> AppResult<impl IntoResponse> {
    // Handler implementation
}
```

### Step 2: Document All Path Parameters

```rust
#[utoipa::path(
    get,
    path = "/assessments/{assessment_id}",
    tag = "Assessment",
    params(
        ("assessment_id" = Uuid, Path, description = "Assessment unique identifier")
    ),
    responses(
        (status = 200, description = "Assessment found", body = Assessment),
        (status = 404, description = "Assessment not found", body = ErrorResponse)
    )
)]
pub async fn get_assessment(
    Path(assessment_id): Path<Uuid>,
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    // ...
}
```

### Step 3: Document Query Parameters

```rust
#[derive(Debug, Deserialize, IntoParams)]
pub struct AssessmentFilters {
    /// Filter by organization ID
    pub organization_id: Option<String>,
    /// Filter by status
    pub status: Option<String>,/// Page number (default: 1)
    #[serde(default = "default_page")]
    pub page: u32,
    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    pub per_page: u32,
}

#[utoipa::path(
    get,
    path = "/assessments",
    tag = "Assessment",
    params(AssessmentFilters),
    responses(
        (status = 200, description = "List of assessments", body = PaginatedResponse<Assessment>)
    )
)]
pub async fn list_assessments(
    Query(filters): Query<AssessmentFilters>,
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    // ...
}
```

### Step 4: Define Response Schemas

**File:** `src/api/dto/assessment.rs`

```rust
use utoipa::ToSchema;

/// Assessment response schema
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AssessmentResponse {
    /// Unique identifier
    pub id: Uuid,
    /// Organization ID
    pub organization_id: String,
    /// Document title
    #[schema(example = "Digital Maturity Assessment 2024")]
    pub document_title: String,
    /// Current status
    pub status: AssessmentStatus,
}

/// Error response schema
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    /// Error type
    pub error: String,
    /// Human-readable message
    pub message: String,
    /// HTTP status code
    pub code: u16,
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