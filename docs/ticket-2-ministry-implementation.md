# Ticket 2: Ministry Level — Full Stack Implementation

> **Issue**: [#9](https://github.com/ADORSYS-GIS/CoopData/issues/9)
> **Epic**: Multi-Level Identity & Access Management (IAM)
> **Status**: Complete
> **Branch**: `de78228`

## Scope

Own the entire Ministry (Level 1) vertical slice — backend RBAC enforcement + all frontend pages the Ministry user sees.

---

## Completed Work

### Backend

| Area | Endpoint | Method | Handler |
|------|----------|--------|---------|
| Federation CRUD | `/api/v1/ministry/federations` | POST, GET | `create_federation`, `list_federations` |
| Federation CRUD | `/api/v1/ministry/federations/{id}` | GET, PATCH, DELETE | `get_federation`, `update_federation`, `delete_federation` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations` | POST, GET | `invite_user_to_federation`, `list_federation_invitations` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations/{invitation_id}` | DELETE | `delete_federation_invitation` |
| Invitations | `/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend` | POST | `resend_federation_invitation` |
| Members | `/api/v1/ministry/federations/{id}/members` | GET | `list_federation_members` |
| Members | `/api/v1/ministry/federations/{id}/members/{user_id}` | DELETE | `remove_federation_member` |
| Users | `/api/v1/ministry/users` | GET, POST | `list_users`, `create_user` |
| Users | `/api/v1/ministry/users/{id}` | GET, PATCH, DELETE | `get_user`, `update_user`, `delete_user` |
| Users | `/api/v1/ministry/users/{id}/assign-role` | POST | `assign_role_to_user` |
| Organizations | `/api/v1/ministry/organizations` | GET, POST | `list_organizations`, `create_organization` |
| Organizations | `/api/v1/ministry/organizations/{id}` | GET, PATCH, DELETE | `get_organization`, `update_organization`, `delete_organization` |

**RBAC**: All ministry routes protected by `role_guard_layer(&[roles::MINISTRY])` in `api.rs`.

### Frontend

| Page | File | Key Features |
|------|------|-------------|
| Dashboard | `src/pages/shared/DashboardPage.tsx` + `src/components/dashboards/ministry-dashboard.tsx` | Stats (KPI grid), charts (membership growth, sector distribution), activity feed |
| Federation Registry | `src/pages/ministry/FederationsPage.tsx` (639 lines) | TanStack Table with sort/page/search, CRUD dialogs (Dialog + Form), delete confirmation (AlertDialog) |
| Invitation Management | `src/pages/ministry/InvitationList.tsx` (640 lines) | Federation selector, TanStack Table, create/resend/cancel invitations with confirmation |
| Member Management | `src/pages/ministry/MemberList.tsx` (378 lines) | Federation selector, TanStack Table, remove member with confirmation |

### Shared Patterns Applied

- **Tables**: TanStack Table with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` — every table has search, sort, pagination
- **Forms**: React Hook Form + Zod validation (name min 2 chars, email regex, domain validation)
- **Dialogs**: shadcn/ui `Dialog` for create/edit, `AlertDialog` for destructive confirmations
- **Toasts**: sonner `toast.success()/toast.error()` on all mutation outcomes
- **Loading**: `Skeleton` components during data fetch
- **Empty states**: Descriptive empty states with icons and guidance text
- **Error states**: Error display with retry button
- **Mobile responsive**: `overflow-x-auto` wrappers on all tables for horizontal scroll on small screens

---

## Bug Fixes & Issues Encountered

| # | Issue | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | 404 on all parametric routes | Axum 0.7 vs 0.8 path param syntax (`:param` vs `{param}`) | Upgraded axum 0.7→0.8, tower 0.4→0.5, tower-http 0.5→0.6 |
| 2 | Pending invitations always empty | Keycloak User Profile schema had no custom attributes registered | Registered `org.ro.active` schema, fixed attribute merge |
| 3 | Toast notifications invisible | `<Toaster />` was never mounted in React tree | Added `<Toaster richColors closeButton />` to `__root.tsx` |
| 4 | Intermittent 401 errors | Cached token fallback didn't check JWT `exp` | Added `isTokenExpired()` validation |
| 5 | Non-ministry roles could access ministry routes | Insufficient `beforeLoad` guards | Hardened 4 routes to `requireRole("ministry")` |
| 6 | Ministry had no member deletion | Backend endpoint + frontend UI both missing | Added `DELETE /federations/{id}/members/{user_id}` + UI |

See `docs/issues encountered .md` for detailed postmortems.

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
