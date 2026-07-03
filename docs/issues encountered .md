#3: sonner-toaster-not-mounted

# Postmortem: Federation CRUD Toasts Never Displayed (sonner `<Toaster />` Not Mounted)

**Date:** 2026-07-02  
**Severity:** Medium — all toast/sonner notifications across the entire app were invisible  
**Affected area:** Frontend — every `toast.success()`, `toast.error()` call across all pages  
**Resolution:** Added `<Toaster richColors closeButton />` to `__root.tsx`

---

## 1. Symptom

All mutation feedback calls (e.g., `toast.success("Federation created")`) compiled fine and ran without errors, but no toast ever appeared in the UI. The browser console showed no errors.

## 2. Root Cause

The shadcn/ui `<Toaster />` wrapper (at `src/components/ui/sonner.tsx`) existed and was properly configured, but it was **never imported or mounted anywhere** in the component tree. Without a `<Toaster>` mounted in the React tree, sonner has no portal target to render into. All `toast.*()` calls resolve silently to no-ops.

## 3. The Fix

Added to `frontend/src/routes/__root.tsx`:

```tsx
import { Toaster } from "@/components/ui/sonner";
// ...
<QueryClientProvider client={queryClient}>
  <Outlet />
  <Toaster richColors closeButton />
</QueryClientProvider>
```

## 4. Prevention

Add a lint rule or integration test checking that `<Toaster />` is mounted. The shadcn/ui sonner component should be added to the root layout by default in all new projects.

---

#4: jwt-expiry-cached-token

# Postmortem: Intermittent 401 Errors — Cached Access Token Fallback Without Expiry Check

**Date:** 2026-07-02  
**Severity:** High — users would randomly get 401 errors when their Keycloak access token expired but the refresh failed silently  
**Affected area:** Frontend — `authService.ts` `getAccessToken()`  
**Resolution:** Added JWT `exp` claim validation to the cached token fallback path

---

## 1. Symptom

After navigating the app for ~5 minutes, API calls would start returning 401 errors. Refreshing the page fixed it because Keycloak's `check-sso` would re-authenticate.

## 2. Root Cause

In `authService.ts`, `getAccessToken()` has a fallback path when `keycloak.updateToken()` fails (refresh token expired, network issue, etc.):

```typescript
} catch {
  const cached = await loadCachedTokens();
  if (cached?.token) {
    return cached.token;  // <-- NO EXPIRY CHECK
  }
  throw new Error("Session expired. Please log in again.");
}
```

The cached token was returned without decoding the JWT to check `exp`. The `loadCachedTokens()` function only guards against tokens older than 24 hours — far too coarse for a 5-minute access token TTL. So a 5-minute-old expired token would pass the cache freshness check and be sent to the API, resulting in a 401.

## 3. The Fix

Added `isTokenExpired()` that decodes the JWT payload and checks `exp * 1000` against `Date.now()`:

```typescript
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= (payload.exp * 1000);
  } catch {
    return true; // malformed token — treat as expired
  }
}
```

Used in the `getAccessToken()` fallback:

```typescript
if (cached?.token && !isTokenExpired(cached.token)) {
  return cached.token;
}
```

## 4. Prevention

- Always validate JWT `exp` when using cached tokens as fallback
- Add a `staleTime` to React Query hooks to reduce unnecessary token checks via refetching
- Consider using Keycloak's built-in token refresh (which handles this) as the primary path

---

#5: route-guard-hardening

# Postmortem: Insufficient Route Guards on Ministry Pages

**Date:** 2026-07-02  
**Severity:** Medium — 4 routes allowed non-ministry roles to access ministry-only pages  
**Affected area:** Frontend — route guard configuration  
**Resolution:** Changed guards from `requireAuth()` / broader roles to strict `requireRole("ministry")`

---

## 1. Symptom

Users with federation, apex, or cooperative roles could access:
- `/app/submissions` (no role check at all)
- `/app/reports` (no role check)
- `/app/analytics` (no role check)
- `/app/users` (allowed ministry, federation, and apex)

These pages are ministry-only and should have been guarded with `requireRole("ministry")`.

## 2. Root Cause

