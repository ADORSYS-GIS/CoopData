# Rust Best Practices & Conventions

> **Goal**: Ensure every developer and AI follows the exact same patterns.
> **Rule**: When in doubt, refer to this document. Consistency > cleverness.

---

## Project Structure

```
src/
├── api/
│   ├── handlers/      # HTTP request handlers (thin orchestration)
│   ├── dto/           # Request/Response data types
│   ├── routes/        # URL to handler mapping
│   ├── middleware.rs  # Auth, CORS, logging
│   └── openapi.rs     # Swagger/OpenAPI config
├── auth/
│   ├── jwt_validator.rs
│   └── middleware.rs
├── config.rs          # App configuration
├── database.rs        # DB connection & migrations
├── entities/          # SeaORM entity definitions
├── error.rs           # AppError enum + IntoResponse
├── lib.rs             # AppState, run(), create_app()
├── models/            # Non-DB models (Keycloak types)
├── repositories/      # Database query layer
└── services/          # External APIs & complex logic
```

---

## Naming Conventions

```rust
// FILES: snake_case
assessment_repository.rs    // NOT AssessmentRepo.rs
organization_handler.rs     // NOT OrganizationHandler.rs

// TYPES: PascalCase
pub struct AssessmentStatus  // NOT assessment_status
pub enum AssessmentStatus    // NOT ASSESSMENT_STATUS

// FUNCTIONS: snake_case
pub async fn find_by_id()    // NOT findById
pub async fn create_assessment() // NOT CreateAssessment

// CONSTANTS: SCREAMING_SNAKE_CASE
const MAX_RETRIES: u32 = 3;
const DEFAULT_PAGE_SIZE: u32 = 20;

// DATABASE COLUMNS: snake_case
pub organization_id: String  // NOT organizationId

// DTO FIELDS (JSON): camelCase via serde rename
#[serde(rename = "organizationId")]
pub organization_id: String

// ERROR MESSAGES: Sentence case
"Assessment not found"      // NOT "assessment not found"
"Organization ID is required"
```

---

## Handler Pattern (Every Handler MUST Follow This)

```
1. EXTRACT parameters (State, Path, Json, Query)
2. VALIDATE input (return early on error)
3. CALL repository or service (use ? operator)
4. INVALIDATE cache if needed (on mutations)
5. CONVERT entity to DTO (From trait)
6. RETURN (StatusCode, Json(dto))
```

---

## Error Handling Rules

```rust
// ✅ DO: Use AppResult<T> everywhere
pub async fn handler() -> AppResult<impl IntoResponse> { }

// ❌ DON'T: Unwrap or expect in production
let val = result.unwrap();           // BAD
let val = result.expect("msg");      // BAD
let val = result.map_err(AppError::from)?;  // GOOD

// ✅ DO: Log with context
tracing::error!(assessment_id = %id, error = %e, "Failed to fetch assessment");

// ❌ DON'T: Expose internals to client
AppError::InternalServerError("Database connection pool exhausted".to_string())  // BAD
AppError::InternalServerError("Failed to retrieve data".to_string())  // GOOD

// ✅ DO: Use ok_or_else for Option handling
let entity = repository.find(id).await?
    .ok_or_else(|| AppError::NotFound(format!("Entity not found: {}", id)))?;
```

---

## Import Order

```rust
// 1. Standard library (std)
use std::sync::Arc;
use std::collections::HashMap;

// 2. External crates (alphabetical)
use axum::{extract::{Path, State}, http::StatusCode, Json};
use sea_orm::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// 3. Internal modules (alphabetical)
use crate::api::dto::assessment::*;
use crate::error::{AppError, AppResult};
use crate::repositories::assessments::AssessmentsRepository;
use crate::AppState;
```

---

## Logging Strategy

```rust
// INFO: Business events (always log these)
tracing::info!(assessment_id = %id, "Assessment created successfully");
tracing::info!(org_id = %org_id, members_deleted = count, "Organization deleted");

// WARN: Recoverable issues
tracing::warn!(user_id = %uid, "User deletion failed, continuing");

// ERROR: Unexpected failures (always with context)
tracing::error!(error = %e, assessment_id = %id, "Failed to create assessment");

// DEBUG: Detailed flow (only in development)
tracing::debug!(cache_key = %key, "Cache miss");
```

---

## API Response Format

```json
// Success responses
{ "data": { ... } }                    // Single item
{ "data": [...], "pagination": {...} } // List with pagination
{ "message": "Deleted successfully" }   // Delete/Update confirmation

// Error responses (from AppError)
{ "error": "Not found", "message": "Assessment not found: abc-123", "code": 404 }
{ "error": "Validation error", "message": "Name is required", "code": 400 }

// HTTP Status Codes
201 Created    → POST success
200 OK         → GET/PUT success
204 No Content → DELETE success
400 Bad Request → Validation error
401 Unauthorized → Missing/invalid token
404 Not Found  → Resource doesn't exist
409 Conflict   → Duplicate/unique violation
500 Internal   → Unexpected server error
```

---

## Performance Rules

1. **Use Arc<> for shared state** — Clone is cheap, lock is expensive
2. **Cache read-heavy endpoints** — Dimensions, levels, organizations
3. **Paginate all list endpoints** — max 100 items per page
4. **Use transactions for multi-table operations** — Begin, commit, or rollback
5. **Avoid N+1 queries** — Use `find_also_related` or eager loading
6. **Set HTTP client timeouts** — 30s default for external calls
7. **Use streaming for large responses** — Don't buffer entire datasets in memory

---

## Git Commit Convention

```
feat: add assessment export endpoint
fix: resolve duplicate organization creation
refactor: extract caching into service
docs: add rust architecture guide
test: add handler integration tests
chore: update dependencies
```

---

## Checklist Before Merging

- [ ] All handlers return `AppResult<impl IntoResponse>`
- [ ] All handlers have `#[utoipa::path]` annotation
- [ ] All new types have `Serialize, Deserialize, ToSchema`
- [ ] DTOs use `#[serde(rename = "camelCase")]`
- [ ] Error variants cover all failure modes
- [ ] Tracing added for business events
- [ ] Cache invalidated on mutations
- [ ] No `unwrap()` or `expect()` in production code
- [ ] Imports follow the order convention
- [ ] API routes registered in api.rs
- [ ] OpenAPI schemas registered
- [ ] Database migration created (if needed)
- [ ] Test written for new handler
