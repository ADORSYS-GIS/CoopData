# Audit Context Middleware Implementation Guide

## Overview

This document describes the implementation of IP address and user agent extraction
middleware for audit logging. The `AuditService.log()` function accepts `ip_address`
and `user_agent` parameters, but all handler calls currently pass `None`. This
middleware extracts these values from HTTP requests and makes them available to
handlers via Axum request extensions.

## Files Modified

1. `backend/src/api/middleware.rs` — New `AuditContext` struct + middleware
2. `backend/src/api/routes/api.rs` — Wire middleware into protected router
3. `backend/src/main.rs` — Add `into_make_service_with_connect_info`
4. `backend/src/api/handlers/federation.rs` — 8 audit.log() calls
5. `backend/src/api/handlers/apex.rs` — 6 audit.log() calls
6. `backend/src/api/handlers/cooperative.rs` — 6 audit.log() calls
7. `backend/src/api/handlers/users.rs` — 4 audit.log() calls
8. `backend/src/api/handlers/organizations.rs` — 3 audit.log() calls
9. `backend/src/api/handlers/me.rs` — 1 audit.log() call

## 1. `backend/src/api/middleware.rs`

Replace the entire file with:

```rust
use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{HeaderMap, Request},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;

/// Context extracted from the HTTP request for audit logging.
#[derive(Clone, Debug, Default)]
pub struct AuditContext {
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// Extract the client IP address from the request.
///
/// Resolution order:
/// 1. `X-Forwarded-For` header (first IP in the comma-separated chain)
/// 2. `X-Real-IP` header
/// 3. `ConnectInfo<SocketAddr>` extension
fn extract_ip(headers: &HeaderMap, connect_info: Option<&ConnectInfo<SocketAddr>>) -> Option<String> {
    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(value) = xff.to_str() {
            if let Some(first) = value.split(',').next() {
                let trimmed = first.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }

    if let Some(xri) = headers.get("x-real-ip") {
        if let Ok(value) = xri.to_str() {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    connect_info.map(|ci| ci.0.ip().to_string())
}

/// Extract the User-Agent from the request headers.
fn extract_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// Middleware that extracts IP address and user agent from the request
/// and stores them in request extensions as `AuditContext`.
pub async fn audit_context_layer(mut req: Request<Body>, next: Next) -> Response {
    let connect_info = req.extensions().get::<ConnectInfo<SocketAddr>>();
    let ip_address = extract_ip(req.headers(), connect_info);
    let user_agent = extract_user_agent(req.headers());
    req.extensions_mut()
        .insert(AuditContext { ip_address, user_agent });
    next.run(req).await
}

pub async fn request_logging(req: Request<Body>, next: Next) -> Response {
    let method = req.method().to_string();
    let uri = req.uri().to_string();
    let start = std::time::Instant::now();

    let response = next.run(req).await;

    let duration = start.elapsed();
    let status = response.status();

    tracing::info!(
        method = %method,
        uri = %uri,
        status = %status.as_u16(),
        duration_ms = %duration.as_millis(),
        "Request completed"
    );

    response
}
```

## 2. `backend/src/api/routes/api.rs`

In `create_app()`, after the `auth_layer` `.layer(...)` call (line 180-183), add
the `audit_context_layer`:

```rust
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_layer,
        ))
        .layer(axum::middleware::from_fn(
            crate::api::middleware::audit_context_layer,
        ));
```

## 3. `backend/src/main.rs`

Line 67, change:

```rust
// BEFORE
axum::serve(listener, app).await?;
```

to:

```rust
// AFTER
axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
```

`SocketAddr` is already imported at the top of `main.rs` (line 1).

## 4. Handler Changes

For each handler file, add this import:

```rust
use crate::api::middleware::AuditContext;
```

For each handler function that calls `state.audit.log(...)`:

1. Add `Extension(audit_ctx): Extension<AuditContext>,` as a parameter,
   positioned AFTER `State` and `Extension(claims)` but BEFORE `Path`, `Json`,
   or `Query` (body extractors must be last in Axum).
2. Replace the two `None,` arguments (for ip_address and user_agent) with
   `audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref(),`

### `backend/src/api/handlers/federation.rs` (8 calls)

**Import** — Add after line 7 (`use serde_json::json;`):

```rust
use crate::api::middleware::AuditContext;
```

**create_federation** (line 33) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn create_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateFederationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 126-127): Replace `None,\n            None,` with
`audit_ctx.ip_address.as_deref(),\n            audit_ctx.user_agent.as_deref(),`

**update_federation** (line 194) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
    Json(body): Json<UpdateFederationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 255-256): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_federation** (line 278) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
```

Audit call (line 364): Replace `None, None, None` with
`None, audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**invite_user_to_federation** (line 386) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn invite_user_to_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
    Json(body): Json<CreateInvitationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 464-465): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_federation_invitation** (line 517) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_federation_invitation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 536-537): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**resend_federation_invitation** (line 559) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn resend_federation_invitation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 578-579): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**remove_federation_member** (line 629) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn remove_federation_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 649-650): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_federation_profile** (line 703) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_federation_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<UpdateFederationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 738-739): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

