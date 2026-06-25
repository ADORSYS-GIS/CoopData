# Backend Architecture & Flow Guide

> **Goal**: Understand how a request travels through the backend, what each layer does, and where to add new code.
> **Rule**: Requests flow in ONE direction: Route → Handler → Service/Repository → Database. Never skip layers.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DGAT BACKEND ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │  Client   │───►│  Axum Router │───►│  Middleware  │───►│  Handler   │ │
│  │ (Frontend)│    │  (routes/)   │    │  (auth/CORS) │    │(handlers/)│ │
│  └──────────┘    └──────────────┘    └─────────────┘    └─────┬─────┘ │
│                                                                  │        │
│                                       ┌──────────────────────────┤        │
│                                       │                          │        │
│                                       ▼                          ▼        │
│                              ┌─────────────┐           ┌──────────────┐    │
│                              │  Repository  │           │   Service    │    │
│                              │(repositories/)│           │  (services/) │    │
│                              └──────┬──────┘           └──────┬───────┘    │
│                                     │                          │           │
│                                     ▼                          ▼           │
│                              ┌─────────────┐           ┌──────────────┐    │
│                              │  SeaORM/DB   │           │  Keycloak/   │    │
│                              │  PostgreSQL  │           │  S3/External │    │
│                              └─────────────┘           └──────────────┘    │
│                                                                          │
│                          ┌─────────────┐                                  │
│                          │    Cache     │                                  │
│                          │ (In-Mem/Redis)│◄─── Checked BEFORE DB lookups  │
│                          └─────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow (Step by Step)

### Example: `POST /assessments`

```
1. CLIENT sends HTTP POST /assessments
       │
       ▼
2. AXUM ROUTER matches the route
   File: src/api/routes/api.rs
   .route("/assessments", post(create_assessment))
       │
       ▼
3. MIDDLEWARE runs (authentication)
   File: src/auth/middleware.rs
   - Extracts JWT token from Authorization header
   - Validates token with Keycloak
   - Attaches token to request as Extension<String>
       │
       ▼
4. HANDLER processes the request
   File: src/api/handlers/assessment.rs
   ┌─────────────────────────────────────────────┐
   │ pub async fn create_assessment(              │
   │     State(state): State<AppState>,          │  ← App state (DB, services)
   │     Extension(_token): Extension<String>,    │  ← Auth token
   │     Json(request): Json<CreateRequest>,      │  ← Parsed body
   │ ) -> AppResult<impl IntoResponse>            │  ← Typed error handling
   │                                              │
   │     // 1. VALIDATE input                    │
   │     if request.name.is_empty() {            │
   │         return Err(AppError::BadRequest(..)) │
   │     }                                        │
   │                                              │
   │     // 2. BUILD entity                      │
   │     let model = assessments::ActiveModel {   │
   │         assessment_id: Set(Uuid::new_v4()), │
   │         status: Set(AssessmentStatus::Draft),│
   │         ..request.into()                     │
   │     };                                       │
   │                                              │
   │     // 3. PERSIST via repository             │
   │     let created = AssessmentsRepository      │
   │         ::create(&state.db, model).await?;   │
   │                                              │
   │     // 4. INVALIDATE cache                   │
   │     state.cache.delete("assessments:all")    │
   │         .await;                               │
   │                                              │
   │     // 5. CONVERT to response DTO            │
   │     let response = AssessmentResponse        │
   │         ::from(created);                     │
   │                                              │
   │     // 6. RETURN                            │
   │     Ok((StatusCode::CREATED, Json(response)))│
   │ }                                            │
   └─────────────────────────────────────────────┘
       │
       ▼
5. ERROR HANDLER converts AppError to HTTP response
   File: src/error.rs
   - AppError::NotFound → 404 + JSON body
   - AppError::BadRequest → 400 + JSON body
   - AppError::DatabaseError → 500 + JSON body
       │
       ▼
6. CLIENT receives JSON response
   Status: 201 Created
   Body: { "id": "uuid", "status": "draft", ... }
```

---

## Layer Responsibilities

### Layer 1: Routes (`src/api/routes/`)

```
PURPOSE: Map URLs to handlers
RESPONSIBILITY: Route wiring ONLY
DO NOT: Add business logic, validation, or data transformation

Pattern:
  Router::new()
      .route("/", post(create_x))       // CREATE
      .route("/", get(list_x))          // LIST
      .route("/{id}", get(get_x))       // READ
      .route("/{id}", put(update_x))    // UPDATE
      .route("/{id}", delete(delete_x)) // DELETE
```