During initial route setup, many routes were configured with `requireAuth()` as a placeholder or with a too-permissive role set. The `ROUTE_ACCESS` map in `route-guards.ts` correctly documented the intended restrictions, but the actual `beforeLoad` guards in individual route files diverged from it. The `ROUTE_ACCESS` map is only documentation — it is never consumed by code.

## 3. The Fix

Changed the following route guard files:

| Route file | Before | After |
|---|---|---|
| `app.submissions.tsx` | `requireAuth()` | `requireRole("ministry")` |
| `app.reports.tsx` | `requireAuth()` | `requireRole("ministry")` |
| `app.analytics.tsx` | `requireAuth()` | `requireRole("ministry")` |
| `app.users.tsx` | `requireRole("ministry", "federation", "apex")` | `requireRole("ministry")` |

## 4. Prevention

- All ministry route files should use `requireRole("ministry")` consistently
- Consider validating route guards against the `ROUTE_ACCESS` map with a lint rule or test

---

#6: ministry-member-deletion

# Postmortem: Ministry Could Not Remove Members From Federation

**Date:** 2026-07-02  
**Severity:** Medium — missing feature, ministry users had no way to remove federation members  
**Affected area:** Backend + Frontend — ministry routes + MemberList.tsx  
**Resolution:** Added `DELETE /api/v1/ministry/federations/{id}/members/{user_id}` endpoint and UI

---

## 1. Symptom

The MemberList page showed all members in a table but had only an inert "View Details" button. There was no way to remove a member from a federation at the ministry level.

## 2. Root Cause

The backend route file (`routes/ministry.rs`) had no DELETE endpoint for members. The Keycloak service already had `remove_user_from_organization()` implemented, but nobody had wired it to a route. The federation-level route file had a `remove_apex_member` endpoint (also TODO), but ministry had nothing.

## 3. The Fix

**Backend** (`backend/src/api/routes/ministry.rs`, `handlers/federation.rs`, `openapi.rs`):
- Added `DELETE /federations/{id}/members/{user_id}` route
- Created `remove_federation_member` handler calling `keycloak.remove_user_from_organization()`
- Registered in OpenAPI spec

**Frontend** (`frontend/src/hooks/federations/useFederations.ts`):
- Added `useRemoveFederationMember()` mutation hook with query invalidation

**Frontend** (`frontend/src/pages/ministry/MemberList.tsx`):
- Replaced inert "View Details" with Trash2 icon button
- Added AlertDialog confirmation ("Remove member? — This will permanently remove [name] from the federation...")
- Added toast.success/toast.error for mutation feedback

---

#1: axum-path-param-bug-postmortem

# Postmortem: Silent 404 on All Parametric Routes (Axum Version Mismatch)

**Date:** 2026-07-01  
**Severity:** High — all `DELETE`, `GET /{id}`, `PATCH /{id}` endpoints were silently broken  
**Affected area:** Backend — every route with a path parameter (`/federations/{id}`, `/users/{id}`, `/organizations/{id}`, etc.)  
**Resolution:** Upgraded `axum` from `0.7` to `0.8` in `Cargo.toml`

---

## 1. Symptom

Clicking "Delete Federation" in the UI returned HTTP `404 Not Found`. The browser network tab showed:

```
DELETE http://localhost:5174/api/v1/ministry/federations/5b5b93e4-9f40-4aa6-ab41-035591f912b1
Status: 404 Not Found
```

The backend access log confirmed the request arrived:

```
method=DELETE uri=/api/v1/ministry/federations/5b5b93e4-... latency=0 ms status=404
```

Two things stood out immediately:

1. The request **did reach the backend** — so nginx proxying was not the issue.
2. The latency was **exactly 0 ms** — meaning no middleware ran, no handler was called, not even the JWT auth layer.

---

## 2. Initial Red Herrings

### 2.1 Suspicion: nginx proxy stripping `/api/` prefix

The frontend runs in a Docker container on port `5174` behind nginx. When `proxy_pass` is configured with a trailing slash on the `location` block but no path on the upstream URL, nginx strips the matched prefix before forwarding.

