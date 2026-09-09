# T10 — Error Handling & Safe User Messages

**Status:** In Progress  
**Labels:** `security`, `backend`, `frontend`, `error-handling`  
**Priority:** High

## Objective

Prevent sensitive implementation details from being exposed to users while maintaining a good developer experience during development.

## Backend Implementation

### Current State

The backend already implements safe error handling in `backend/src/error.rs`:

| Error Type | Internal Log | External Response |
|------------|--------------|-------------------|
| `InternalServerError` | Full error details via `tracing::error!` | Generic "An internal error occurred" |
| `DatabaseError` | Full `DbErr` via `tracing::error!` | "Failed to process database request" |
| `CacheError` | Full error details via `tracing::error!` | "Failed to process cache request" |
| `ExternalServiceError` | Full error details via `tracing::error!` | "Failed to process external request" |
| `BadRequest` | N/A | User-provided message (safe) |
| `Unauthorized` | N/A | User-provided message (safe) |
| `Forbidden` | N/A | User-provided message (safe) |
| `NotFound` | N/A | User-provided message (safe) |

### Response Format

```json
{
  "error": "internal_server_error",
  "message": "An internal error occurred"
}
```

### Integration Tests Required

1. **Database Error Test** — Trigger a DB constraint violation, verify safe response
2. **Invalid UUID Test** — Send malformed UUID, verify safe 400 response
3. **Not Found Test** — Request non-existent resource, verify safe 404 response
4. **Validation Error Test** — Send invalid payload, verify safe validation message
5. **Internal Error Test** — Mock internal failure, verify no stack trace in response

## Frontend Implementation

### ErrorBoundary Component

**Location:** `frontend/src/components/shared/ErrorBoundary.tsx`

**Security Behavior:**
- Raw errors are **NEVER shown in the UI** (prevents information disclosure)
- All errors are logged to **DevTools Console (F12)** for debugging
- Users always see a safe, user-friendly message

**What Users See:**
```
┌─────────────────────────────────────┐
│ Something went wrong                │
│                                     │
│ An error occurred in this section   │
│                                     │
│ (No raw error shown)                │
└─────────────────────────────────────┘
```

**What Developers See (in DevTools Console):**
```
[ErrorBoundary] Uncaught error in "Financial Data Entry"]:
Error: Something went wrong
    at UserProfile.tsx:45
    at ...
```

### NotFoundComponent

**Location:** `frontend/src/routes/__root.tsx` (lines 51-75)

**Current State:** Already implemented with:
- 404 heading
- User-friendly description
- Return home button

### ErrorComponent

**Location:** `frontend/src/routes/__root.tsx` (lines 77-117)

**Current State:** Already implemented with:
- User-friendly error message
- Try again button
- Go home button
- DEV mode shows raw error

## Security Considerations

### What Must NEVER Be Exposed

| Internal Detail | Risk | Protection |
|-----------------|------|------------|
| Database errors (SQL, connection) | Information disclosure | Generic message returned |
| Stack traces | Attack vector enumeration | Logged only, not returned |
| File paths | Infrastructure mapping | Sanitized in responses |
| Internal IP addresses | Network reconnaissance | Never logged to client |
| Library versions | Vulnerability targeting | Not exposed in errors |
| User IDs/internal IDs | Enumeration attacks | Use generic messages |

### What CAN Be Exposed

| Safe Information | Purpose |
|-----------------|---------|
| `bad_request` | Client validation feedback |
| `unauthorized` | Auth flow guidance |
| `forbidden` | RBAC feedback |
| `not_found` | Resource missing feedback |
| `validation_error` | Form validation feedback |
| `internal_server_error` | Generic error acknowledgment |

## Verification

### Backend Tests

```bash
# Run error handling integration tests
cargo test --test error_handling_integration
```

### Manual Verification

1. **Trigger DB Error:** Send request that violates a DB constraint
   - Expected: 500 with "Failed to process database request"
   - NOT Expected: SQL error message, stack trace

2. **Trigger 404:** Navigate to non-existent route
   - Expected: Custom 404 page with "Page not found" message

3. **Trigger JS Error:** Force a component to throw
   - DEV: Shows raw error for debugging
   - PROD: Shows generic error message

## Acceptance Criteria

- [x] No stack traces returned to clients
- [x] No SQL errors returned to clients
- [x] No filesystem paths returned
- [x] Internal details logged via `tracing`
- [x] Custom 404 page exists
- [x] UI failures handled gracefully
- [x] ErrorBoundary NEVER shows raw errors in UI (only in DevTools Console)
- [x] Integration tests for error handling
- [x] Frontend unit tests for ErrorBoundary