### Layer 2: Middleware (`src/api/middleware.rs`, `src/auth/`)

```
PURPOSE: Cross-cutting concerns
RESPONSIBILITY: Authentication, CORS, logging, rate limiting
DO NOT: Add business logic

Flow:
  Request → Auth Middleware → CORS → Handler
  - Auth middleware extracts and validates JWT
  - Attaches token as Extension<String> for handlers
```

### Layer 3: Handlers (`src/api/handlers/`)

```
PURPOSE: Orchestrate request handling
RESPONSIBILITY:
  1. Parse and validate input
  2. Call Service or Repository
  3. Convert result to response DTO
  4. Return HTTP response

DO NOT: Write SQL, call external APIs directly, complex business logic

Handler template:
  1. Validate input → early return on error
  2. Call repository/service → propagate errors with ?
  3. Invalidate cache if needed
  4. Convert entity → DTO
  5. Return (StatusCode, Json(dto))
```

### Layer 4: DTOs (`src/api/dto/`)

```
PURPOSE: Define API contract (request/response shapes)
RESPONSIBILITY: Input validation, serialization, documentation

Types of DTOs:
  - CreateRequest: POST body
  - UpdateRequest: PUT body
  - Response: GET response
  - Filters: Query parameters
  - PaginatedResponse<T>: List response with pagination
```

### Layer 5: Repositories (`src/repositories/`)

```
PURPOSE: Database operations ONLY
RESPONSIBILITY: CRUD queries, filters, joins
DO NOT: Business logic, HTTP concerns, external API calls

Pattern:
  pub struct XRepository;
  impl XRepository {
      pub async fn find_by_id(db: &DbConn, id: Uuid) -> AppResult<Option<Model>>
      pub async fn find_all(db: &DbConn) -> AppResult<Vec<Model>>
      pub async fn create(db: &DbConn, data: ActiveModel) -> AppResult<Model>
      pub async fn update(db: &DbConn, id: Uuid, data: ActiveModel) -> AppResult<Model>
      pub async fn delete(db: &DbConn, id: Uuid) -> AppResult<bool>
  }
```

### Layer 6: Services (`src/services/`)

```
PURPOSE: External integrations and complex business logic
RESPONSIBILITY: Keycloak API calls, S3 uploads, report generation
DO NOT: Raw SQL, HTTP response formatting

When to create a Service vs using Repository directly:
  USE SERVICE WHEN:
    - Calling external APIs (Keycloak, S3)
    - Logic spans 2+ repositories
    - Need caching or retry logic
    - Generating reports from multiple sources

  USE REPOSITORY DIRECTLY WHEN:
    - Simple CRUD on a single table
    - No external API calls needed
```

### Layer 7: Entities (`src/entities/`)

```
PURPOSE: Database table definitions (SeaORM models)
RESPONSIBILITY: Column types, relationships, enums
DO NOT: Business logic, API response formatting

Entity = 1:1 mapping to database table
DTO = API-facing representation (may combine multiple entities)
```

### Layer 8: Cache (`src/services/cache.rs`)

```
PURPOSE: Reduce DB load, speed up responses
RESPONSIBILITY: Store/frequently accessed data with TTL

Flow:
  Handler → Check Cache → Cache HIT → Return cached data
                         → Cache MISS → Repository → Store in Cache → Return data

Invalidation rules:
  - CREATE: Invalidate list caches
  - UPDATE: Invalidate entity + list caches
  - DELETE: Invalidate entity + list caches
```

---

