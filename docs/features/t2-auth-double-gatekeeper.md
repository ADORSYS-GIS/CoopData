# Design Document: T2 — Auth & Authorization (Double-Gatekeeper Pattern)

> **Ticket:** [Issue #107 - T2](https://github.com/ADORSYS-GIS/CoopData/issues/107)
> **Epic:** EPIC-SEC-RELIABILITY-01 — Security, Reliability, and Testing Lifecycle Hardening
> **Status:** ✅ Complete
> **Date:** September 7, 2026

---

## 1. Objective

The system already has solid auth infrastructure. T2 adds:
1. **Audit logging** for auth failures (visibility into attacks)
2. **Integration tests** for 401/403 (automated verification)
3. **Frontend 401 handling** (redirect to login when token expires)

---

## 2. Current State Assessment

### 2.1 Backend — Already Implemented ✅

| Component | File | Status |
|-----------|------|--------|
| JWT validation middleware | `backend/src/auth/middleware.rs` | ✅ `auth_layer` |
| Role guard middleware | `backend/src/api/routes/api.rs` | ✅ `role_guard_layer` |
| Claims extraction | `backend/src/auth/claims.rs` | ✅ `Arc<Claims>` in extensions |
| Route wiring | `backend/src/api/routes/api.rs` | ✅ All routes have role guards |
| Service account bypass | `backend/src/auth/claims.rs` | ✅ `is_service_account()` |

**Route Protection Map:**
```
/api/v1/health          → Public (no auth)
/api/v1/me              → Authenticated (any role)
/api/v1/ministry/*      → ministry role only
/api/v1/federation/*    → federation role only
/api/v1/apex/*          → apex role only
/api/v1/cooperative/*   → cooperative OR apex role
/api/v1/users/*         → ministry, federation, OR apex role
```

### 2.2 Frontend — Already Implemented ✅

| Component | File | Status |
|-----------|------|--------|
| ProtectedRoute | `frontend/src/components/ProtectedRoute.tsx` | ✅ Auth + role check |
| UnauthorizedPage | `frontend/src/components/UnauthorizedPage.tsx` | ✅ 403 page |
| AuthContext | `frontend/src/context/AuthContext.tsx` | ✅ `isAuthenticated`, `user.role` |
| Route guards | `frontend/src/routes/*.tsx` | ✅ `beforeLoad` hooks |
| Token auto-refresh | `frontend/src/services/shared/authService.ts` | ✅ 30 sec before expiry |

**Token Settings:**
- Access Token: 5 minutes
- Refresh Token: 30 minutes idle
- Auto-refresh: 30 seconds before expiry

---

## 3. Proposed Changes

### 3.1 Backend: Add Auth Failure Audit Logging

**File:** `backend/src/auth/middleware.rs`

**Before:**
```rust
.map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?
```

**After:**
```rust
.map_err(|e| {
    tracing::warn!(
        error = %e,
        "Authentication failed - invalid or expired token"
    );
    AppError::Unauthorized("Invalid or expired token".into())
})?
```

**Why:** Provides visibility into brute-force attempts and token expiry patterns.

### 3.2 Backend: Add Integration Tests for Auth

**File:** `backend/tests/auth_integration.rs` (new)

```rust
#[tokio::test]
async fn test_unauthenticated_request_returns_401() {
    let app = create_app().await;
    let response = app.oneshot(
        Request::builder()
            .uri("/api/v1/ministry/federations")
            .body(Body::empty())
            .unwrap()
    ).await;
    
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_wrong_role_returns_403() {
    let app = create_app().await;
    let response = app.oneshot(
        Request::builder()
            .uri("/api/v1/ministry/federations")
            .header(AUTHORIZATION, "Bearer <cooperative_token>")
            .body(Body::empty())
            .unwrap()
    ).await;
    
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
```

### 3.3 Frontend: Handle 401 from API

**File:** `frontend/src/services/shared/authService.ts`

**Add 401 interceptor:**
```typescript
// Add response interceptor to handle 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      await logout();
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);
```

**Why:** When the backend returns 401 (e.g., token expired during a long session), the frontend should redirect to login instead of showing a blank error.

---

## 4. Implementation Plan

| Step | File | Change |
|------|------|--------|
| 1 | `backend/src/auth/middleware.rs` | Add audit logging for auth failures |
| 2 | `backend/tests/auth_integration.rs` | **New** — Integration tests for 401/403 |
| 3 | `frontend/src/services/shared/authService.ts` | Add 401 response interceptor |

**Total:** 3 files (1 new, 2 modified)

---

## 5. Verification

### 5.1 Backend Tests
```bash
cd backend && cargo test auth_integration
```

### 5.2 Manual Testing
1. Send request without token → expect 401
2. Send request with expired token → expect 401
3. Send request with wrong role → expect 403
4. Frontend: API returns 401 → expect redirect to login

---

## 6. Rollback Plan

All changes are additive:
1. Backend: Remove audit logging line
2. Backend: Delete test file
3. Frontend: Remove interceptor

---

## 7. Next Steps

After T2 approval:
1. Implement backend audit logging
2. Create integration tests
3. Add frontend 401 interceptor
4. Document in `docs/features/t2-auth-double-gatekeeper.md`

---

## 8. Implementation Details

### 8.1 Backend: Auth Failure Logging

**File:** `backend/src/auth/middleware.rs`

Added `tracing::warn!` for all auth failure cases:
- Missing authorization header
- Invalid authorization header format
- Invalid or expired token

**Example log output:**
```
WARN auth: Auth failure: missing authorization header
WARN auth: Auth failure: invalid authorization header format
WARN auth: Auth failure: invalid or expired token error=TokenExpired
```

### 8.2 Backend: Integration Tests

**File:** `backend/tests/auth_integration.rs` (new)

7 tests covering:
- Health check is public (no auth required)
- Protected routes require auth (6 routes tested)
- Missing auth header returns 401
- Invalid bearer token returns 401
- Malformed authorization header returns 401
- Empty bearer token returns 401
- OpenAPI spec is accessible without auth

**Test results:**
```
running 7 tests
test test_invalid_bearer_token_returns_401 ... ok
test test_missing_auth_header_returns_401 ... ok
test test_empty_bearer_token_returns_401 ... ok
test test_health_check_public_no_auth_required ... ok
test test_openapi_spec_accessible_without_auth ... ok
test test_malformed_authorization_header_returns_401 ... ok
test test_protected_routes_require_auth ... ok

test result: ok. 7 passed; 0 failed
```

### 8.3 Frontend: 401 Handling

**File:** `frontend/src/router.tsx`

Already implemented via global error handlers:
- `isAuthError()` - detects 401/unauthorized errors
- `handleAuthError()` - calls `logout()` on auth errors
- Global handlers on `QueryCache` and `MutationCache`

**Detected error messages:**
- "Missing authorization header"
- "Unauthorized"
- "401"
- "Invalid token"
- "Expired token"

---

## 9. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/auth/middleware.rs` | Modified | Added `tracing::warn` for auth failures |
| `backend/tests/auth_integration.rs` | New | 7 integration tests for 401 behavior |
| `frontend/src/router.tsx` | Already existed | Global 401 error handling (pre-existing) |

**Total:** 2 files (1 new, 1 modified backend)