```nginx
# What we had
location /api/ {
    proxy_pass http://coopdata-backend:3000;  # strips /api/
}
```

This would turn `DELETE /api/v1/ministry/federations/{id}` into `DELETE /v1/ministry/federations/{id}`, causing a 404.

**Why this was wrong:** The backend logs showed the full path `/api/v1/ministry/federations/...` arriving intact, confirming nginx was passing it through correctly. The nginx config was reverted.

### 2.2 Suspicion: Route not registered / import missing

All route files were inspected. The `delete_federation` handler was imported and chained correctly:

```rust
.route(
    "/federations/{id}",
    get(get_federation)
        .patch(update_federation)
        .delete(delete_federation),
)
```

Also confirmed: `patch` not being in `use axum::routing::{delete, get, post}` was noted, but `.patch()` here is a **method on `MethodRouter`**, not the standalone `patch()` function — so no import is needed and this compiled fine.

### 2.3 Suspicion: Stale Docker image

The image was built at `09:01`, and a commit touching the backend was made at `10:42`. Could the running binary be outdated?

Checking `git show` on that commit revealed it only touched DTOs and the OpenAPI spec — not route files. The route definitions in the image were identical to HEAD. Dead end.

---

## 3. The Actual Diagnosis

### 3.1 The key observation: collection routes worked, parametric routes didn't

Testing directly against the backend container (bypassing nginx entirely):

```bash
curl -X GET  http://localhost:3000/api/v1/ministry/federations        → 401 Unauthorized
curl -X GET  http://localhost:3000/api/v1/ministry/federations/abc    → 404 Not Found
curl -X DELETE http://localhost:3000/api/v1/ministry/federations/abc  → 404 Not Found
curl -X GET  http://localhost:3000/api/v1/ministry/users              → 401 Unauthorized
curl -X GET  http://localhost:3000/api/v1/ministry/users/abc          → 404 Not Found
```

The pattern was unambiguous:

| Route type | Result | Meaning |
|---|---|---|
| `/federations` (no param) | 401 | Route matched → auth middleware ran |
| `/federations/{id}` (param) | 404 | Route **never matched** |
| `/users` (no param) | 401 | Route matched → auth middleware ran |
| `/users/{id}` (param) | 404 | Route **never matched** |

**Every single parametric route across the entire router returned 404.** This ruled out any handler-level bug and pointed squarely at route registration.

### 3.2 The smoking gun: Axum version vs. path param syntax

```toml
# Cargo.toml
axum = { version = "0.7", features = ["macros", "multipart"] }
```

```toml
# Cargo.lock (resolved)
name = "axum"
version = "0.7.9"
```

The routes used:

```rust
.route("/federations/{id}", ...)
.route("/users/{id}", ...)
.route("/organizations/{id}", ...)
```

And this is the problem. **Axum 0.7 uses `:param` colon syntax. The `{param}` brace syntax was only introduced in Axum 0.8.**

In Axum 0.7, the correct syntax is:

```rust
.route("/federations/:id", ...)  // ← Axum 0.7
```

In Axum 0.8+:

```rust
.route("/federations/{id}", ...)  // ← Axum 0.8+
```

---

## 4. Why Did It Compile Without Errors?

This is the core of the mystery, and it's a fascinating Rust/Axum design characteristic.

### 4.1 Route paths are plain strings, not typed at compile time

In Axum, `.route()` takes a `&str`:

```rust
pub fn route(self, path: &str, method_router: MethodRouter<S>) -> Self
```

The path string is **not parsed or validated at compile time**. Rust's type system has no way to inspect the contents of a string literal and enforce that it follows path parameter conventions. As far as `rustc` is concerned, `"/federations/{id}"` and `"/federations/:id"` are both perfectly valid `&str` values.

The path parsing happens at **runtime**, inside `matchit` — the routing library Axum uses internally.

### 4.2 Axum 0.7 uses `matchit` 0.7.x

`matchit` is the trie-based router that Axum delegates path matching to. In `matchit` 0.7.x (used by Axum 0.7), the parameter syntax is `:param`. Braces `{param}` are not a recognized parameter delimiter — they are treated as **literal characters**.

So when the router is built, Axum 0.7 registers this route:

```
/federations/{id}   ← literal string, matches ONLY the exact URL "/federations/{id}"
```

No runtime panic. No warning. The route is registered successfully. It just never matches any real URL because no browser ever sends a request to `/federations/{id}` literally.

### 4.3 The `matchit` version bump in Axum 0.8

Axum 0.8 upgraded its `matchit` dependency from `0.7.x` to `0.8.x`. In `matchit` 0.8.x, the parameter syntax changed to `{param}` to align with RFC 6570 URI templates. So:

| `matchit` version | Axum version | Param syntax |
|---|---|---|
| 0.7.x | Axum 0.7 | `:param` |
| 0.8.x | Axum 0.8 | `{param}` |

The route files in this project were written using `{param}` — the Axum 0.8 syntax — but the `Cargo.toml` pinned `axum = "0.7"`, so the compiled binary used the old router. The mismatch compiled cleanly and failed silently at runtime.

### 4.4 Why no runtime panic either?

You might expect a panic like "invalid route syntax" at startup. `matchit` 0.7 does not validate or reject the `{param}` syntax — it simply treats `{` and `}` as ordinary characters in the path segment. The trie is built correctly for a route that matches the literal string `{id}`. No invariant is violated from `matchit`'s perspective.

Axum itself adds one layer of validation on top of `matchit` (e.g., checking for duplicate routes), but it cannot detect that a route will "never match" in practice — that's not a detectable error condition.

---

## 5. The Fix

Updated `Cargo.toml` to use Axum 0.8 and its compatible ecosystem:

```toml
# Before
axum = { version = "0.7", features = ["macros", "multipart"] }
axum-extra = { version = "0.9", features = ["cookie", "typed-header"] }
tower = "0.4"
tower-http = { version = "0.5", features = [...] }

# After
axum = { version = "0.8", features = ["macros", "multipart"] }
axum-extra = { version = "0.10", features = ["cookie", "typed-header"] }
tower = "0.5"
tower-http = { version = "0.6", features = [...] }
```

No route code changes were needed. The route files already used the correct Axum 0.8 `{param}` syntax. It was the `Cargo.toml` version pin that was behind.

`cargo check` and `cargo clippy` both passed clean after the upgrade. The backend container was rebuilt and all parametric routes began matching correctly.

---

## 6. Full Causal Chain

```
Cargo.toml pins axum = "0.7"
    ↓
Cargo resolves matchit 0.7.x (uses :param syntax)
    ↓
Route files written with {param} syntax (Axum 0.8 convention)
    ↓
matchit 0.7 treats "/federations/{id}" as a literal path
    ↓
No compile error (path is just a &str, validated at runtime only)
    ↓
No runtime panic (matchit registers the literal route without complaint)
    ↓
Every request to /federations/<uuid> fails to match the literal "/federations/{id}"
    ↓
Axum returns 404 at 0ms latency (before any middleware runs)
    ↓
All collection routes (/federations) work fine (no params, no mismatch)
    ↓
All parametric routes (GET/PATCH/DELETE /{id}) silently return 404
```

---

## 7. Why Was This Hard to Spot?

1. **It compiled cleanly.** Rust's famously strict compiler gave zero indication anything was wrong.
2. **No runtime error.** The server started, routes registered, no panics.
3. **Partial functionality.** Collection endpoints (`GET /federations`) worked fine, creating a false sense that the routing was working.
4. **0ms latency on 404.** This was the critical clue — a normal 404 from a handler takes some time (auth middleware, handler logic). A 0ms 404 means Axum's router rejected the request before touching any user code.
5. **The error message was generic.** `404 Not Found` gives no hint about *why* the route didn't match.
6. **The fix was in `Cargo.toml`, not in the code.** Debugging instinct naturally looks at code first.

---

## 8. Prevention

### 8.1 Explicit version ranges and dependency audits

Prefer specifying a minimum version that matches the syntax you're using:

```toml
# Clearly states: we need 0.8+ for {param} syntax
axum = { version = ">=0.8, <1.0", features = ["macros", "multipart"] }
```

### 8.2 Integration test for parametric routes

