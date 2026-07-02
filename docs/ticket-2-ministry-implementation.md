# Ticket 2: Ministry Level — Full Stack Implementation

> **Issue**: [#9](https://github.com/ADORSYS-GIS/CoopData/issues/9)
> **Epic**: Multi-Level Identity & Access Management (IAM)
> **Status**: Complete
> **Branch**: `de78228`

## Scope

Own the entire Ministry (Level 1) vertical slice — backend RBAC enforcement + all frontend pages the Ministry user sees.

---

## Pre-Existing Foundation (built before this PR)

### Backend — Endpoints existed with RBAC middleware

| Area | Endpoint | Method | Handler |
|------|----------|--------|---------|
| Federation CRUD | `/api/v1/ministry/federations` | POST, GET | `create_federation`, `list_federations` |
| Federation CRUD | `/api/v1/ministry/federations/{id}` | GET, PATCH, DELETE | `get_federation`, `update_federation`, `delete_federation` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations` | POST, GET | `invite_user_to_federation`, `list_federation_invitations` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations/{invitation_id}` | DELETE | `delete_federation_invitation` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend` | POST | `resend_federation_invitation` |
| Members (read) | `/api/v1/ministry/federations/{id}/members` | GET | `list_federation_members` |
| Users | `/api/v1/ministry/users` | GET, POST | `list_users`, `create_user` |
| Users | `/api/v1/ministry/users/{id}` | GET, PATCH, DELETE | `get_user`, `update_user`, `delete_user` |
| Users | `/api/v1/ministry/users/{id}/assign-role` | POST | `assign_role_to_user` |
| Organizations | `/api/v1/ministry/organizations` | GET, POST | `list_organizations`, `create_organization` |
| Organizations | `/api/v1/ministry/organizations/{id}` | GET, PATCH, DELETE | `get_organization`, `update_organization`, `delete_organization` |

**RBAC**: All ministry routes protected by `role_guard_layer(&[roles::MINISTRY])` in `api.rs`.

### Frontend — Pages existed with TanStack Table + React Hook Form + Zod

| Page | File | Key Features |
|------|------|-------------|
| Dashboard | `src/pages/shared/DashboardPage.tsx` + `src/components/dashboards/ministry-dashboard.tsx` | Stats (KPI grid), charts (membership growth, sector distribution), activity feed |
| Federation Registry | `src/pages/ministry/FederationsPage.tsx` (639 lines) | TanStack Table with sort/page/search, CRUD dialogs (Dialog + Form), delete confirmation (AlertDialog) |
| Invitation Management | `src/pages/ministry/InvitationList.tsx` (640 lines) | Federation selector, TanStack Table, create/resend/cancel invitations with confirmation |
| Member Management | `src/pages/ministry/MemberList.tsx` (378 lines) | Read-only member table with federation selector, search/sort/pagination, inert "View Details" button |

**Route guards**: `requireRole("ministry")` on `/app/federations`, `/app/invitations`, `/app/members`, `/app/settings`, `/app/dashboard`. `requireAuth()` on `/app/submissions`, `/app/reports`, `/app/analytics`. `requireRole("ministry", "federation", "apex")` on `/app/users`.

### Shared Patterns

- **Tables**: TanStack Table with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` — every table has search, sort, pagination
- **Forms**: React Hook Form + Zod validation (name min 2 chars, email regex, domain validation)
- **Dialogs**: shadcn/ui `Dialog` for create/edit, `AlertDialog` for destructive confirmations
- **Loading**: `Skeleton` components during data fetch
- **Empty states**: Descriptive empty states with icons and guidance text
- **Error states**: Error display with retry button

---

## Changes in This PR

### Bug Fixes

| # | Issue | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | 404 on all parametric routes | Axum 0.7 vs 0.8 path param syntax (`:param` vs `{param}`) | Upgraded axum 0.7→0.8, tower 0.4→0.5, tower-http 0.5→0.6 |
| 2 | Pending invitations always empty | Keycloak User Profile schema had no custom attributes registered | Registered `org.ro.active` schema, fixed attribute merge |
| 3 | Toast notifications invisible | sonner `<Toaster />` was never mounted in React tree | Added `<Toaster richColors closeButton />` to `__root.tsx` |
| 4 | Intermittent 401 errors | Cached token fallback didn't check JWT `exp` | Added `isTokenExpired()` validation in `getAccessToken()` |
| 5 | Non-ministry roles could access ministry routes | 4 routes had insufficient `beforeLoad` guards | Hardened to `requireRole("ministry")`: submissions, reports, analytics, users |

### New Features

| # | Feature | Details |
|---|---------|---------|
| 6 | Member deletion (full stack) | Backend: `DELETE /federations/{id}/members/{user_id}` endpoint. Frontend: `useRemoveFederationMember()` hook, Trash2 button + AlertDialog confirmation + toast in MemberList.tsx |

### Polish

| # | Improvement | Details |
|---|-------------|---------|
| 7 | Mobile responsive tables | Added `overflow-x-auto` wrappers to FederationsPage, InvitationList, MemberList |
| 8 | Reduce refetch frequency | Set `staleTime: 30_000` on `useFederations` |

### Documentation

- `docs/progress.md` — updated Phase 5
- `docs/issues encountered .md` — 4 new postmortems (#3 sonner, #4 JWT, #5 route guards, #6 member deletion)
- This file

---

## Verification

- [x] Backend `cargo check` — passes
- [x] Backend `cargo clippy` — no warnings
- [x] Frontend `npx tsc --noEmit` — no errors (strict mode)
- [x] Frontend `npm run lint` — no errors in ministry files
- [x] Route guards: all 9 ministry routes enforce `requireRole("ministry")`
- [x] Unauthorized users redirected to `/unauthorized`
- [x] All mutations have toast feedback
- [x] All destructive actions have confirmation dialogs
- [x] Tables are mobile-responsive with horizontal scroll
