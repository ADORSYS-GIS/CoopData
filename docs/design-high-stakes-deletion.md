# High-Stakes Deletion — Design Document

## Overview

Cascade deletions in CoopData are destructive and irreversible. A federation deletion cascades to all apexes, cooperatives, and member accounts. Previously, a single "Are you sure?" dialog was the only safeguard. This feature adds a multi-layered confirmation system inspired by GitHub, Vercel, and Linear.

## Architecture

Two independent layers:

1. **Frontend: Type-to-Confirm + Cascade Preview**
   - User must type the entity name exactly before proceeding
   - Cascade impact counts (apexes, cooperatives, members) fetched from backend
   - Provides visual awareness of blast radius

2. **Backend: Identity Re-Verification + Single-Use Token**
   - User re-enters password (and OTP if 2FA enabled)
   - Backend validates via Keycloak ROPC (Resource Owner Password Credentials)
   - On success, issues a single-use verification token (UUID, 120s TTL) stored in Redis
   - DELETE request must include `X-Verification-Token` header
   - Token validated + consumed before cascade executes
   - Missing/invalid/expired token → HTTP 428 Precondition Required

## User Flow

```
Click trash icon
    │
    ▼
Step 1: Cascade Preview + Type-to-Confirm
    Dialog shows: "This will permanently delete: 3 apexes, 7 cooperatives, 42 members"
    User must type entity name exactly to enable "Continue" button
    │
    ▼
Step 2: Identity Verification
    Password input (always shown)
    OTP input (only if user has 2FA configured)
    │
    ▼
POST /api/v1/me/verify-identity {password, otp?}
    │
    ├── On failure: inline error, stays on step 2
    └── On success: returns {verification_token, requires_otp}
         │
         ▼
Step 3: Execute Delete
    DELETE /api/v1/.../entities/{id}
    Header: X-Verification-Token: {token}
    │
    ├── Missing/invalid token → 428 Precondition Required
    ├── Expired token (120s) → 428 Precondition Required
    └── Valid token → consumed (deleted from Redis), cascade executes
         │
         ├── 204 No Content → toast success, dialog closes
         └── Error → toast error, dialog stays open for retry
```

## Backend Endpoints

### POST /api/v1/me/verify-identity

Request body:
```json
{
  "password": "string",
  "otp": "optional_string"  // 6-digit TOTP code, only if user has 2FA
}
```

Success response (200):
```json
{
  "verification_token": "uuid_v4_string",
  "requires_otp": false
}
```

Error response (401):
```json
{
  "error": "unauthorized",
  "message": "Invalid credentials"
}
```

### GET /api/v1/{role}/{entity_type}/{id}/delete-preview

Response (200):
```json
{
  "apexes": 3,
  "cooperatives": 7,
  "members": 42
}
```

Routes:
- `GET /api/v1/ministry/federations/{id}/delete-preview`
- `GET /api/v1/federation/apexes/{id}/delete-preview`
- `GET /api/v1/apex/cooperatives/{id}/delete-preview`

### DELETE with X-Verification-Token

All three delete handlers (`DELETE /federations/{id}`, `DELETE /apexes/{id}`, `DELETE /cooperatives/{id}`) now require:

```
X-Verification-Token: uuid_v4_string
```

Missing/invalid/expired → `428 Precondition Required`:
```json
{
  "error": "precondition_required",
  "message": "Identity verification is required for destructive actions..."
}
```

## Backend Implementation

### Error variant

`backend/src/error.rs`:
```rust
PreconditionRequired(String)  // → HTTP 428
```

### VerificationTokenService

`backend/src/services/verification_token.rs`:
- `generate()` — UUID v4
- `store(cache, user_id, token)` — Redis SET with 120s TTL
- `validate_and_consume(cache, user_id, token)` — GET + DEL (atomic single-use)
- Key format: `verify:{user_id}:{token}`

### KeycloakService changes

`backend/src/services/keycloak.rs`:
- `verify_user_password(username, password, totp: Option<&str>)` — ROPC with optional `totp` form param
- `get_user_otp_status(user_id) -> Result<bool>` — checks `GET /admin/realms/{realm}/users/{id}/credentials` for `type: "otp"`

## Frontend Implementation

### DeleteConfirmationDialog

`frontend/src/components/shared/DeleteConfirmationDialog.tsx`:
- 3-step shadcn Dialog: `confirm` → `verify` → `deleting`
- Step 1: cascade counts + type-to-confirm (entity name must match exactly)
- Step 2: password + conditional OTP input
- Step 3: spinner during delete execution

### Hooks

- `useVerifyIdentity` — POST /me/verify-identity
- `useFederationDeletePreview(id)`, `useApexDeletePreview(id)`, `useCooperativeDeletePreview(id)`
- `useDeleteFederation({id, verificationToken})`, etc. — DELETE with `x-verification-token` header

## Security Properties

- **Type-to-confirm**: prevents accidental clicks (proves visual awareness)
- **Password re-entry**: proves the authenticated user is actively present (session hijack defense)
- **OTP re-entry**: defends against stolen session cookies when 2FA is enabled
- **Single-use token**: token consumed on first use, cannot be replayed
- **120s TTL**: token expires quickly, limiting window for token theft
- **Per-user tokens**: token stored with user_id prefix, cannot be used by different user
- **No token reuse**: `validate_and_consume` deletes from Redis immediately after read

## Future Enhancements

- **Configurable TTL**: Make the 120s token expiry configurable via env var
- **Audit logging**: Log the verification token ID in the audit trail for forensics
- **Rate limiting**: Throttle verify-identity calls to prevent brute-force attacks
- **Progressive disclosure**: Only show cascade counts if they are non-zero