### `backend/src/api/handlers/apex.rs` (6 calls)

**Import** — Add after line 1 (`use axum::extract::Extension;`):

```rust
use crate::api::middleware::AuditContext;
```

**create_apex** (line 32) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn create_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateApexRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 121-122): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_apex** (line 219) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
    Json(body): Json<UpdateApexRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 254-255): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_apex** (line 277) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
```

Audit call (line 291): Replace `None, None, None` with
`None, audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_apex_member** (line 422) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_apex_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(body): Json<UpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 453-454): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**remove_apex_member** (line 516) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn remove_apex_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 541-542): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**resend_apex_member_verification** (line 565) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn resend_apex_member_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 612-613): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

### `backend/src/api/handlers/cooperative.rs` (6 calls)

**Import** — Add after line 1 (`use axum::extract::Extension;`):

```rust
use crate::api::middleware::AuditContext;
```

**create_cooperative** (line 95) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn create_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 211-212): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_cooperative** (line 324) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 362-363): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_cooperative** (line 385) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 401-402): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_cooperative_member** (line 562) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(body): Json<UpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 601-602): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**remove_cooperative_member** (line 635) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn remove_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 657-658): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**resend_cooperative_member_verification** (line 686) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn resend_cooperative_member_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 716-717): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

### `backend/src/api/handlers/users.rs` (4 calls)

**Import** — Add after line 8 (`use uuid::Uuid;`):

```rust
use crate::api::middleware::AuditContext;
```

**create_user** (line 108) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn create_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateUserRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 228-229): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_user** (line 530) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUserRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 575-576): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**assign_role_to_user** (line 601) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn assign_role_to_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignRoleRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 633-634): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_user** (line 656) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 689-690): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

### `backend/src/api/handlers/organizations.rs` (3 calls)

**Import** — Add after line 8 (`use uuid::Uuid;`):

```rust
use crate::api::middleware::AuditContext;
```

**create_organization** (line 87) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn create_organization(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 130-131): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**update_organization** (line 154) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn update_organization(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 176-177): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

**delete_organization** (line 199) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn delete_organization(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 219-220): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

### `backend/src/api/handlers/me.rs` (1 call)

**Import** — Add after line 3 (`use std::sync::Arc;`):

```rust
use crate::api::middleware::AuditContext;
```

**change_password** (line 49) — Add `Extension(audit_ctx)` after `Extension(claims)`:

```rust
pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<impl IntoResponse> {
```

Audit call (lines 99-100): Replace `None, None` with
`audit_ctx.ip_address.as_deref(), audit_ctx.user_agent.as_deref()`

## 5. Verification

After all changes, run:

```bash
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path backend/Cargo.toml
```

## Key Notes

- `AuditContext` derives `Clone` (required by Axum for extensions)
- `Extension(audit_ctx)` must come AFTER `State` and `Extension(claims)` but
  BEFORE `Path`, `Json`, or `Query` (body extractors must be last in Axum)
- `into_make_service_with_connect_info::<SocketAddr>()` is required for
  `ConnectInfo<SocketAddr>` to be available in request extensions
- The `audit_context_layer` middleware runs AFTER `auth_layer` on the protected
  router, so it only processes authenticated requests
- IP resolution prioritizes proxy headers (`X-Forwarded-For`, `X-Real-IP`) over
  direct connection info, which is correct for deployments behind a reverse proxy

## 6. Security Considerations

### X-Forwarded-For Spoofing

The `X-Forwarded-For` and `X-Real-IP` headers are **client-supplied** and can be
**spoofed** by malicious clients. An attacker can send an arbitrary IP address in
these headers to falsify audit log entries.

**Mitigations:**

1. **Trusted reverse proxy only**: Only trust `X-Forwarded-For` / `X-Real-IP`
   headers when the backend is behind a trusted reverse proxy (Nginx, Traefik,
   Cloudflare, etc.) that sets or sanitizes these headers.

2. **Strip incoming headers at the proxy**: Configure the reverse proxy to
   **strip** any client-supplied `X-Forwarded-For` / `X-Real-IP` headers and
   **rewrite** them with the real client IP. This prevents spoofing through
   the proxy.

   Nginx example:
   ```nginx
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $remote_addr;
   ```

3. **Never expose backend directly**: If the backend is directly reachable
   (bypassing the proxy), treat `X-Forwarded-For` as untrusted. In this
   configuration, prefer `ConnectInfo<SocketAddr>` (TCP source IP) as the
   authoritative source.

4. **Audit log caveat**: Audit log entries that include `ip_address` should be
   treated as **best-effort attribution**, not forensic evidence. Cross-reference
   with reverse proxy access logs for authoritative IP attribution.

### Future Enhancement

Consider adding a configurable `trusted_proxy` setting that, when unset, causes
the middleware to ignore proxy headers and rely solely on `ConnectInfo`. When set
to a known proxy IP CIDR, only accept `X-Forwarded-For` from requests originating
from that CIDR range.