A minimal integration test that actually calls a `/{id}` endpoint (even without auth, checking for 401 not 404) would have caught this immediately:

```rust
#[tokio::test]
async fn test_parametric_routes_are_registered() {
    let app = create_app(test_state());
    let response = app
        .oneshot(Request::builder()
            .method("DELETE")
            .uri("/api/v1/ministry/federations/test-id")
            .body(Body::empty()).unwrap())
        .await
        .unwrap();
    // Should be 401 (auth required), NOT 404 (route not found)
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
```

### 8.3 Smoke test on startup

Log all registered routes at startup in development mode. If `{id}` routes appear in the list but `:id` routes do not, the mismatch is immediately visible.

### 8.4 Keep ecosystem crates in sync

`axum`, `axum-extra`, `tower`, and `tower-http` have coordinated major versions. When upgrading one, upgrade all together to avoid subtle incompatibilities.

---

## 9. Lessons Learned

- **A clean compile does not mean correct runtime behavior** — especially for string-based configuration (routes, SQL queries, regex patterns). These are validated at runtime, not compile time.
- **Latency is a diagnostic signal.** A `404` at `0ms` is categorically different from a `404` at `5ms`. The former means the router rejected the request; the latter means a handler returned it.
- **Test at every level of the stack.** `curl` directly against the backend (bypassing nginx) was the step that isolated the issue to Axum routing specifically.
- **Read the changelog when writing code for a framework.** The `{param}` syntax appeared in Axum 0.8 release notes prominently — but if you write the code first and add the dependency version later, the mismatch is easy to miss.

---

#2: keycloak-pending-invitations-postmortem

# Postmortem: Pending Invitations Always Empty (Keycloak User Profile Schema)

**Date:** 2026-07-02
**Severity:** High — invitation tracking was completely non-functional; the dashboard always showed 0 pending invitations regardless of how many users had been invited
**Affected area:** Backend — `GET /api/v1/ministry/federations/{id}/invitations` + Keycloak User Profile configuration
**Resolution:** Registered `org.ro.active` in Keycloak's User Profile schema, set `unmanagedAttributePolicy: ADMIN_EDIT`, fixed `update_user_attributes` to do a read-merge-write instead of a destructive PUT, and switched the tracking attribute from `invited_to_org` to `org.ro.active`

---

## 1. Symptom

After sending an invitation via "New Invitation", the email arrived in MailHog correctly. The invited user appeared in Keycloak's user list. However:

- The Invitations tab showed `0 invitations found`
- All stat cards (Total, Pending, Sent) showed `0`
- The backend returned HTTP 200 with an empty array `[]`

The backend log confirmed the query ran and returned nothing:

```
INFO coop_data_backend::services::keycloak: Found users with org.ro.active attribute matching org org_id=e27e49b5-... count=0
```

---

## 2. Root Causes (Three Layered)

### 2.1 Wrong attribute name

The original code wrote `invited_to_org` (and `invitation_status`) as the tracking attribute on invited users, then searched with `q=invited_to_org:{org_id}`.

The design document (`docs/solution.md`) specifies `org.ro.active` as the canonical attribute name — the one that is registered in Keycloak's User Profile schema. The code diverged from the spec and used a different name.

### 2.2 Keycloak User Profile schema had no custom attributes registered

Keycloak's declarative User Profile (`PUT /admin/realms/{realm}/users/profile`) controls which custom attributes are searchable via the Admin API `q=key:value` parameter. The `coop-data` realm had **zero** custom attributes defined in its User Profile schema:

```
Total attributes defined: 0   ← only username, email, firstName, lastName
unmanagedAttributePolicy: NOT SET
```

With `unmanagedAttributePolicy` unset (defaults to `DISABLED` in Keycloak 26), any custom attribute written via `PUT /users/{id}` is silently accepted by Keycloak but invisible to attribute search. The write returns HTTP 204, everything looks fine, but the `q=` query returns zero results.

This means even if the attribute name had been correct (`org.ro.active`), the search would still have returned empty because the attribute was not in the schema.

### 2.3 Destructive `update_user_attributes` PUT

When updating attributes on an existing user, the code sent:

```json
PUT /admin/realms/{realm}/users/{id}
{ "attributes": { "org.ro.active": ["org-uuid"] } }
```

Keycloak's `PUT /users/{id}` is a **full replace** — it does not merge. Sending only the `attributes` field causes Keycloak to wipe `email`, `firstName`, `lastName`, `enabled`, and all other fields not included in the body. This silently corrupted existing user records during the backfill attempt.

---

## 3. Full Causal Chain

```
solution.md specifies org.ro.active as the tracking attribute
    ↓
Code was written using invited_to_org instead (diverged from spec)
    ↓
Keycloak User Profile schema has no custom attributes registered
    ↓
unmanagedAttributePolicy not set → custom attrs are search-invisible
    ↓
PUT /users/{id} with only attributes field = destructive full replace
    ↓
Invited users have no searchable attribute → q= search returns 0
    ↓
GET /invitations always returns [] regardless of invite count
    ↓
Dashboard shows 0 across all stat cards
```

---

## 4. Diagnosis Steps

**Step 1 — Checked backend logs**

The log line `count=0` after the Keycloak attribute search confirmed the query itself was the problem, not the frontend or the handler logic.

**Step 2 — Inspected actual user records in Keycloak**

```bash
curl "http://localhost:8180/admin/realms/coop-data/users?max=20&briefRepresentation=false"
```

Every invited user returned `"attributes": null` — the attributes were never written successfully.

**Step 3 — Inspected the User Profile schema**

```bash
curl "http://localhost:8180/admin/realms/coop-data/users/profile"
# → Total attributes defined: 0, unmanagedAttributePolicy: NOT SET
```

This confirmed that Keycloak was silently ignoring custom attribute writes because the schema didn't declare them.

**Step 4 — Confirmed the attribute search behavior**

After manually patching `org.ro.active` onto a user, re-ran the `q=org.ro.active:{org_id}` query — still returned 0. Proved that even with the attribute present, it wasn't searchable until registered in the schema.

---

## 5. The Fix

### 5.1 Register `org.ro.active` in Keycloak User Profile schema

```bash
PUT /admin/realms/coop-data/users/profile
{
  "unmanagedAttributePolicy": "ADMIN_EDIT",
  "attributes": [
    ... (existing standard attributes preserved) ...,
    {
      "name": "org.ro.active",
      "displayName": "Invited Organisation",
      "permissions": { "view": ["admin"], "edit": ["admin"] },
      "multivalued": true
    }
  ]
}
```

`unmanagedAttributePolicy: ADMIN_EDIT` also set as a safety net so future admin-written attributes are not silently dropped.

### 5.2 Switch tracking attribute from `invited_to_org` to `org.ro.active`

Updated `invite_user_to_organization` to write the correct attribute:

```rust
// Before
attributes.insert("invited_to_org".to_string(), vec![org_id.to_string()]);
attributes.insert("invitation_status".to_string(), vec!["PENDING".to_string()]);

// After
attributes.insert("org.ro.active".to_string(), vec![org_id.to_string()]);
```

### 5.3 Implement two-call pending detection (per solution.md)

Replaced the unreliable fallback scan (fetch all users, iterate, resolve details individually) with the clean approach:

```
Call 1: GET /users?q=org.ro.active:{org_id}&briefRepresentation=false&max=1000
Call 2: GET /organizations/{org_id}/members

pending = Call1_results MINUS Call2_results (by user ID set)
```

