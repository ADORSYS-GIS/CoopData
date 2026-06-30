# Project Progress & Roadmap: CoopData IAM Integration

> **Instructions for AI:**
> 1. Read `docs/design.md` and `docs/RBAC_AND_AUTH_SYSTEM.md` for full context.
> 2. Check this file at the start of every new chat session to resume work.
> 3. Update this file after EVERY successful feature implementation.

## Project Status

- **Current Phase**: Phase 5: Testing & Polish
- **Overall Progress**: 75%

---

## Phase 1: Backend RBAC Cleanup ✅

> **Goal**: Remove duplicate role checks from handlers, verify scope enforcement is correct, ensure middleware is properly wired.

- [x] **1.1 Remove duplicate `require_*` calls from handler bodies**
  - [x] `src/api/routes/ministry.rs` — removed `require_ministry()` calls (middleware enforces)
  - [x] `src/api/routes/federation.rs` — removed `require_federation()` calls
  - [x] `src/api/routes/apex.rs` — removed `require_apex()` calls
  - [x] `src/api/routes/cooperative.rs` — removed `require_cooperative_or_apex()` calls
  - [x] `src/api/routes/shared.rs` — rewritten to only contain `/me` endpoint; ministry-only endpoints moved to ministry.rs
- [x] **1.2 Verify scope enforcement in handlers**
  - [x] Federation handlers use `ScopeEnforcement::get_federation_org_id()` for data scoping
  - [x] Apex handlers use `ScopeEnforcement::get_apex_group_id()` for data scoping
  - [x] Cooperative handlers use `ScopeEnforcement::get_cooperative_id()` for data scoping
  - [x] Ministry handlers have no scope filter (sees all)
  - [x] Unused `claims` variables prefixed with `_claims`
- [x] **1.3 Verify route wiring in `create_app()`**
  - [x] Ministry routes: `require_role_layer(["ministry"])`
  - [x] Federation routes: `require_role_layer(["federation"])`
  - [x] Apex routes: `require_role_layer(["apex"])`
  - [x] Cooperative routes: `require_role_layer(["cooperative", "apex"])`
  - [x] Shared routes: no role layer (auth only, just `/me`)
- [x] **1.4 Run `cargo clippy` and `cargo test`**
  - [x] All warnings fixed
  - [x] All tests pass

## Phase 2: Frontend Keycloak Integration ✅

> **Goal**: Replace mock auth with real Keycloak authentication.

- [x] **2.1 Install dependencies**
  - [x] `npm install keycloak-js idb-keyval` in frontend/
- [x] **2.2 Create keycloakConfig.ts**
  - [x] `frontend/src/services/shared/keycloakConfig.ts`
  - [x] Reads from `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`
  - [x] PKCE method: S256, onLoad: check-sso
- [x] **2.3 Create authService.ts**
  - [x] `frontend/src/services/shared/authService.ts`
  - [x] `initKeycloak()`, `login()`, `logout()`, `getAccessToken()`, `getUserProfile()`, `hasRole()`, `isAuthenticated()`, `fetchWithAuth()`
  - [x] Token refresh logic (30s before expiry)
  - [x] IndexedDB persistence via idb-keyval
  - [x] `isKeycloakReady()` for route guard checks
- [x] **2.4 Create auth types**
  - [x] `frontend/src/types/auth.ts`
  - [x] `Role`, `UserProfile`, `AuthState`, `AuthContextValue`, `CustomKeycloakToken`, `PendingInvitation`
- [x] **2.5 Create role constants**
  - [x] `frontend/src/constants/roles.ts`
  - [x] `ROLES`, `ROLE_NAV`, `ROLE_NAV_ITEMS`, `ROLE_DASHBOARD`, `ROLE_USERS`, `KEYCLOAK_ROLE_MAP`, `ROLE_HIERARCHY`, `ROLE_DEFAULT_ROUTE`
  - [x] Types: `Role`, `NavGroupId`, `RoleDefinition`
- [x] **2.6 Create AuthContext**
  - [x] `frontend/src/context/AuthContext.tsx`
  - [x] `KeycloakAuthProvider` uses `authService` instead of mock localStorage
  - [x] `useAuth()` hook returns `AuthContextValue` with `role: Role` convenience prop
  - [x] `useRole()` and `useCanAccess(path)` convenience hooks
