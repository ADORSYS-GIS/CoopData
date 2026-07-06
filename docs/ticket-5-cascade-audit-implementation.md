# Ticket 5: Cascade Deletion + Audit Logging — Full Stack Implementation

> **Issue**: [#12](https://github.com/ADORSYS-GIS/CoopData/issues/12)
> **Epic**: Multi-Level Identity & Access Management (IAM)
> **Status**: Complete
> **Branch**: `cascade-audit` (based on `develop` @ `757e731`)
> **Test Results**: 185 tests pass (149 unit + 15 audit integration + 16 cooperative + 5 users), 0 failures, 0 warnings

## Scope

Implement cascading deletion across the Federation → Apex → Cooperative hierarchy with full PostgreSQL tracking and audit logging for all mutations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Migration](#database-migration)
3. [SeaORM Entities](#seaorm-entities)
4. [Repositories](#repositories)
5. [Audit Service](#audit-service)
6. [Audit DTOs](#audit-dtos)
7. [Audit Handler & Query Endpoint](#audit-handler--query-endpoint)
8. [Cascade Deletion Flow](#cascade-deletion-flow)
9. [PG Tracking in Create Handlers](#pg-tracking-in-create-handlers)
10. [Auto-Backfill Mechanism](#auto-backfill-mechanism)
11. [Audit Logging in All Mutation Handlers](#audit-logging-in-all-mutation-handlers)
12. [App Wiring](#app-wiring)
13. [Routes & OpenAPI Registration](#routes--openapi-registration)
14. [Unit Tests](#unit-tests)
15. [Integration Tests](#integration-tests)
16. [Files Summary](#files-summary)

---

## Architecture Overview

### The Problem

The existing system managed entities (federations, apexes, cooperatives) exclusively through Keycloak. When a federation was deleted, only the Keycloak organization was removed — orphaning all child apex groups, cooperative subgroups, and member users in both Keycloak and PostgreSQL. There was no audit trail for mutations.

### The Solution

A 4-layer architecture was added alongside the existing Keycloak integration:

```
┌─────────────────────────────────────────────────────────┐
│                    Handler Layer                        │
│  (mutation handlers call audit.log + cascade delete)    │
├─────────────────────────────────────────────────────────┤
│                   AuditService                           │
│  (log(): builds ActiveModel from claims, calls repo)    │
├─────────────────────────────────────────────────────────┤
│               Repositories Layer                         │
│  (FederationRepo, ApexRepo, CooperativeRepo,            │
│   AuditLogRepo, UserRepository.delete_by_keycloak_id)   │
├─────────────────────────────────────────────────────────┤
│                  PostgreSQL                              │
│  (federations, apexes, cooperatives, audit_logs,        │
│   users with FK columns)                                │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Reads come from Keycloak** — the API returns Keycloak organization/group data. PostgreSQL is only for cascade deletion support and audit logging.
- **Audit logging is non-fatal** — if an audit log insert fails, the mutation still succeeds. The error is logged via `tracing::error!`.
- **Cascade deletion is resilient** — individual user/deletion failures are logged via `tracing::warn!` and don't abort the cascade.
- **Auto-backfill** — old entities created before PG tracking existed get PG rows auto-created when child entities are created under them.

---

## Database Migration

**File**: `backend/migrations/02_cascade_audit_tables.sql`

### Tables Created

#### `federations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `keycloak_id` | TEXT | Unique, KC organization ID |
| `display_name` | TEXT | Defaults to empty string |
| `is_active` | BOOLEAN | Defaults to true |
| `created_at` | TIMESTAMPTZ | Defaults to NOW() |
| `updated_at` | TIMESTAMPTZ | Defaults to NOW() |

#### `apexes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `keycloak_id` | TEXT | Unique, KC group ID |
| `federation_id` | UUID | FK → federations(id) ON DELETE CASCADE |
| `organization_keycloak_id` | TEXT | KC organization ID (for KC attribute matching) |
| `display_name` | TEXT | Defaults to empty string |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `cooperatives`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `keycloak_id` | TEXT | Unique, KC subgroup ID |
| `apex_id` | UUID | FK → apexes(id) ON DELETE CASCADE |
| `display_name` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `actor_keycloak_id` | TEXT | Who performed the action (from JWT `sub`) |
| `actor_id` | UUID | FK → users(id) ON DELETE SET NULL |
| `action` | TEXT | e.g. CREATE, UPDATE, DELETE, INVITE |
| `resource_type` | TEXT | e.g. federation, apex, cooperative, user |
| `resource_keycloak_id` | TEXT | Nullable, KC ID of affected entity |
| `details` | JSONB | Nullable, additional context (e.g. email, role) |
| `ip_address` | TEXT | Nullable |
| `user_agent` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Defaults to NOW() |

### Users Table Alterations

```sql
ALTER TABLE users ADD COLUMN federation_id UUID REFERENCES federations(id);
ALTER TABLE users ADD COLUMN apex_id UUID REFERENCES apexes(id);
ALTER TABLE users ADD COLUMN cooperative_id UUID REFERENCES cooperatives(id);
```

### Indexes

```sql
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_apexes_federation_id ON apexes(federation_id);
CREATE INDEX idx_cooperatives_apex_id ON cooperatives(apex_id);
```

---

## SeaORM Entities

### `entities/federation.rs`

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "federations")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub display_name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### `entities/apex.rs`

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "apexes")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub federation_id: Uuid,
    pub organization_keycloak_id: String,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

**Relations**: `BelongsTo` → `federation::Entity` (via `federation_id`)

### `entities/cooperative.rs`

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "cooperatives")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub apex_id: Uuid,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

**Relations**: `BelongsTo` → `apex::Entity` (via `apex_id`)

### `entities/audit_log.rs`

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "audit_logs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub actor_keycloak_id: String,
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub resource_type: String,
    pub resource_keycloak_id: Option<String>,
    pub details: Option<Json>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}
```

**Relations**: `BelongsTo` → `user::Entity` (via `actor_id`, ON DELETE SET NULL)

### `entities/user.rs` (modified)

Added columns: `federation_id: Option<Uuid>`, `apex_id: Option<Uuid>`, `cooperative_id: Option<Uuid>`

---

## Repositories

All repositories follow the pattern from `repositories/organization.rs`: struct with `DatabaseConnection`, `new()` constructor, async methods returning `AppResult<T>`.

### `repositories/federation.rs` — `FederationRepository`
| Method | Signature | Description |
|--------|----------|-------------|
| `create()` | `async fn create(&self, model: ActiveModel) -> AppResult<Model>` | Insert federation PG row |
| `find_by_keycloak_id()` | `async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<Model>>` | Look up by KC org ID |
| `delete()` | `async fn delete(&self, id: Uuid) -> AppResult<()>` | Delete by PG UUID |

### `repositories/apex.rs` — `ApexRepository`
| Method | Signature | Description |
|--------|----------|-------------|
| `create()` | `async fn create(&self, model: ActiveModel) -> AppResult<Model>` | Insert apex PG row |
| `find_by_keycloak_id()` | `async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<Model>>` | Look up by KC group ID |
| `find_by_federation_id()` | `async fn find_by_federation_id(&self, fed_id: Uuid) -> AppResult<Vec<Model>>` | All apexes under a federation |
| `delete()` | `async fn delete(&self, id: Uuid) -> AppResult<()>` | Delete by PG UUID |

### `repositories/cooperative.rs` — `CooperativeRepository`
| Method | Signature | Description |
|--------|----------|-------------|
| `create()` | `async fn create(&self, model: ActiveModel) -> AppResult<Model>` | Insert cooperative PG row |
| `find_by_keycloak_id()` | `async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<Model>>` | Look up by KC subgroup ID |
| `find_by_apex_id()` | `async fn find_by_apex_id(&self, apex_id: Uuid) -> AppResult<Vec<Model>>` | All cooperatives under an apex |
| `delete()` | `async fn delete(&self, id: Uuid) -> AppResult<()>` | Delete by PG UUID |

### `repositories/audit_log.rs` — `AuditLogRepository`
| Method | Signature | Description |
|--------|----------|-------------|
| `create()` | `async fn create(&self, model: ActiveModel) -> AppResult<Model>` | Insert audit log entry |
| `find_by_filters()` | `async fn find_by_filters(&self, action, resource_type, actor_keycloak_id, resource_keycloak_id, date_from, date_to, page, per_page) -> AppResult<(Vec<Model>, u64)>` | Paginated filtered query |

**Filter logic**: Each filter is `Option<String>`. If `Some`, a `ColumnTrait::eq()` filter is applied. Results ordered by `created_at DESC`. Pagination via `offset((page-1)*per_page).limit(per_page)`. Returns `(models, total_count)`.

### `repositories/user.rs` (modified)

Added method:
```rust
pub async fn delete_by_keycloak_id(&self, keycloak_id: &str) -> AppResult<()> {
    Entity::delete()
        .filter(user::Column::KeycloakId.eq(keycloak_id))
        .exec(&self.db)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to delete user: {}", e)))?;
    Ok(())
}
```

---

## Audit Service

**File**: `services/audit.rs`

```rust
pub struct AuditService {
    repo: AuditLogRepository,
    user_repo: UserRepository,
}
```

### `log()` Method

```rust
pub async fn log(
    &self,
    claims: &Claims,
    action: &str,
    resource_type: &str,
    resource_keycloak_id: Option<&str>,
    details: Option<serde_json::Value>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> AppResult<audit_log::Model>
```

**Flow:**
1. Look up `claims.sub` in PG users table via `user_repo.find_by_keycloak_id()` to get `actor_id`
2. Build `audit_log::ActiveModel` with:
   - `id`: `Uuid::new_v4()`
   - `actor_keycloak_id`: `claims.sub.clone()`
   - `actor_id`: `Option<Uuid>` (None if user not in PG)
   - `action`, `resource_type`, `resource_keycloak_id`, `details`, `ip_address`, `user_agent`
   - `created_at`: `chrono::Utc::now()`
3. Call `repo.create(model)` and return the inserted model

### `repo()` Accessor

```rust
pub fn repo(&self) -> &AuditLogRepository { &self.repo }
```

Used by the audit handler to call `find_by_filters()` directly.

### IP Address & User Agent Extraction (Audit Context Middleware)

The `AuditContext` middleware (`backend/src/api/middleware.rs`) automatically extracts the client IP address and user agent from every authenticated HTTP request and stores them in request extensions as `AuditContext`:

```rust
#[derive(Clone, Debug, Default)]
pub struct AuditContext {
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

pub async fn audit_context_layer(mut req: Request<Body>, next: Next) -> Response
```

**IP resolution order:**
1. `X-Forwarded-For` header (first IP in comma-separated chain — used when behind reverse proxy/load balancer)
2. `X-Real-IP` header
3. `ConnectInfo<SocketAddr>` extension (direct connection — requires `into_make_service_with_connect_info` in main.rs)

**User agent** is read directly from the `User-Agent` HTTP header.

**Wiring:** The middleware is applied in `create_app()` after `auth_layer`, so it runs on all protected routes. In `main.rs`, `axum::serve()` uses `into_make_service_with_connect_info::<SocketAddr>()` to make `ConnectInfo` available.

**Handler integration:** All 28 `audit.log()` calls across 6 handler files now read `Extension(audit_ctx): Extension<AuditContext>` and pass `audit_ctx.ip_address.as_deref()` and `audit_ctx.user_agent.as_deref()` to the AuditService, instead of `None`.

---

## Audit DTOs

**File**: `dto/audit.rs`

### `AuditLogResponse`

```rust
pub struct AuditLogResponse {
    pub id: Uuid,
    pub actor_keycloak_id: String,
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub resource_type: String,
    pub resource_keycloak_id: Option<String>,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}
```

Implements `From<audit_log::Model>`.

### `PaginatedAuditLogResponse`

```rust
pub struct PaginatedAuditLogResponse {
    pub data: Vec<AuditLogResponse>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}
```

**Pagination math**: `total_pages = (total + per_page - 1) / per_page`

### `AuditLogFilterParams`

```rust
#[derive(Deserialize, IntoParams)]
pub struct AuditLogFilterParams {
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub actor_keycloak_id: Option<String>,
    pub resource_keycloak_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,      // default: 1
    #[serde(default = "default_per_page")]
    pub per_page: u64,  // default: 20
}
```

---

## Audit Handler & Query Endpoint

**File**: `handlers/audit.rs`

### `list_audit_logs`

```rust
#[utoipa::path(
    get,
    path = "/api/v1/ministry/audit-logs",
    params(AuditLogFilterParams),
    responses(
        (status = 200, description = "Paginated audit logs", body = PaginatedAuditLogResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse),
    ),
    tag = "Ministry"
)]
pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(params): Query<AuditLogFilterParams>,
) -> AppResult<impl IntoResponse>
```

**Route**: `GET /api/v1/ministry/audit-logs` (ministry-only, enforced by `role_guard_layer`)

**Flow**:
1. Call `state.audit.repo().find_by_filters()` with filter params
2. Map `Vec<audit_log::Model>` to `Vec<AuditLogResponse>`
3. Compute `total_pages`
4. Return `PaginatedAuditLogResponse` as JSON

---

## Cascade Deletion Flow

The cascade deletion is the core feature. When deleting an entity, ALL child entities and ALL member users are deleted from both Keycloak and PostgreSQL.

### `delete_federation(id: String)` — Ministry role required

```
delete_federation(organization_keycloak_id)
│
├── 1. Look up federation PG record: federation_repo.find_by_keycloak_id(id)
│
├── 2. Delete all ORGANIZATION MEMBERS from KC + PG
│     KC: get_organization_members(id) → for each member:
│         keycloak.delete_user(member.id)        [warn on failure]
│         user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│
├── 3. Delete all APEXES under this federation
│     apex_repo.find_by_federation_id(fed.id) → for each apex:
│     │
│     ├── 3a. Delete all APEX GROUP MEMBERS from KC + PG
│     │       KC: get_group_members(apex.keycloak_id) → for each member:
│     │           keycloak.delete_user(member.id)       [warn on failure]
│     │           user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│     │
│     ├── 3b. Delete all COOPERATIVES under this apex
│     │       coop_repo.find_by_apex_id(apex.id) → for each coop:
│     │       │
│     │       ├── 3b-i. Delete all COOPERATIVE SUBGROUP MEMBERS from KC + PG
│     │       │       KC: get_group_members(coop.keycloak_id) → for each member:
│     │       │           keycloak.delete_user(member.id)      [warn on failure]
│     │       │           user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│     │       │
│     │       ├── 3b-ii. KC: delete_group(coop.keycloak_id)
│     │       └── 3b-iii. PG: coop_repo.delete(coop.id)
│     │
│     ├── 3c. KC: delete_group(apex.keycloak_id)
│     └── 3d. PG: apex_repo.delete(apex.id)
│
├── 4. KC: delete_organization(id)
├── 5. PG: federation_repo.delete(fed.id)
├── 6. Audit: log("DELETE", "federation", id, details={name})
└── 7. Return 204 No Content
```

### `delete_apex(id: String)` — Federation role required

```
delete_apex(group_keycloak_id)
│
├── 1. Look up apex PG record: apex_repo.find_by_keycloak_id(id)
├── 2. Audit: log("DELETE", "apex", id) [logged BEFORE cascade starts]
│
├── 3. Delete all APEX GROUP MEMBERS from KC + PG
│     KC: get_group_members(id) → for each member:
│         keycloak.delete_user(member.id)        [warn on failure]
│         user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│
├── 4. Delete all COOPERATIVES under this apex
│     coop_repo.find_by_apex_id(apex.id) → for each coop:
│     ├── 4a. Delete all COOPERATIVE SUBGROUP MEMBERS from KC + PG
│     │       KC: get_group_members(coop.keycloak_id) → for each member:
│     │           keycloak.delete_user(member.id)      [warn on failure]
│     │           user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│     ├── 4b. KC: delete_group(coop.keycloak_id)
│     └── 4c. PG: coop_repo.delete(coop.id)
│
├── 5. KC: delete_group(id)
├── 6. PG: apex_repo.delete(apex.id)
└── 7. Return 204 No Content
```

### `delete_cooperative(id: String)` — Apex role required

```
delete_cooperative(subgroup_keycloak_id)
│
├── 1. Look up cooperative PG record: coop_repo.find_by_keycloak_id(id)
├── 2. Audit: log("DELETE", "cooperative", id) [logged BEFORE cascade starts]
│
├── 3. Delete all COOPERATIVE SUBGROUP MEMBERS from KC + PG
│     KC: get_group_members(id) → for each member:
│         keycloak.delete_user(member.id)        [warn on failure]
│         user_repo.delete_by_keycloak_id(member.id)  [warn on failure]
│
├── 4. KC: delete_group(id)
├── 5. PG: coop_repo.delete(coop.id)
└── 6. Return 204 No Content
```

### Error Handling Philosophy

- **User deletion failures** (KC or PG): Logged via `tracing::warn!`, cascade continues. One orphaned user doesn't block the entire deletion.
- **Entity deletion failures** (delete_group, delete_organization): Use `?` operator to propagate error and abort the operation with appropriate HTTP status.
- **Audit logging failures**: Logged via `tracing::error!`, mutation still succeeds. Audit is non-fatal.
- **PG record not found**: If `find_by_keycloak_id()` returns `None`, the cascade still attempts to delete the KC entity (Keycloak is the source of truth for reads). PG tracking is supplementary for cascade support.

---

## PG Tracking in Create Handlers

When creating entities, PG rows are inserted after the Keycloak operation succeeds. This enables cascade deletion later.

### `create_federation`

```rust
// After KC.create_organization() succeeds:
let fed_model = federation::ActiveModel {
    id: Set(Uuid::new_v4()),
    keycloak_id: Set(group.id.clone()),  // KC org ID
    display_name: Set(body.name.clone()),
    is_active: Set(true),
    created_at: Set(Utc::now()),
    updated_at: Set(Utc::now()),
};
if let Err(e) = state.federation_repo.create(fed_model).await {
    tracing::warn!("Failed to track federation in PG: {}", e);
}
```

### `create_apex`

```rust
// After KC.create_subgroup() succeeds:
// 1. Look up federation PG record by KC org ID
let federation_pg = match state.federation_repo.find_by_keycloak_id(&org_id).await {
    Ok(Some(fed)) => fed,
    Ok(None) => {
        // AUTO-BACKFILL: create missing federation PG record
        let fed_model = federation::ActiveModel { ... };
        state.federation_repo.create(fed_model).await?
    }
    Err(e) => return Err(AppError::InternalServerError(...)),
};

// 2. Insert apex PG record with federation_id FK
let apex_model = apex::ActiveModel {
    id: Set(Uuid::new_v4()),
    keycloak_id: Set(group.id.clone()),  // KC group ID
    federation_id: Set(federation_pg.id),  // PG UUID from step 1
    organization_keycloak_id: Set(org_id.clone()),
    display_name: Set(body.name.clone()),
    ...
};
if let Err(e) = state.apex_repo.create(apex_model).await {
    tracing::warn!("Failed to track apex in PG: {}", e);
}
```

### `create_cooperative`

```rust
// After KC.create_subgroup() succeeds:
// 1. Look up apex PG record by KC group ID
let apex_pg = match state.apex_repo.find_by_keycloak_id(&apex_group_id).await {
    Ok(Some(apex)) => apex,
    Ok(None) => {
        // AUTO-BACKFILL: create missing apex PG record
        // Read organization_id from KC group attributes
        // Look up federation PG record
        // Create apex ActiveModel with federation_id FK
        ...
    }
    Err(e) => return Err(AppError::InternalServerError(...)),
};

// 2. Insert cooperative PG record with apex_id FK
let coop_model = cooperative::ActiveModel {
    id: Set(Uuid::new_v4()),
    keycloak_id: Set(group.id.clone()),
    apex_id: Set(apex_pg.id),  // PG UUID from step 1
    display_name: Set(body.name.clone()),
    ...
};
if let Err(e) = state.cooperative_repo.create(coop_model).await {
    tracing::warn!("Failed to track cooperative in PG: {}", e);
}
```

---

## Auto-Backfill Mechanism

### Problem

Entities created before PG tracking was implemented (old Keycloak-only data) have no PG rows. When creating child entities under them, FK constraints fail because the parent PG record doesn't exist.

### Solution

When `find_by_keycloak_id()` returns `None` for a parent entity, auto-create the missing PG row:

1. **`create_apex`**: If federation PG row not found, read the KC organization to get its display name, create `federation::ActiveModel` with the KC org ID as `keycloak_id`.

2. **`create_cooperative`**: If apex PG row not found:
   - Read the KC group to get its `organization_id` attribute
   - Look up the federation PG record by that org ID
   - Create `apex::ActiveModel` with both `federation_id` (PG UUID) and `organization_keycloak_id` (KC org ID)

This gracefully handles old data without requiring a manual migration script. New entities created after this change always have PG rows.

---

## Audit Logging in All Mutation Handlers

Every mutation handler calls `state.audit.log(...)` after the Keycloak operation succeeds. The audit call is non-fatal — if it fails, the mutation still succeeds.

### Federation Handlers (`handlers/federation.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `create_federation` | `CREATE` | `federation` | `{name}` |
| `update_federation` | `UPDATE` | `federation` | `{name, description}` |
| `delete_federation` | `DELETE` | `federation` | `{name}` |
| `invite_user_to_federation` | `INVITE` | `federation` | `{email, role}` |
| `delete_federation_invitation` | `DELETE_INVITATION` | `federation_invitation` | `{federation_id}` |
| `resend_federation_invitation` | `RESEND_INVITATION` | `federation_invitation` | `{federation_id}` |
| `remove_federation_member` | `DELETE` | `member` | `{federation_id}` |
| `update_federation_profile` | `UPDATE_PROFILE` | `federation` | `{description}` |

### Apex Handlers (`handlers/apex.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `create_apex` | `CREATE` | `apex` | `{name}` |
| `update_apex` | `UPDATE` | `apex` | `{name, description}` |
| `delete_apex` | `DELETE` | `apex` | — (logged BEFORE cascade) |
| `update_apex_member` | `UPDATE_MEMBER` | `apex_member` | `{group_id, first_name, last_name}` |
| `remove_apex_member` | `DELETE` | `member` | `{group_id}` |
| `resend_apex_member_verification` | `RESEND_VERIFICATION` | `apex_member` | `{group_id}` |

### Cooperative Handlers (`handlers/cooperative.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `create_cooperative` | `CREATE` | `cooperative` | `{name}` |
| `update_cooperative` | `UPDATE` | `cooperative` | `{name, description}` |
| `delete_cooperative` | `DELETE` | `cooperative` | — (logged BEFORE cascade) |
| `update_cooperative_member` | `UPDATE_MEMBER` | `cooperative_member` | `{group_id, first_name, last_name}` |
| `remove_cooperative_member` | `DELETE` | `member` | `{group_id}` |
| `resend_cooperative_member_verification` | `RESEND_VERIFICATION` | `cooperative_member` | `{group_id}` |

### User Handlers (`handlers/users.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `create_user` | `CREATE` | `user` | `{email, role}` |
| `update_user` | `UPDATE` | `user` | `{role, region}` |
| `assign_role_to_user` | `ASSIGN_ROLE` | `user` | `{role}` |
| `delete_user` | `DELETE` | `user` | `{email}` |

### Organization Handlers (`handlers/organizations.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `create_organization` | `CREATE` | `organization` | `{name}` |
| `update_organization` | `UPDATE` | `organization` | `{name}` |
| `delete_organization` | `DELETE` | `organization` | — |

### Self-Service Handlers (`handlers/me.rs`)

| Handler | Action | Resource Type | Details |
|---------|--------|---------------|---------|
| `change_password` | `CHANGE_PASSWORD` | `user` | — |

---

## App Wiring

### `lib.rs` — AppState

```rust
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
    pub keycloak: KeycloakService,
    pub jwt_validator: Arc<auth::JwtValidator>,
    pub federation_repo: FederationRepository,
    pub apex_repo: ApexRepository,
    pub cooperative_repo: CooperativeRepository,
    pub user_repo: UserRepository,
    pub audit: AuditService,
}
```

Re-exports: `FederationRepository`, `ApexRepository`, `CooperativeRepository`, `UserRepository`, `AuditService`

### `main.rs` — Initialization

```rust
let federation_repo = FederationRepository::new(db.clone());
let apex_repo = ApexRepository::new(db.clone());
let cooperative_repo = CooperativeRepository::new(db.clone());
let user_repo = UserRepository::new(db.clone());
let audit = AuditService::new(
    AuditLogRepository::new(db.clone()),
    user_repo.clone(),
);
```

---

## Routes & OpenAPI Registration

### Routes (`routes/ministry.rs`)

Added audit-logs endpoint:
```rust
.route(
    "/audit-logs",
    get(handlers::audit::list_audit_logs),
)
```

### Route Refactoring (`routes/federation.rs`)

Replaced inline handler implementations with delegations to `handlers::apex::*`. The develop branch had ~400 lines of inline handler code in the routes file that shadowed the handler module. All apex routes now delegate to the handler functions, ensuring PG tracking and audit logging are called.

### OpenAPI (`openapi.rs`)

Registered:
- Path: `handlers::audit::list_audit_logs`
- Schemas: `AuditLogResponse`, `PaginatedAuditLogResponse`, `AuditLogFilterParams`

---

## Unit Tests

**File**: `dto/audit.rs` (`#[cfg(test)]` module)

7 unit tests testing DTO conversions and serialization:

| Test Name | What It Tests |
|-----------|---------------|
| `test_audit_log_response_from_model_full` | `From<Model>` conversion with all fields populated (actor_id, details, ip, user_agent, resource_keycloak_id) |
| `test_audit_log_response_from_model_nulls` | `From<Model>` conversion with nullable fields as `None` (actor_id=None, details=None, etc.) |
| `test_filter_params_defaults` | `AuditLogFilterParams` serde deserialization with no params → page=1, per_page=20 |
| `test_filter_params_custom_values` | `AuditLogFilterParams` with all fields provided including page=3, per_page=50 |
| `test_filter_params_partial_defaults` | `AuditLogFilterParams` with only some fields → others use defaults |
| `test_paginated_response_serialization` | `PaginatedAuditLogResponse` with 2 items, total=50, page=1, per_page=20, total_pages=3 |
| `test_paginated_response_empty` | `PaginatedAuditLogResponse` with 0 items, total=0, total_pages=0 |

**Test pattern**: Build `audit_log::Model` manually with test UUIDs, convert to `AuditLogResponse` via `From`, assert field equality.

---

## Integration Tests

**File**: `tests/handlers_audit.rs`

15 integration tests using `TestApp::new()` with:
- Disconnected DB (`DatabaseConnection::default()`) — no real PG connection needed for RBAC/serialization tests
- Offline Redis (`CacheService::new("redis://offline")`)
- No-op Keycloak (`KeycloakService::new()` with mock config)
- Permissive JWT validator (accepts all tokens)
- All repos + AuditService initialized

### Test Categories

#### RBAC Tests (4 tests)

| Test | Method | Expected |
|------|--------|----------|
| `audit_logs_unauthorized_without_auth_header` | GET `/api/v1/ministry/audit-logs` | **401 Unauthorized** |
| `audit_logs_forbidden_for_federation_role` | GET with `federation` role | **403 Forbidden** |
| `audit_logs_forbidden_for_apex_role` | GET with `apex` role | **403 Forbidden** |
| `audit_logs_forbidden_for_cooperative_role` | GET with `cooperative` role | **403 Forbidden** |

#### Filter Params Tests (2 tests)

| Test | What It Tests |
|------|---------------|
| `audit_log_filter_params_deserialize_defaults` | Query string with no params → page=1, per_page=20 |
| `audit_log_filter_params_deserialize_custom` | Query string `?action=DELETE&page=2&per_page=10` → correct values |

#### DTO Conversion Tests (2 tests)

| Test | What It Tests |
|------|---------------|
| `audit_log_response_from_model_full` | All fields populated |
| `audit_log_response_from_model_nulls` | Nullable fields as None |

#### Pagination Tests (1 test)

| Test | What It Tests |
|------|---------------|
| `pagination_math_correct` | total=50, per_page=20 → total_pages=3; total=40, per_page=20 → total_pages=2 |

#### Route Registration Tests (1 test)

| Test | What It Tests |
|------|---------------|
| `audit_logs_route_registered` | GET without auth → 401 (not 404), proving route exists |

#### OpenAPI Spec Tests (2 tests)

| Test | What It Tests |
|------|---------------|
| `openapi_includes_audit_logs_path` | ApiDoc contains `/api/v1/ministry/audit-logs` |
| `openapi_includes_audit_schemas` | ApiDoc contains `AuditLogResponse`, `PaginatedAuditLogResponse`, `AuditLogFilterParams` |

#### Service Initialization Tests (2 tests)

| Test | What It Tests |
|------|---------------|
| `audit_service_initialized_in_app_state` | `state.audit` exists and `state.audit.repo()` returns a valid repository |
| `audit_log_repository_available` | `AuditLogRepository::new(db)` creates without panic |

### Test Helper

```rust
async fn make_request(app: &Router, method: &str, path: &str, token: &str) -> Response {
    let mut req = Request::builder().method(method).uri(path);
    if !token.is_empty() {
        req = req.header("authorization", format!("Bearer {}", token));
    }
    let req = req.body(Body::empty()).unwrap();
    app.oneshot(req).await
}
```

Test tokens are JWTs with controlled `realm_access.roles` arrays to test RBAC enforcement.

---

## Files Summary

| # | File | Action | Lines Changed |
|---|------|--------|---------------|
| 1 | `backend/migrations/02_cascade_audit_tables.sql` | **Created** | +3 (incremental) |
| 2 | `backend/src/entities/federation.rs` | **Created** | +24 |
| 3 | `backend/src/entities/apex.rs` | **Created** | +39 |
| 4 | `backend/src/entities/cooperative.rs` | **Created** | +36 |
| 5 | `backend/src/entities/audit_log.rs` | **Created** | +34 |
| 6 | `backend/src/entities/user.rs` | **Modified** | +33 (FK columns) |
| 7 | `backend/src/entities/mod.rs` | **Modified** | +16 (re-exports) |
| 8 | `backend/src/repositories/federation.rs` | **Created** | +50 |
| 9 | `backend/src/repositories/apex.rs` | **Created** | +58 |
| 10 | `backend/src/repositories/cooperative.rs` | **Created** | +58 |
| 11 | `backend/src/repositories/audit_log.rs` | **Created** | +69 |
| 12 | `backend/src/repositories/user.rs` | **Modified** | +10 (delete_by_keycloak_id) |
| 13 | `backend/src/repositories/mod.rs` | **Modified** | +8 (re-exports) |
| 14 | `backend/src/repositories/organization.rs` | **Modified** | +1 (Clone derive) |
| 15 | `backend/src/api/dto/audit.rs` | **Created** | +199 (DTOs + 7 unit tests) |
| 16 | `backend/src/api/dto/mod.rs` | **Modified** | +2 (pub mod audit) |
| 17 | `backend/src/services/audit.rs` | **Created** | +55 |
| 18 | `backend/src/services/mod.rs` | **Modified** | +2 |
| 19 | `backend/src/api/handlers/audit.rs` | **Created** | +60 |
| 20 | `backend/src/api/handlers/mod.rs` | **Modified** | +2 (pub mod audit) |
| 21 | `backend/src/api/handlers/federation.rs` | **Modified** | +204 (cascade + audit + auto-backfill) |
| 22 | `backend/src/api/handlers/apex.rs` | **Modified** | +192 (cascade + audit + auto-backfill + list fix) |
| 23 | `backend/src/api/handlers/cooperative.rs` | **Modified** | +181 (cascade + audit + auto-backfill) |
| 24 | `backend/src/api/handlers/users.rs` | **Modified** | +72 (audit logging + Extension claims) |
| 25 | `backend/src/api/handlers/organizations.rs` | **Modified** | +55 (audit logging + Extension claims) |
| 26 | `backend/src/api/handlers/me.rs` | **Modified** | +16 (audit logging) |
| 27 | `backend/src/api/routes/federation.rs` | **Modified** | -421 (inline handlers → delegations) |
| 28 | `backend/src/api/routes/ministry.rs` | **Modified** | +3 (audit-logs route) |
| 29 | `backend/src/api/openapi.rs` | **Modified** | +4 (schemas + paths) |
| 30 | `backend/src/lib.rs` | **Modified** | +12 (AppState + re-exports) |
| 31 | `backend/src/main.rs` | **Modified** | +22 (repo + service init) |
| 32 | `backend/tests/handlers_audit.rs` | **Created** | +332 (15 integration tests) |
| 33 | `backend/tests/common/mock.rs` | **Modified** | +22 (AppState update for new fields) |
| 34 | `scripts/apply-migration-and-rebuild.sh` | **Created** | +13 |

**Total**: 34 files, +1884 / -424 lines

---

## Design Decisions

### Why PostgreSQL tracking alongside Keycloak?

Keycloak is the source of truth for entity data (reads come from Keycloak). However, Keycloak doesn't provide efficient:
- "Find all apexes under federation X" queries
- "Find all cooperatives under apex Y" queries
- Hierarchical cascade relationships

PostgreSQL provides these via foreign keys with `ON DELETE CASCADE`, enabling efficient cascade queries during deletion.

### Why is audit logging non-fatal?

Audit logs are observability infrastructure, not business logic. A failed audit insert should not roll back a successful user-facing operation (e.g., a federation should still be created even if the audit log insertion fails). The `tracing::error!` log ensures developers know about the failure for debugging.

### Why audit BEFORE cascade in delete_apex/delete_cooperative?

For `delete_apex` and `delete_cooperative`, the audit log is written BEFORE the cascade starts. This ensures the audit record exists even if the cascade partially fails. For `delete_federation`, the audit is written AFTER the cascade (the federation ID is logged at the end).

### Why auto-backfill instead of a migration script?

A migration script would need to read every Keycloak organization and group, determine hierarchies by reading attributes, and insert PG rows. This is complex and error-prone. Auto-backfill handles this lazily — when a child entity is created under a parent that has no PG row, the parent row is auto-created on-the-fly. This handles the transition gracefully without requiring a separate script.