Status derived from Keycloak's own `emailVerified` field:
- `emailVerified: false` → `"PENDING"` (user hasn't clicked the link yet)
- `emailVerified: true` → `"EMAIL_VERIFIED"` (clicked link, hasn't accepted org invite)

### 5.4 Fix `update_user_attributes` to be non-destructive

```rust
// Before — destructive PUT
let body = json!({ "attributes": attributes });

// After — read-merge-write
let current = self.get_user_by_id_raw(&token, keycloak_id).await?;
let mut merged_attrs = current.attributes.unwrap_or_default();
merged_attrs.extend(attributes);
let body = json!({
    "username": current.username,
    "email": current.email,
    "firstName": current.first_name,
    "lastName": current.last_name,
    "enabled": current.enabled,
    "emailVerified": current.email_verified,
    "attributes": merged_attrs
});
```

### 5.5 Fix `delete_organization_invitation` to delete the user

The old implementation called Keycloak's `/organizations/{id}/invitations/{iid}` DELETE endpoint — which does not exist for user-created invitations in this flow (Keycloak only tracks org-native invitations there). Updated to delete the user from Keycloak entirely, which is the correct cancellation semantics for a pending invitee.

### 5.6 Fix `resend_organization_invitation` to re-send both emails

Updated to re-trigger both:
1. `execute-actions-email` with `["VERIFY_EMAIL", "UPDATE_PASSWORD"]` — in case they lost the verification email
2. `invite-user` on the org — to resend the org membership invitation email

### 5.7 Fix frontend stat card bug

The "Pending" stat card was counting `invitations.filter(i => !i.email_sent)` — which is always 0 because `email_sent` is always `true` after a successful invite. Fixed to count `status === "PENDING" || status === "EMAIL_VERIFIED"` instead.

---

## 6. Why It Was Hard to Spot

1. **Keycloak silently accepts unknown attribute writes.** `PUT /users/{id}` with a custom attribute returns HTTP 204 whether or not the attribute is in the schema. There is no error, no warning, no indication the attribute was dropped from search indexing.
2. **The backend returned HTTP 200 with `[]`.** The frontend had no way to distinguish "no invitations exist" from "invitations exist but the query is broken".
3. **The attribute was literally present on users** (after backfill) — `GET /users/{id}` returned it in the response. But `q=` search still returned nothing, because searchability is a separate concern from storage.
4. **The old code had a fallback** (fetch all users, iterate, filter manually) that was also broken, masking the root issue with extra complexity.

---

## 7. Prevention

### 7.1 Register all custom attributes in User Profile schema at provisioning time

Add the `org.ro.active` registration to `scripts/keycloak-provisioning.sh` so it is applied on every fresh environment:

```bash
# Register org.ro.active in User Profile schema
curl -X PUT "$KC_URL/admin/realms/$REALM/users/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"unmanagedAttributePolicy\": \"ADMIN_EDIT\", \"attributes\": [..., {\"name\": \"org.ro.active\", \"multivalued\": true, \"permissions\": {\"view\": [\"admin\"], \"edit\": [\"admin\"]}}] }"
```

### 7.2 Never use partial PUT for Keycloak user updates

Keycloak's Admin REST API uses PUT-as-replace semantics throughout. Always fetch the current resource, merge changes, then PUT the full object back. Consider a helper:

```rust
async fn patch_user(&self, keycloak_id: &str, patch: impl FnOnce(&mut KeycloakUserUpdate)) -> Result<(), AppError>
```

### 7.3 Test attribute searchability, not just attribute presence

After writing a custom attribute, verify it is searchable:

```bash
# Write
PUT /users/{id} { "attributes": { "org.ro.active": ["test-org"] } }
# Verify searchable (not just present)
GET /users?q=org.ro.active:test-org  # must return the user
```

If the `q=` search returns empty while `GET /users/{id}` shows the attribute, the attribute is not in the User Profile schema.

### 7.4 Keep code aligned with design documents

`solution.md` specified `org.ro.active` explicitly. The divergence to `invited_to_org` was the root cause of the wrong attribute being written. When a design document names a specific attribute, use that exact name.

---

## 8. Lessons Learned

- **Keycloak's attribute search is schema-gated, not storage-gated.** An attribute can exist on a user and be returned by `GET /users/{id}` but be completely invisible to `GET /users?q=key:value`. The User Profile schema controls search indexing.
- **HTTP 204 does not mean the operation had the intended effect.** Keycloak accepted the write; it just wasn't indexed.
- **Read-modify-write is mandatory for Keycloak user updates.** PUT semantics in the Keycloak Admin API are always full-replace. Never send a partial body.
- **Fallback logic can hide root causes.** The "fetch all users and iterate" fallback made it seem like a volume/performance problem rather than a schema configuration problem.
- **Match your code to your design documents exactly.** Attribute names, endpoint paths, and field names in design specs are not suggestions — they are the contract.
