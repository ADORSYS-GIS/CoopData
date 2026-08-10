# Project Progress & Roadmap: CoopData IAM Integration

> **Instructions for AI:**
> 1. Read `docs/design.md` and `docs/RBAC_AND_AUTH_SYSTEM.md` for full context.
> 2. Check this file at the start of every new chat session to resume work.
> 3. Update this file after EVERY successful feature implementation.

## Project Status

- **Current Phase**: Phase 16: NF Indicator Engine ✅ Complete
- **Overall Progress**: 90%

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

## Phase 5: Testing & Polish ✅

> **Goal**: Verify all auth flows work end-to-end and update pages to use real data.

- [x] **5.1a Ministry vertical slice (Issue #9) — Frontend pages use real API hooks**
  - [x] `FederationsPage.tsx` — uses `useFederations` (CRUD), `useCreateFederation`, `useUpdateFederation`, `useDeleteFederation`
  - [x] `InvitationList.tsx` — uses `useFederationInvitations`, `useInviteUserToFederation`, `useResendInvitation`, `useDeleteInvitation`
  - [x] `MemberList.tsx` — uses `useFederationMembers`, `useRemoveFederationMember`
  - [x] All tables use TanStack Table with sorting, pagination, search
  - [x] All forms use React Hook Form + Zod with validation
  - [x] All mutations show toast (sonner) on success/error
  - [x] All destructive actions have AlertDialog confirmation
  - [x] Loading skeletons during data fetch
  - [x] Route guards enforce `requireRole("ministry")` on all 9 ministry routes
- [x] **5.1b Member deletion (exceeded Issue #9 spec)**
  - [x] Backend: `DELETE /api/v1/ministry/federations/{id}/members/{user_id}` via `keycloak.remove_user_from_organization()`
  - [x] Frontend: Trash2 button + AlertDialog confirmation + toast on success/error
- [x] **5.1c Bug fixes discovered during implementation**
  - [x] `<Toaster />` was never mounted — added to `__root.tsx`, fixing all toast notifications
  - [x] JWT expiry not checked in cached token fallback — added `isTokenExpired()` in `authService.ts`
  - [x] `useFederations` had no `staleTime` — added `staleTime: 30_000`
  - [x] Submissions, Reports, Analytics, Users routes had insufficient guards — hardened to `requireRole("ministry")`
- [x] **5.2 Backend: Add utoipa query param annotations for paginated endpoints**
  - [x] List endpoints need `page`, `per_page`, `search` query params in OpenAPI spec
- [x] **5.3 Backend: Scope enforcement in handlers (claims-based data filtering)**
  - [x] Currently handlers return TODO placeholders — need real DB queries with scope filtering
- [x] **5.4 Backend tests**
  - [x] Test middleware rejects requests without valid JWT
  - [x] Test middleware rejects requests with wrong role
  - [x] Test scope enforcement (federation can't see other federation's apexes)
- [x] **5.5 Frontend tests**
  - [x] Unit tests: `roles.test.ts` (39 tests) — ROLES, ROLE_NAV, ROLE_NAV_ITEMS, ROLE_DASHBOARD, ROLE_HIERARCHY, ROLE_DEFAULT_ROUTE, KEYCLOAK_ROLE_MAP, mapKeycloakRolesToRole
  - [x] Unit tests: `authService.test.ts` — getUserProfile, hasRole, hasAnyRole, isAuthenticated, login, logout, getAccessToken, initKeycloak, waitForKeycloakReady
  - [x] Unit tests: `AuthContext.test.tsx` (16 tests) — useAuth, useRole, useUserRole, useCanAccess, hasRole/hasAnyRole from context, login/logout, init error handling
  - [x] Unit tests: `route-guards.test.ts` (18 tests) — requireAuth, requireRole, redirectIfAuthenticated, ROUTE_ACCESS map
  - [x] Unit tests: `ProtectedRoute.test.tsx` (16 tests) — loading spinner, redirect to login, unauthorized page, children rendering, RoleRedirect for all 4 roles
  - [x] Total: 129 unit tests passing (vitest + @testing-library/react + jsdom)
- [x] **5.6 E2E tests (Playwright)**
  - [x] `login.spec.ts` (5 tests) — login flow, Sign in button, login call verification, authenticated dashboard, welcome toast
  - [x] `ministry.spec.ts` (16 tests) — dashboard, federations, invitations, members, settings, users, sidebar nav visibility, navigation
  - [x] `federation.spec.ts` (18 tests) — dashboard, apexes, users, sidebar nav, denied access to federations/settings/invitations/members
  - [x] `apex.spec.ts` (16 tests) — dashboard, cooperatives, users, sidebar nav, denied access to federations/apexes/settings
  - [x] `cooperative.spec.ts` (21 tests) — dashboard, data-collection, financial-statement, non-financial-data, sidebar nav, denied access
  - [x] `role-redirect.spec.ts` (7 tests) — role-based redirect to dashboard, authenticated/unauthenticated redirect
  - [x] `unauthorized.spec.ts` (20 tests) — Access Denied for cross-role access, Return Home button, Sign in with different account, all-roles-allowed routes
  - [x] Total: 99 E2E tests passing (Playwright + Chromium, Vite mock auth plugin)
- [x] **5.7 Keycloak test realm seed script**
  - [x] `keycloak/seed-test-users.sh` — creates 4 test users (ministry, federation, apex, cooperative) with roles and passwords
- [x] **5.8 E2E mock auth infrastructure**
  - [x] `frontend/e2e-mock-auth.ts` — Vite plugin that replaces keycloak-js with mock when `VITE_E2E_MOCK_AUTH=1`
  - [x] Pre-authenticates mock Keycloak from `window.__E2E_AUTH__` (set by `addInitScript`)
  - [x] Mocks `waitForKeycloakReady()` to resolve immediately (beforeLoad guard compatibility)
  - [x] `frontend/e2e/fixtures/auth.ts` — TEST_USERS, createFakeJWT, mockKeycloak, mockKeycloakAuthenticated, mockBackendApi

---

## Phase 6: Cascade Deletion + Audit Logging ✅

> **Goal**: Implement cascading deletion across Federation → Apex → Cooperative hierarchy with PostgreSQL tracking and audit logging for all mutations.
> **Issue**: [#12](https://github.com/ADORSYS-GIS/CoopData/issues/12)
> **Branch**: `cascade-audit` (based on `develop` @ `757e731`)
> **Documentation**: `docs/ticket-5-cascade-audit-implementation.md`

- [x] **6.1 Database migration** (`backend/migrations/02_cascade_audit_tables.sql`)
  - [x] Tables: `federations`, `apexes`, `cooperatives`, `audit_logs`
  - [x] ALTER `users` to add `federation_id`, `apex_id`, `cooperative_id` FK columns
  - [x] Indexes on audit_logs (action, resource_type, created_at) and FK columns
- [x] **6.2 SeaORM entities** (4 new + 1 modified)
  - [x] `entities/federation.rs`, `entities/apex.rs`, `entities/cooperative.rs`, `entities/audit_log.rs`
  - [x] `entities/user.rs` — added 3 FK columns (federation_id, apex_id, cooperative_id)
  - [x] All registered in `entities/mod.rs`
- [x] **6.3 Repositories** (4 new + 1 modified)
  - [x] `FederationRepository` — create, find_by_keycloak_id, delete
  - [x] `ApexRepository` — create, find_by_keycloak_id, find_by_federation_id, delete
  - [x] `CooperativeRepository` — create, find_by_keycloak_id, find_by_apex_id, delete
  - [x] `AuditLogRepository` — create, find_by_filters (paginated+filtered query)
  - [x] `UserRepository` — added `delete_by_keycloak_id()`
  - [x] All have `#[derive(Clone)]`, registered in `repositories/mod.rs`
- [x] **6.4 Audit DTOs** (`dto/audit.rs`)
  - [x] `AuditLogResponse` with `From<audit_log::Model>`
  - [x] `PaginatedAuditLogResponse` with pagination math (total_pages)
  - [x] `AuditLogFilterParams` with serde defaults (page=1, per_page=20)
  - [x] 7 unit tests in `#[cfg(test)]` module
- [x] **6.5 Audit Service** (`services/audit.rs`)
  - [x] `AuditService::log()` — looks up claims.sub in PG users, builds ActiveModel, calls repo.create
  - [x] Non-fatal: handler continues if audit insert fails (tracing::error!)
  - [x] `repo()` accessor for direct repository access from handlers
  - [x] `extract_ip()` and `extract_user_agent()` helpers for future middleware integration
- [x] **6.6 Audit Handler** (`handlers/audit.rs`)
  - [x] `list_audit_logs` — GET /api/v1/ministry/audit-logs, ministry-only
  - [x] Pagination + filtering (action, resource_type, actor_keycloak_id, resource_keycloak_id, date_from, date_to)
  - [x] Returns `PaginatedAuditLogResponse`
- [x] **6.7 Cascade Deletion** (in delete handlers)
  - [x] `delete_federation` — cascades: org members → apexes → cooperatives → all their members (KC+PG)
  - [x] `delete_apex` — cascades: apex members → cooperatives → coop members (KC+PG)
  - [x] `delete_cooperative` — cascades: coop members (KC+PG)
  - [x] Resilient: individual failures logged via tracing::warn!, cascade continues
- [x] **6.8 PG Tracking in Create Handlers**
  - [x] `create_federation` — inserts federation PG row after KC create
  - [x] `create_apex` — looks up federation PG record by KC org ID, inserts apex with federation_id FK
  - [x] `create_cooperative` — looks up apex PG record by KC group ID, inserts cooperative with apex_id FK
  - [x] Auto-backfill: creates missing parent PG records for old data (pre-PG-tracking entities)
- [x] **6.9 Audit Logging in ALL Mutation Handlers**
  - [x] Federation: CREATE, UPDATE, DELETE, INVITE, DELETE_INVITATION, RESEND_INVITATION, REMOVE_MEMBER, UPDATE_PROFILE
  - [x] Apex: CREATE, UPDATE, DELETE, UPDATE_MEMBER, REMOVE_MEMBER, RESEND_VERIFICATION
  - [x] Cooperative: CREATE, UPDATE, DELETE, UPDATE_MEMBER, REMOVE_MEMBER, RESEND_VERIFICATION
  - [x] Users: CREATE, UPDATE, ASSIGN_ROLE, DELETE
  - [x] Organizations: CREATE, UPDATE, DELETE
  - [x] Me: CHANGE_PASSWORD
- [x] **6.10 Route Refactoring**
  - [x] `routes/federation.rs` — replaced ~400 lines inline handlers with delegations to `handlers::apex::*`
  - [x] `routes/ministry.rs` — added `/audit-logs` route
  - [x] `openapi.rs` — registered audit handler + schemas
- [x] **6.11 App Wiring**
  - [x] `lib.rs` — AppState with federation_repo, apex_repo, cooperative_repo, audit: AuditService
  - [x] `main.rs` — initializes all repos + AuditService
- [x] **6.12 Apex List Fix**
  - [x] `list_apexes` changed from name-prefix search to attribute-based filtering (organization_id)
  - [x] Same pattern as `list_cooperatives`
- [x] **6.13 Tests**
  - [x] 7 unit tests in `dto/audit.rs` (DTO conversions, serde defaults, pagination math, serialization)
  - [x] 15 integration tests in `tests/handlers_audit.rs` (RBAC, filter params, DTO conversion, pagination, route registration, OpenAPI spec, service init)
  - [x] 185 tests pass total (149 unit + 15 audit + 16 cooperative + 5 users), 0 failures, 0 warnings

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
- **Backend NF Engine**: `src/services/nf_indicator_engine.rs`, `src/api/handlers/nf_indicator_stats.rs`, `src/api/handlers/national_overview.rs`
- **Frontend Auth**: `src/services/shared/authService.ts`, `src/context/AuthContext.tsx`, `src/lib/route-guards.ts`
- **Frontend Types**: `src/types/auth.ts`, `src/constants/roles.ts`
- **Frontend API**: `src/openapi-client/index.ts`, `src/openapi-client/api.d.ts`
- **Frontend Hooks**: `src/hooks/{federations,apexes,cooperatives,organizations,users,auth,analytics}/`
- **Frontend Analytics**: `src/pages/shared/AnalyticsPage.tsx`, `src/hooks/analytics/useNfStatistics.ts`, `src/hooks/analytics/useNationalOverview.ts`

---

## Data Subsystem Phases (see `docs/architecture.md` — the source of truth for DB + data flow)

> The IAM phases (1–5) are complete. The data-collection + financial-statement + AI-extraction + 4-tier review subsystem is designed in `docs/architecture.md`.

### Phase 6: Database & Schema ✅
- [x] Create `backend/src/migration/` (SeaORM-migration) files per `docs/architecture.md` §13
- [x] Seed `chart_of_accounts` (ADORSYS CoA 1000–6999) from `doc/COOPDATA ADORSYS.xlsx`
- [x] SeaORM entities for submissions, cooperatives bridge, financial_statements, balance_sheet_line_items
- [x] Entity, DTO, repo for all tables (bottom-up)

### Phase 7: Financial Data Layer ✅
- [x] DTOs + repository + handler for financial statements & line items
- [x] Routes under `/cooperative/financial-statements`

## Phase 6.5: High-Stakes Deletion ✅

> **Goal**: Add multi-layered confirmation for cascade-deleting federations, apexes, and cooperatives. Type-to-confirm + re-authentication (password + optional OTP) + Redis-backed verification tokens.

- [x] **6.5.1 Backend: Error variant + Keycloak OTP support**
  - [x] `PreconditionRequired(String)` added to `AppError` enum → HTTP 428
  - [x] `verify_user_password` updated with optional `totp` parameter
  - [x] `get_user_otp_status(user_id)` method added to `KeycloakService` — checks Admin API credentials endpoint for `type: "otp"`
- [x] **6.5.2 Backend: VerificationTokenService**
  - [x] `backend/src/services/verification_token.rs` — Redis-backed tokens with 120s TTL, single-use (`validate_and_consume` deletes from Redis)
  - [x] Key format: `verify:{user_id}:{token}`
- [x] **6.5.3 Backend: VerifyIdentity endpoint**
  - [x] `POST /api/v1/me/verify-identity` — accepts `{password, otp?}`, checks OTP if configured, calls ROPC with `totp`, generates + stores token, returns `{verification_token, requires_otp}`
  - [x] DTOs in `backend/src/api/dto/verification.rs`: `VerifyIdentityRequest`, `VerifyIdentityResponse`, `DeletePreviewResponse`
  - [x] Route added to `routes/shared.rs`
- [x] **6.5.4 Backend: Delete-preview endpoints**
  - [x] `GET /api/v1/ministry/federations/{id}/delete-preview` — counts apexes, cooperatives, members
  - [x] `GET /api/v1/federation/apexes/{id}/delete-preview` — counts cooperatives, members
  - [x] `GET /api/v1/apex/cooperatives/{id}/delete-preview` — counts members
- [x] **6.5.5 Backend: Delete handlers updated**
  - [x] All 3 delete handlers (`delete_federation`, `delete_apex`, `delete_cooperative`) require `X-Verification-Token` header
  - [x] Missing/invalid/expired token → `428 Precondition Required`
  - [x] Token consumed (single-use) after successful validation
- [x] **6.5.6 Backend: OpenAPI registration**
  - [x] All 4 new endpoints + 3 new DTOs registered in `openapi.rs`
- [x] **6.5.7 Frontend: Hooks + Dialog**
  - [x] `useVerifyIdentity` hook — POST /me/verify-identity via raw fetch
  - [x] `useFederationDeletePreview`, `useApexDeletePreview`, `useCooperativeDeletePreview` hooks
  - [x] `useDeleteFederation`, `useDeleteApex`, `useDeleteCooperative` updated to send `x-verification-token` header
  - [x] `DeleteConfirmationDialog` component — 3-step dialog (type-to-confirm → password/OTP → deleting spinner)
  - [x] Wired into `FederationsPage`, `ApexesPage`, `CooperativesPage` — replaced old AlertDialog/custom modals
- [x] **6.5.8 Verification**
  - [x] Backend: `cargo fmt` clean, `cargo clippy` clean, 162 unit + 36 integration tests pass
  - [x] Frontend: `tsc --noEmit` clean, `npm run lint` 0 errors (16 pre-existing warnings)
  - [x] OpenAPI spec verified: all 4 new endpoints present
  - [x] Docker containers rebuilt + restarted, backend healthy on port 3000

### Phase 8: AI Extraction Pipeline ✅
- [x] `object_storage.rs` (MinIO/S3 via reqwest + env config)
- [x] `ai_extraction.rs` + `FinancialStatementExtractor` trait + mock impl
- [x] Multipart upload handler → file + extraction job; poll endpoint
- [x] OpenAPI annotations

### Phase 9: Submission & 4-Tier Review Workflow ✅
- [x] `submission_workflow` service (state machine + authority matrix)
- [x] `submission_reviews` append; replace legacy `assessments` entity
- [x] Tier handlers (apex/federation/ministry approve/return/reject)

### Phase 10: Non-Financial Data ✅
- [x] Members / savings / loans / fixed deposits entities→routes
- [x] NF indicator engine (`nf_indicator_engine.rs`) computing 5 category stats from 5 NF tables
- [x] NF indicator endpoint (`GET /cooperative/nf-statistics`)
- [x] National overview endpoint (`GET /analytics/national-overview`)
- [x] Offline sync push/pull endpoints

### Phase 11: KPI Engine & Abnormality Detection ✅ (Sprint 4)
- [x] Port `frontend/src/lib/kpi-calculations.ts` → `backend/src/services/kpi_engine.rs`
  - [x] 18 financial KPIs (PAR30, ROA, ROE, CAR, LFR, OSS, NIM, etc.) with status thresholds
  - [x] `GET /api/v1/cooperative/submissions/{id}/kpis` endpoint — scope-checked, on-demand compute
  - [x] `GET /api/v1/benchmarks?kpi_name=&cooperative_type=&reporting_year=` — Redis-cached 1hr
  - [x] `GET /api/v1/cooperative/submissions/{id}/export?format=xlsx|csv` — rust_xlsxwriter + csv crate
  - [x] `GET /api/v1/ministry/stats` — ministry dashboard aggregate counts
  - [x] 8 unit tests in `services/kpi_engine.rs`, 4 DTO tests in `dto/financial.rs`
- [ ] `abnormality_detector.rs` rules wired to submission workflow (existing service, not wired)
- [ ] Compliance scoring + nightly batch materialization to `computed_kpis` table

### Phase 12: Frontend Integration ✅ (Sprint 4)
- [x] `useCooperativeKpis` — fetches KPIs for a specific submission
- [x] `useLatestSubmission` — picks highest reporting_year, no status priority
- [x] `useBenchmarks` — sector benchmark data with 1hr client cache
- [x] `useMinistryStats` — ministry dashboard aggregate stats
- [x] `BenchmarkInsightPanel` — automated peer comparison with severity, comparison bars, expander
- [x] `AnalyticsPage.tsx` — cooperative KPI hero row and performance metrics wired to real data
- [x] `cooperative-dashboard.tsx` — Key Financial Metrics grid wired to real KPIs with loading skeletons
- [x] `report-export-panel.tsx` — real XLSX/CSV file download for cooperative individual reports
- [x] 16 frontend tests (BenchmarkInsightPanel + useLatestSubmission sorting)
- [ ] Higher-tier (apex/federation/ministry) analytics wired to real aggregated stats (Sprint 5)
- [ ] Offline sync queue

### Phase 13: Sprint 4 Gaps & Polish ✅
- [x] **Upload type restriction** — removed `.xlsx,.xls` from frontend accepted extensions and backend supported MIME types
- [x] **Logout race condition fix** — `isLoggingOut` flag in `authService.ts` prevents token refresh during logout
- [x] **Re-upload/replace** — `delete()` methods on uploaded_file/extraction_job/financial_statement repos; handler detects existing FS and replaces
- [x] **File serving** — `serve_uploaded_file` handler + route `GET /submissions/{sid}/files/{fid}`
- [x] **DocumentViewer** — `DocumentViewer` component (iframe for PDFs, img for images with zoom/pan)
- [x] **Delete FS backend** — `DELETE /financial-statements/{id}` handler + route
- [x] **Delete NF data backend** — `DELETE /submission-sections/{id}` route
- [x] **Stats DTOs** — `average_par30` + `average_car` added to all stat DTOs; `FederationStatsResponse` rewritten
- [x] **Federation dashboard** — uses `useFederationStats` hook with API stats
- [x] **Skeleton loading** — all dashboards show skeleton cards during loading
- [x] **Bulk export** — `bulk_export()` on `ExportService` (CSV/Excel/PDF); Ministry/Federation/Apex dashboards show export buttons
- [x] **BenchmarkInsightPanel** — responsive collapse, 6 benchmark insight cards with color-coded status
- [x] Verification: `cargo clippy` ✅, `npm run lint` ✅ (0 errors, 21 warnings)

### Phase 14: KPI/Indicator Audit ✅
- [x] Read `COOPDATA ADORSYS.xlsx` (all 14 sheets)
- [x] Created `sources/KPI-INDICATORS-AUDIT.md` — comprehensive inventory of:
  - 18 Financial KPIs (all implemented ✅)
  - 56 Non-Financial indicators across 5 categories (all missing ❌)
  - NF database field definitions (members, savings, loans, fixed_deposits, farm_coop)
  - Dashboard indicators from Excel spec
  - Gap analysis: Financial = ✅ complete, NF = ❌ 0/56 implemented
  - 3-phase implementation roadmap

### Phase 15: NF Indicator Engine (Backend) ✅
- [x] **`backend/src/services/nf_indicator_engine.rs`** — Async engine querying 5 NF tables via SeaORM
  - `MembershipStats` (27 fields): total/active/dormant/exited counts, gender breakdown, age groups, urban/rural, AGM attendance, leadership, voting, + derived percentages
  - `SavingsStats` (18 fields): account counts, trends, balances, penetration
  - `LoanStats` (23 fields): loan statuses, borrower demographics, repayment, penetration
  - `FixedDepositStats` (14 fields): FD statuses, balances, penetration
  - `FarmCoopStats` (17 fields): operational metrics
  - `pct()` helper for safe division; unit tests
- [x] **`backend/src/api/dto/non_financial.rs`** — DTOs for all 5 category structs with `From<Engine*>` impls
- [x] **`backend/src/api/handlers/nf_indicator_stats.rs`** — Handler `get_nf_statistics` with `#[utoipa::path]` annotation
- [x] **Route**: `GET /api/v1/cooperative/nf-statistics` added to cooperative routes
- [x] Verification: `cargo check` ✅, `cargo clippy` ✅ (3 pre-existing warnings)

### Phase 16: Frontend NF Wiring + National Dashboard ✅
- [x] **`frontend/src/hooks/analytics/useNfStatistics.ts`** — React Query hook calling `GET /api/v1/cooperative/nf-statistics`
- [x] **AnalyticsPage.tsx** — 5 edits:
  - Replaced hardcoded `genderData` (54.1%/38.4%/7.5%) with real `nfStats.membership.female_pct/male_pct/other_pct`
  - Replaced hardcoded `youthData` with real `nfStats.membership.youth_pct/adult_pct`
  - Added **4 NF Indicator Cards**: Savings Penetration, Credit Penetration, FD Penetration, Repayment Discipline
  - Updated Membership Growth chart for cooperative role to use NF data
  - All charts fall back to mock data when NF unavailable (backward compatible)
- [x] **`backend/src/api/handlers/national_overview.rs`** — `get_national_overview`: aggregates KPIs across all accessible cooperatives, traffic-light distribution
- [x] **`backend/src/api/dto/national_overview.rs`** — `NationalOverviewResponse`, `TrafficLightDistribution`, `CoopKpiRow`
- [x] **`backend/src/repositories/financial_statement.rs`** — `find_latest_by_cooperative()`, `find_by_cooperative_ids()`
- [x] **Route**: `GET /api/v1/analytics/national-overview` added to shared routes
- [x] **`frontend/src/hooks/analytics/useNationalOverview.ts`** — React Query hook
- [x] **AnalyticsPage.tsx** — National KPI Overview section with traffic-light bars + institution comparison table (ministry/federation/apex only)
- [x] Verification: `cargo check` ✅, `cargo clippy` ✅, `npm run lint` ✅ (0 errors)

### Phase 17: Testing & Polish
- [ ] Repo unit tests, handler integration tests, state-machine transition tests, abnormality-rule tests, E2E full flow

### Phase 18: Hierarchical Analytics

> **Goal**: Replace mock and empty analytics with submission-scoped, hierarchy-aware financial and non-financial data that supports full drill-down at every role.

- [x] **18.1 Portfolio foundation** — hierarchy-scoped financial KPI rows now include submission-scoped NF summaries and portfolio averages; the OpenAPI client is regenerated and higher-tier Analytics renders the real NF portfolio data.
- [x] **18.2 Submission-period NF history** — `GET /api/v1/analytics/nf-trend` returns authorized, reporting-year snapshots of membership, youth, women, activity, savings, credit, fixed-deposit and repayment indicators. Analytics now shows this real history with an honest empty state.
- [x] **18.3 Mock-path cleanup** — mock higher-level loan risk, regional member trend, submission timeline and zero-valued prior-period comparison UI no longer render; the cooperative leaderboard is derived from returned financial KPI statuses. Analytics hooks now use the generated OpenAPI client.
- [x] **18.4 Financial semantics and activity** — monthly financial analytics now label COA 1999 correctly as total assets and aggregate approved submissions only. `GET /api/v1/analytics/submission-activity` replaces the invented timeliness series with submitted, approved, in-review and rejected activity by reporting month.
- [x] **18.5 Approved drill-down and NF risk** — higher-tier institution comparison rows open the authorized approved submission detail; portfolio NF summaries now include dormancy, AGM participation, arrears and FD early-withdrawal risk alongside penetration and repayment measures.
- [x] Submission-period financial portfolio API with hierarchy scope enforcement
- [x] Cooperative, Apex, Federation and Ministry aggregate-to-detail analytics UI
- [x] Financial/NF indicator, scope and role-journey tests

### Phase 19: Analytics i18n Localization ✅
- [x] Replaced all hardcoded UI strings in `frontend/src/components/analytics/*` with `useTranslation()` calls
- [x] Added all `analytics.*` keys to `frontend/src/i18n/locales/en.json`
- [x] Localized 25+ components: ComparativeIncomeStatement, CooperativeRanking, CooperativeComparison, CooperativeDeepDive, ComplianceRadialGauges, LoanProvisioningWaterfall, GenderStatusDoughnuts, DepositConcentrationGauge, GovernanceFunnel, FinancialInclusionBar, AgriResilienceRadar, ComplianceDoughnutCharts, AgeDemographicsChart, ApexDistributionBar, FinancialIndicators, GenderParticipationChart, NetworkConsolidatedMetrics, PortfolioClassification, PortfolioOverviewChart, RegionalGroupedBar, SavingsLoansDepositsChart, LoanDualBar, CoopTrendAreaChart, SavingsRadialGauges
- [x] Left props-driven components unchanged (MetricsGridCards, KpiScorecard)
- [x] Verification: JSON valid ✅, `tsc --noEmit` clean ✅, ESLint clean ✅, 184 unit tests pass ✅

### Phase 20: Local AI Migration (Self-Hosted Ollama) ✅
> **Goal**: Move AI extraction from cloud API (Gemini) to self-hosted local models (Ollama) to eliminate token limits and keep financial data on-premise. Config-only change — the backend already calls an OpenAI-compatible `/chat/completions` endpoint.

- [x] **`.env.example`** — documented local (Ollama) vs production (AWS GPU) vs cloud (Gemini) AI config; added `AI_PROVIDER_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_VISION_MODEL`, `AI_MAX_TOKENS`
- [x] **`docker-compose.yml`** — added `ollama` service (OpenAI-compatible `/v1` endpoint) + `ollama_data` volume
- [x] **`docker-compose.ghcr.yaml`** — added `ollama` service + `ollama_data` volume for production
- [x] **`start-prod.sh`** — auto-pulls `AI_MODEL` from `.env` into Ollama on startup (no interactive prompt); skips when `EXTRACTION_BACKEND=mock` or using a cloud provider
- [x] **`.env`** — pointed at local Ollama (`http://ollama:11434/v1`, `qwen2.5-vl:3b`) for dev testing
- [x] **`scripts/setup-ollama-gpu.sh`** — AWS GPU provisioning: NVIDIA driver, Ollama install, bind 0.0.0.0:11434, pull `qwen2.5-vl:32b`
- [x] **`docs/design-local-ai.md`** — design doc (problem, 4 AI tasks, config-only rationale, model selection, architecture, acceptance criteria)
- [x] **`docs/runbook-local-ai.md`** — operational runbook (local dev, AWS GPU prod, cost control, troubleshooting)
- [x] Verification: `bash -n` on setup script ✅

> **Next:** Pull a model locally and run an end-to-end extraction test; deploy GPU instance on AWS and A/B test `qwen2.5-vl:32b` vs `internvl3:38b`.

---

## Token Management Strategy

- **STOP** after completing a Phase or a complex Feature.
- **Mark** the item as `[x]` above.
- **Commit** changes.
- **Instruct User**: "Phase X complete. Please start a new chat to continue to Phase Y."