- [x] **2.7 Create ProtectedRoute & UnauthorizedPage**
  - [x] `frontend/src/components/ProtectedRoute.tsx` — checks auth + role-based access
  - [x] `frontend/src/components/UnauthorizedPage.tsx` — 403 page
  - [x] `frontend/src/routes/unauthorized.tsx` — TanStack Router route
- [x] **2.8 Replace mock auth in App**
  - [x] `src/lib/auth.tsx` — replaced with re-exports from `@/context/AuthContext` and `@/constants/roles` (backward-compatible)
  - [x] `src/routes/__root.tsx` — uses `KeycloakAuthProvider`
  - [x] `src/components/app-shell.tsx` — uses new `useAuth()` from AuthContext
  - [x] `src/routes/auth.login.tsx` — Keycloak login button + dev role selector
  - [x] `src/routes/app.profile.tsx` — null guard for user
- [x] **2.9 Create .env.example**
  - [x] `frontend/.env.example` with `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`
- [x] **2.10 Create silent-check-sso.html**
  - [x] `frontend/public/silent-check-sso.html` for Keycloak silent SSO check

## Phase 3: Frontend Route Protection ✅

> **Goal**: Implement role-based route guards and navigation filtering.

- [x] **3.1 Create route guard utilities**
  - [x] `frontend/src/lib/route-guards.ts`
  - [x] `requireAuth()` — checks Keycloak ready + authenticated, redirects to `/auth/login`
  - [x] `requireRole(...roles)` — checks auth + role membership, redirects to `/unauthorized`
  - [x] `redirectIfAuthenticated()` — redirects logged-in users to dashboard
  - [x] `ROUTE_ACCESS` map for documentation reference
- [x] **3.2 Add `beforeLoad` guards to all app routes**
  - [x] `app.tsx` — `requireAuth()`
  - [x] `app.dashboard.tsx` — `requireAuth()`
  - [x] `app.federations.tsx` — `requireRole("ministry")`
  - [x] `app.apexes.tsx` — `requireRole("federation")`
  - [x] `app.cooperatives.tsx` — `requireRole("apex")`
  - [x] `app.data-collection.tsx` — `requireRole("cooperative")`
  - [x] `app.submissions.tsx` — `requireAuth()`
  - [x] `app.reports.tsx` — `requireAuth()`
  - [x] `app.analytics.tsx` — `requireAuth()`
  - [x] `app.users.tsx` — `requireRole("ministry", "federation", "apex")`
  - [x] `app.settings.tsx` — `requireRole("ministry")`
  - [x] `app.profile.tsx` — `requireAuth()`
  - [x] `app.financial-statement.tsx` — `requireRole("cooperative")`
  - [x] `app.non-financial-data.tsx` — `requireRole("cooperative")`
  - [x] `auth.login.tsx` — `redirectIfAuthenticated()`
- [x] **3.3 Navigation filtering**
  - [x] `src/components/app-shell.tsx` sidebar already uses `ROLE_NAV` and `ROLE_NAV_ITEMS` from role constants
  - [x] Dashboard redirect based on role via `ROLE_DEFAULT_ROUTE`

## Phase 4: OpenAPI Client & Data Layer ✅

> **Goal**: Generate API client and create data hooks for IAM endpoints.

- [x] **4.1 Fix PaginatedResponse generic for OpenAPI**
  - [x] Created `PaginatedOrganizationResponse` and `PaginatedUserResponse` concrete types in `backend/src/api/dto/common.rs`
  - [x] Updated handlers to use concrete types in utoipa annotations
  - [x] Updated `backend/src/api/openapi.rs` to register concrete types
- [x] **4.2 Create OpenAPI spec export tooling**
  - [x] `backend/src/bin/export-openapi-spec.rs` — Rust binary that exports spec to `backend/openapi.json`
  - [x] `scripts/fetch_openapi.js` — Node script that fetches from live backend or falls back to exported file
  - [x] npm scripts: `fetch-api`, `generate-client`, `update-client`, `predev`
- [x] **4.3 Generate OpenAPI client**
  - [x] Switched from `@hey-api/openapi-ts` (broken) to `openapi-typescript` + `openapi-fetch`
  - [x] Generated `frontend/src/openapi-client/api.d.ts` (1872 lines of TypeScript types)
  - [x] Created `frontend/src/openapi-client/index.ts` — API client with auth interceptor
  - [x] Auth interceptor: Bearer token from `authService.getAccessToken()`, 401 redirect to login
