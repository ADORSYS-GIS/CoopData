# Ticket 2: Ministry Level — Full Stack Implementation

> **Issue**: [#9](https://github.com/ADORSYS-GIS/CoopData/issues/9)  
> **Epic**: Multi-Level Identity & Access Management (IAM)  
> **Status**: Complete  
> **Branch**: `de78228`

## Scope

Own the entire Ministry (Level 1) vertical slice — backend RBAC enforcement + all frontend pages the Ministry user sees.

---

## Backend Implementation

### Endpoints Implemented

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

### RBAC Implementation

All ministry routes protected by `role_guard_layer(&[roles::MINISTRY])` in `api.rs`. Ministry endpoints return 403 Forbidden if caller lacks `ministry` role.

### Technical Decisions

- Member deletion endpoint added with proper audit trail
- Token validation includes `isTokenExpired()` check to prevent cached JWT expiration issues
- Keycloak User Profile schema registered with `org.ro.active` attribute for invitation tracking

---

## Frontend Implementation

### Pages Implemented

| Page | File | Key Features |
|------|------|-------------|
| Dashboard | `src/pages/shared/DashboardPage.tsx` + `src/components/dashboards/ministry-dashboard.tsx` | Stats (KPI grid), charts (membership growth, sector distribution), activity feed |
| Federation Registry | `src/pages/ministry/FederationsPage.tsx` | TanStack Table with sort/page/search, CRUD dialogs (Dialog + Form), delete confirmation (AlertDialog) |
| Invitation Management | `src/pages/ministry/InvitationList.tsx` | Federation selector, TanStack Table, create/resend/cancel invitations with confirmation |
| Member Management | `src/pages/ministry/MemberList.tsx` | Read-only member table with federation selector, search/sort/pagination, member removal with confirmation |

### Hooks Implemented

- `useFederations` - List, create, update, delete federations
- `useFederation` - Get single federation
- `useCreateFederation` - Mutation hook for creating federations
- `useUpdateFederation` - Mutation hook for updating federations
- `useRemoveFederation` - Mutation hook for deleting federations
- `useInvitations` - List, create, resend, cancel invitations
- `useRemoveFederationInvitation` - Mutation hook for canceling invitations
- `useResendFederationInvitation` - Mutation hook for resending invitations
- `useFederationMembers` - List federation members
- `useRemoveFederationMember` - Mutation hook for removing members

### Shared Patterns

- **Tables**: TanStack Table with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` — every table has search, sort, pagination
- **Forms**: React Hook Form + Zod validation (name min 2 chars, email regex, domain validation)
- **Dialogs**: shadcn/ui `Dialog` for create/edit, `AlertDialog` for destructive confirmations
- **Loading**: `Skeleton` components during data fetch
- **Empty states**: Descriptive empty states with icons and guidance text
- **Error states**: Error display with retry button
- **Toasts**: sonner `<Toaster richColors closeButton />` mounted in `__root.tsx` for notifications

### Route Protection

- `requireRole("ministry")` on `/app/federations`, `/app/invitations`, `/app/members`, `/app/settings`, `/app/dashboard`
- `requireAuth()` on `/app/submissions`, `/app/reports`, `/app/analytics`
- `requireRole("ministry", "federation", "apex")` on `/app/users`
- Unauthorized users redirected to `/unauthorized`

### Polish & Optimizations

- Mobile responsive tables with `overflow-x-auto` wrappers
- `staleTime: 30_000` on `useFederations` to reduce unnecessary refetches

---

## Technical Stack

### Backend
- **Axum 0.8** with path parameter syntax `{param}`
- **Tower 0.5** / **tower-http 0.6** middleware stack
- **SeaORM** for database entities
- **utoipa** for OpenAPI documentation

### Frontend
- **TanStack Query** for server state management
- **TanStack Table** for data tables
- **React Hook Form** + **Zod** for form validation
- **shadcn/ui** components

---

## Verification

- [x] Backend `cargo check` — passes
- [x] Backend `cargo clippy` — no warnings
- [x] Frontend `npx tsc --noEmit` — no errors (strict mode)
- [x] Frontend `npm run lint` — no errors in ministry files
- [x] Route guards: all ministry routes enforce `requireRole("ministry")`
- [x] Unauthorized users redirected to `/unauthorized`
- [x] All mutations have toast feedback
- [x] All destructive actions have confirmation dialogs
- [x] Tables are mobile-responsive with horizontal scroll
- [x] JWT token expiration handled in cached token fallback

---

## Acceptance Criteria Checklist

**Backend:**
- [x] Ministry endpoints return 403 if caller lacks `ministry` role
- [x] Ministry federation CRUD works end-to-end with RBAC middleware
- [x] Ministry invitation endpoints work with RBAC middleware
- [x] Ministry member listing and removal works with RBAC middleware

**Frontend:**
- [x] Ministry dashboard shows federation count, user count, and pending invitations
- [x] Federation list page with search, filter, and pagination
- [x] Create federation form validates required fields (name, domain) and submits to API
- [x] Edit federation form pre-fills and updates via API
- [x] Delete federation shows confirmation dialog, calls API, invalidates cache
- [x] Invitation list shows pending invitations with resend and cancel actions
- [x] Create invitation form validates email and submits to API
- [x] Member list shows all members of a federation
- [x] All pages show loading skeletons during data fetch
- [x] All mutations show success/error toast notifications
- [x] Unauthorized users (non-ministry role) cannot access these pages
- [x] Responsive design works on mobile and desktop
- [x] TypeScript strict mode passes, `npm run lint` passes