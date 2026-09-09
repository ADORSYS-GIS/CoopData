# T9 — Audit Trails & Tamper-Evident Logging

**Status:** In Progress  
**Labels:** `security`, `audit`, `logging`, `compliance`  
**Priority:** High

## Objective

Maintain an immutable record of sensitive system actions for compliance and security monitoring.

---

## Scope

### What We Audit ✅
- **Mutations only** — Create, update, delete operations
- **Sensitive actions** — Role changes, submissions, file uploads, AI extraction
- **Authentication events** — Login, logout, token refresh

### What We DON'T Audit ❌
- **Read-only operations** — Analytics, statistics, benchmarking
- **Health checks** — Public endpoints
- **List queries** — GET endpoints that don't modify data

---

## Implementation

### 1. Audit Infrastructure

| Component | File | Description |
|-----------|------|-------------|
| Entity | `backend/src/entities/audit_log.rs` | SeaORM entity for `audit_logs` table |
| Repository | `backend/src/repositories/audit_log.rs` | CRUD operations |
| Service | `backend/src/services/audit.rs` | `AuditService.log()` method |
| Middleware | `backend/src/api/middleware.rs` | `AuditContext` for IP/User-Agent |

### 2. Audit Schema

```sql
audit_logs (
  id                    UUID PRIMARY KEY,
  actor_keycloak_id      VARCHAR,     -- Keycloak user ID
  actor_id               UUID,       -- Internal user ID (nullable)
  action                VARCHAR,     -- Action type (create, update, delete, etc.)
  resource_type          VARCHAR,     -- Resource type (submission, user, etc.)
  resource_keycloak_id   VARCHAR,    -- Resource ID in Keycloak
  details               JSONB,      -- Additional context (old/new state)
  ip_address            VARCHAR,    -- Client IP address
  user_agent            VARCHAR,    -- Browser/client info
  created_at            TIMESTAMPTZ  -- Timestamp
)
```

### 3. Handlers with Audit Logging

| Handler | File | Actions Audited |
|---------|------|----------------|
| Apex | `apex.rs` | create, update, delete, member operations |
| Cooperative | `cooperative.rs` | create, update, delete, member operations |
| Federation | `federation.rs` | create, update, delete, invitation operations |
| Financial Statement | `financial_statement.rs` | create, update, delete |
| Me | `me.rs` | password change, profile update |
| Non-Financial Indicator | `non_financial_indicator.rs` | create, update, delete |
| Non-Financial | `non_financial.rs` | create, update, delete |
| Organization Label | `organization_label.rs` | create, update, delete |
| Organizations | `organizations.rs` | create, update, delete |
| Questionnaire | `questionnaire.rs` | create, update, delete |
| Users | `users.rs` | create, update, delete, role assignment |
| **Submission** | `submission.rs` | **NEW: create, update, delete, approve, reject** |
| **Custom KPI** | `custom_kpi.rs` | **NEW: create, update, delete** |
| **Upload** | `upload.rs` | **NEW: file upload events** |
| **Extraction** | `extraction.rs` | **NEW: extraction start, complete, fail** |

### 4. Authentication Audit Events

| Event | When Logged |
|-------|-------------|
| Login success | User successfully authenticates |
| Login failure | Authentication fails |
| Logout | User logs out |
| Token refresh | Access token refreshed |

---

## Audit Action Types

### Standard CRUD Actions
| Action | Description |
|--------|-------------|
| `create` | New resource created |
| `update` | Existing resource modified |
| `delete` | Resource deleted |
| `approve` | Resource approved (e.g., submission) |
| `reject` | Resource rejected (e.g., submission) |

### Authentication Actions
| Action | Description |
|--------|-------------|
| `login_success` | Successful authentication |
| `login_failure` | Failed authentication attempt |
| `logout` | User logged out |
| `token_refresh` | Access token refreshed |

### Resource Types
| Type | Description |
|------|-------------|
| `submission` | Financial/non-financial submission |
| `user` | User account |
| `apex` | Apex organization |
| `federation` | Federation organization |
| `cooperative` | Cooperative organization |
| `custom_kpi` | Custom KPI definition |
| `extraction_job` | AI extraction job |
| `uploaded_file` | Uploaded file |

---

## Tamper-Evidence Approach

### Current Protections

1. **No DELETE endpoint for audit_logs** — Audit records cannot be deleted via API
2. **Ministry-only access** — Only `ministry` role can view audit logs
3. **Database permissions** — Application user has INSERT-only permissions on audit_logs (recommended)
4. **Immutable timestamps** — `created_at` is set by server, not client

### Recommended Database Permissions

```sql
-- Application user should only have INSERT and SELECT on audit_logs
GRANT INSERT, SELECT ON audit_logs TO app_user;
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
```

### Future Enhancements (Not Implemented)

1. **Hash chains** — Each audit record includes hash of previous record
2. **Cryptographic signatures** — Sign audit records with private key
3. **External immutable storage** — Forward to S3/WORM storage
4. **Write-only DB user** — Separate credentials for audit writes

---

## Verification

### Manual Testing

1. **Create a submission** as a cooperative user
2. **Query audit logs** as ministry user
3. **Verify** the audit record exists with correct:
   - Actor (user who performed action)
   - Action (create/update/delete)
   - Resource (submission ID)
   - Timestamp
   - IP address
   - User agent

### API Verification

```bash
# As ministry user
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/v1/ministry/audit-logs?resource_type=submission"
```

Expected response:
```json
{
  "data": [
    {
      "id": "uuid",
      "actor_keycloak_id": "user-id",
      "action": "create",
      "resource_type": "submission",
      "resource_keycloak_id": "submission-id",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-09-08T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

## Acceptance Criteria

- [x] Audit entity and repository implemented
- [x] Audit middleware extracts IP/User-Agent
- [x] Core handlers (apex, cooperative, federation, users) have audit calls
- [ ] `submission.rs` has audit calls for all mutations
- [ ] `custom_kpi.rs` has audit calls for all mutations
- [ ] `upload.rs` has audit calls for file uploads
- [ ] `extraction.rs` has audit calls for extraction events
- [ ] Authentication events are audited (login, logout, token refresh)
- [ ] Integration tests verify audit logging works
- [ ] Tamper-evidence approach documented

---

## Files Modified

### Backend
- `backend/src/api/handlers/submission.rs` — Add audit calls
- `backend/src/api/handlers/custom_kpi.rs` — Add audit calls
- `backend/src/api/handlers/upload.rs` — Add audit calls
- `backend/src/api/handlers/extraction.rs` — Add audit calls
- `backend/src/auth/middleware.rs` — Add auth event audit logging
- `backend/tests/handlers_audit.rs` — Add integration tests

### Documentation
- `docs/features/t9-audit-trails.md` — This design doc
- `docs/architecture/progress.md` — Update T9 status