## Offline-First Architecture Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST FLOW                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRONTEND (DexieDB)              BACKEND (PostgreSQL)            │
│  ┌─────────────┐                 ┌─────────────┐                │
│  │  IndexedDB   │──── SYNC ────►│  REST API   │                │
│  │  (Dexie)    │◄─── QUEUE ────│  (Axum)     │                │
│  └──────┬──────┘                 └──────┬──────┘                │
│         │                               │                        │
│  Online │                     ┌─────────┴─────────┐              │
│         ▼                     │                   │              │
│  ┌─────────────┐    ┌────────▼────┐   ┌──────────▼────┐        │
│  │ React Query  │    │ PostgreSQL  │   │   Keycloak    │        │
│  │  + Local DB  │    │   (SeaORM)  │   │  (External)   │        │
│  └─────────────┘    └─────────────┘   └───────────────┘        │
│                                                                  │
│  OFFLINE BEHAVIOR:                                               │
│  1. Read FROM IndexedDB (instant)                               │
│  2. Write TO IndexedDB + sync_queue                            │
│  3. On reconnect: flush sync_queue to backend                   │
│  4. Backend processes queue, returns updated data               │
│  5. Frontend merges server data into IndexedDB                  │
│                                                                  │
│  BACKEND ROLE:                                                   │
│  - Accept sync queue items                                       │
│  - Validate and persist each item                                │
│  - Return conflict resolution data                               │
│  - Provide full data snapshots for initial sync                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Backend Sync Endpoints

```
POST   /api/sync/push          ← Frontend sends pending changes
GET    /api/sync/pull          ← Frontend fetches latest data
POST   /api/sync/conflicts     ← Frontend resolves conflicts
```

---

## Error Flow

```
Handler calls Repository/Service
       │
       ├── Ok(data) ──────────────► Return JSON response
       │
       └── Err(error) ─────────────► AppError enum
                                        │
                                        ├── AppError::NotFound      → 404
                                        ├── AppError::BadRequest    → 400
                                        ├── AppError::Unauthorized  → 401
                                        ├── AppError::Conflict     → 409
                                        ├── AppError::Database     → 500
                                        ├── AppError::External     → 502
                                        └── AppError::Anyhow       → 500

Each error is logged via tracing before being converted to JSON:
  { "error": "Not found", "message": "Assessment not found: uuid", "code": 404 }
```

---

## Adding a New Feature: Complete Flow

### Example: Adding "Reports" feature

#### Step 1: Create Entity

**File:** `src/entities/report.rs`

- Define Model struct (maps to DB table)
- Define Relations
- Implement ActiveModelBehavior

#### Step 2: Create Migration

**File:** `migration/src/xxxx_create_reports_table.rs`

- CREATE TABLE with columns, constraints, indexes

#### Step 3: Create DTOs

**File:** `src/api/dto/report.rs`

- ReportCreateRequest
- ReportUpdateRequest
- ReportResponse
- Implement From<Entity> for Response

#### Step 4: Create Repository

**File:** `src/repositories/reports.rs`

- find_by_id, find_all, create, update, delete
- Optional: find*paginated, find_by*\*

#### Step 5: Create Handler

**File:** `src/api/handlers/report.rs`

- create_report, get_report, list_reports, update_report, delete_report
- Add #[utoipa::path] annotations
- Validate input, call repository, return DTO

#### Step 6: Create Routes

**File:** `src/api/routes/report.rs`

- Wire handlers to URLs
- Register in api.rs

#### Step 7: Register in OpenAPI

**File:** `src/api/openapi.rs`

- Add path to paths()
- Add schemas to components()

#### Step 8: Add to mod.rs files

- entities/mod.rs
- api/dto/mod.rs
- api/handlers/mod.rs
- api/routes/mod.rs
- repositories/mod.rs

---

## Dependency Injection via AppState

```
AppState is created once at startup and shared across all handlers:

┌──────────────────────────────────────────┐
│              AppState                     │
├──────────────────────────────────────────┤
│  db: Arc<DatabaseConnection>             │  ← SeaORM connection pool
│  keycloak_service: Arc<KeycloakService>   │  ← External auth service
│  jwt_validator: Arc<JwtValidator>         │  ← Token validation
│  report_service: Arc<ReportService>       │  ← Report generation
│  cache: Arc<CacheService>                │  ← In-memory cache
└──────────────────────────────────────────┘

Handlers receive AppState via axum's State extractor:
  pub async fn handler(State(state): State<AppState>) -> ...

Arc = Atomic Reference Counted (thread-safe, cloneable)
```

---

## Checklist for New Feature

- [ ] Entity defined with proper relations
- [ ] Migration created and tested
- [ ] DTOs defined (Create, Update, Response)
- [ ] From<Entity> for Response implemented
- [ ] Repository with CRUD methods
- [ ] Handler with validation and error handling
- [ ] #[utoipa::path] annotations on all endpoints
- [ ] Routes registered in api.rs
- [ ] OpenAPI schemas registered
- [ ] Cache invalidation on mutations
- [ ] Integration test written