- [x] **4.4 Create data hooks**
  - [x] `frontend/src/hooks/federations/useFederations.ts` — CRUD + members + invitations
  - [x] `frontend/src/hooks/apexes/useApexes.ts` — CRUD + members
  - [x] `frontend/src/hooks/cooperatives/useCooperatives.ts` — CRUD + members
  - [x] `frontend/src/hooks/organizations/useOrganizations.ts` — CRUD
  - [x] `frontend/src/hooks/users/useUsers.ts` — CRUD + assign-role
  - [x] `frontend/src/hooks/auth/useAuth.ts` — useCurrentUser, useHealthCheck
  - [x] All hooks use `apiClient.GET/POST/PATCH/DELETE` with proper query key invalidation

## Phase 5: Testing & Polish (IN PROGRESS)

> **Goal**: Verify all auth flows work end-to-end and update pages to use real data.

- [ ] **5.1 Update frontend pages to use real data hooks**
  - [ ] `app.federations.tsx` — replace mock data with `useFederations` hook
  - [ ] `app.apexes.tsx` — replace mock data with `useApexes` hook
  - [ ] `app.cooperatives.tsx` — replace mock data with `useCooperatives` hook
  - [ ] `app.users.tsx` — replace mock data with `useUsers` hook
  - [ ] `app.dashboard.tsx` — replace mock data with real API calls
  - [ ] Other pages as needed
- [ ] **5.2 Backend: Add utoipa query param annotations for paginated endpoints**
  - [ ] List endpoints need `page`, `per_page`, `search` query params in OpenAPI spec
- [ ] **5.3 Backend: Scope enforcement in handlers (claims-based data filtering)**
  - [ ] Currently handlers return TODO placeholders — need real DB queries with scope filtering
- [ ] **5.4 Backend tests**
  - [ ] Test middleware rejects requests without valid JWT
  - [ ] Test middleware rejects requests with wrong role
  - [ ] Test scope enforcement (federation can't see other federation's apexes)
- [ ] **5.5 Frontend tests**
  - [ ] Test ProtectedRoute redirects unauthenticated users
  - [ ] Test ProtectedRoute redirects users with wrong role
  - [ ] Test AuthContext provides correct user profile
  - [ ] Test navigation filtering by role
- [ ] **5.6 Integration tests**
  - [ ] Test full login → dashboard → API call flow
  - [ ] Test token refresh flow
  - [ ] Test logout flow

---

## Architecture Summary

### Backend Auth Flow
1. **Middleware**: `auth_layer` validates JWT, `role_guard_layer` enforces role per route group
2. **Claims**: `Claims` struct extracted from JWT with role, org, cooperation, dimensions
3. **Scope Enforcement**: `ScopeEnforcement` methods extract org/group/coop IDs from claims for data filtering
4. **No handler-level role checks**: All role enforcement is via middleware only

### Frontend Auth Flow
1. **Keycloak Init**: `authService.initKeycloak()` on app startup (check-sso with cached tokens)
2. **Auth Context**: `KeycloakAuthProvider` wraps app, provides `useAuth()` hook
3. **Route Guards**: `beforeLoad` in TanStack Router calls `requireAuth()` or `requireRole()`
4. **API Client**: `openapi-fetch` client with Bearer token interceptor from `authService.getAccessToken()`
5. **Data Hooks**: TanStack Query hooks in `src/hooks/` for each entity

### Key Files
- **Backend Auth**: `src/auth/middleware.rs`, `src/auth/claims.rs`, `src/auth/rbac.rs`
- **Backend Routes**: `src/api/routes/api.rs` (wiring), `src/api/routes/{ministry,federation,apex,cooperative,shared}.rs`
- **Frontend Auth**: `src/services/shared/authService.ts`, `src/context/AuthContext.tsx`, `src/lib/route-guards.ts`
- **Frontend Types**: `src/types/auth.ts`, `src/constants/roles.ts`
- **Frontend API**: `src/openapi-client/index.ts`, `src/openapi-client/api.d.ts`
- **Frontend Hooks**: `src/hooks/{federations,apexes,cooperatives,organizations,users,auth}/`

---

## Token Management Strategy

- **STOP** after completing a Phase or a complex Feature.
- **Mark** the item as `[x]` above.
- **Commit** changes.
- **Instruct User**: "Phase X complete. Please start a new chat to continue to Phase Y."