# Apex & Cooperative IAM — Architecture & Implementation

## Overview

The CoopData system uses a 4-level IAM hierarchy backed entirely by Keycloak:

```
Ministry  (Level 1) — Keycloak Organization owner
  └── Federation  (Level 2) — Keycloak Organization member
        └── Apex  (Level 3) — Keycloak Group
              └── Cooperative  (Level 4) — Keycloak Subgroup (child group)
                    └── Cooperative User — Keycloak User, member of Subgroup
```

This document covers Levels 3 and 4 in full.

---

## Keycloak Data Model

| Concept | Keycloak entity | Notes |
|---|---|---|
| Apex | `Group` (top-level) | Named `{org_id}-{apex_name}`. Attribute `organization_id` links it back to the Federation org. |
| Cooperative | `SubGroup` (child of Apex group) | Created via `POST /groups/{apex_id}/children`. Attribute `type=cooperative`. |
| Cooperative user | `User` member of the Subgroup | Has realm role `cooperative`. Gets `VERIFY_EMAIL` + `UPDATE_PASSWORD` required actions on creation. |

### JWT Claims

When a user logs in the token contains:

```json
{
  "realm_access": { "roles": ["cooperative"] },
  "cooperation": ["/apex-group-uuid/cooperative-subgroup-uuid"],
  "assigned_dimensions": ["finance", "operations"]
}
```

The backend parses these like so:

```
get_apex_group_id()   → first path segment of cooperation[0]  → "apex-group-uuid"
get_cooperative_id()  → second path segment of cooperation[0] → "cooperative-subgroup-uuid"
get_assigned_dimensions() → reads the assigned_dimensions array claim
```

---

## Backend Architecture

### Layer separation

```
HTTP Request
    │
    ▼
auth_layer (JWT validation → injects Arc<Claims> into extensions)
    │
    ▼
role_guard_layer (checks realm roles, returns 403 before handler runs)
    │
    ▼
Handler (thin: validate input → call service → return DTO)
    │
    ▼
KeycloakService (all Keycloak Admin REST API calls)
```

No SQL database is used for IAM data. All group/user state lives in Keycloak.

### Route prefixes and role guards

| Prefix | Required role | Guard enforced in |
|---|---|---|
| `/api/v1/apex/*` | `apex` | `api.rs` → `role_guard_layer(&[roles::APEX])` |
| `/api/v1/cooperative/*` | `cooperative` OR `apex` | `api.rs` → `role_guard_layer(&[roles::COOPERATIVE, roles::APEX])` |

### File locations

```
backend/src/
├── api/
│   ├── routes/
│   │   ├── apex.rs          ← route wiring for /api/v1/apex/*
│   │   └── cooperative.rs   ← route wiring for /api/v1/cooperative/*
│   ├── handlers/
│   │   └── cooperative.rs   ← all apex + cooperative handler functions
│   └── dto/
│       ├── apex.rs          ← ApexResponse, CreateApexRequest, UpdateApexRequest
│       ├── cooperative.rs   ← CooperativeResponse, Create/UpdateCooperativeRequest
│       └── member.rs        ← AddMemberRequest, MemberResponse, UpdateMemberRequest
├── auth/
│   ├── claims.rs            ← JWT struct + get_apex_group_id(), get_cooperative_id()
│   └── rbac.rs              ← ScopeEnforcement helpers
└── services/
    └── keycloak.rs          ← create_subgroup(), add_member_to_group(), etc.
```

---

## Cooperative CRUD (Apex admin)

### Create cooperative

```
POST /api/v1/apex/cooperatives
Authorization: Bearer <apex-token>
Content-Type: application/json

{ "name": "Manzini Dairy", "description": "Optional" }
```

**What happens:**
1. Handler extracts `apex_group_id` from `claims.get_apex_group_id()` (parses the `cooperation` JWT claim).
2. Calls `keycloak.create_subgroup(apex_group_id, name, attrs)`.
3. Keycloak creates the group under `POST /groups/{apex_group_id}/children`.
4. Attributes stored: `type=cooperative`, `description=...` (if provided).
5. Returns `201 CooperativeResponse` with the new group's `id`, `name`, `path`, `parent_group_id`, `description`.

**Response:**
```json
{
  "id": "subgroup-uuid",
  "name": "Manzini Dairy",
  "path": "/apex-group-uuid/Manzini Dairy",
  "parent_group_id": "apex-group-uuid",
  "description": "Optional"
}
```

### List cooperatives

```
GET /api/v1/apex/cooperatives
Authorization: Bearer <apex-token>
```

**What happens:**
1. Gets `apex_group_id` from claims.
2. Calls `keycloak.get_group_by_id(apex_group_id)` — returns the full group with `subGroups`.
3. Filters subgroups where `attributes.type == "cooperative"` (or no type, for compatibility).
4. Maps each to `CooperativeResponse`.

### Get / Update / Delete cooperative

```
GET    /api/v1/apex/cooperatives/{id}
PATCH  /api/v1/apex/cooperatives/{id}   body: { "name"?, "description"? }
DELETE /api/v1/apex/cooperatives/{id}
```

All call the corresponding `keycloak.get_group_by_id` / `keycloak.update_group` / `keycloak.delete_group`.

- `PATCH` uses `PUT /groups/{id}` on Keycloak (full replace), then re-fetches via `GET /groups/{id}`.
- `DELETE` returns `204 No Content`.

---

## Cooperative Member Management (Apex admin)

### Add member

```
POST /api/v1/apex/cooperatives/{cooperative_id}/members
Authorization: Bearer <apex-token>
Content-Type: application/json

{
  "email": "user@example.com",
  "first_name": "Jean",
  "last_name": "Dupont",
  "role": "cooperative",
  "assigned_dimensions": ["finance", "operations"]
}
```

`role` **must** be `"cooperative"`. Any other value returns `400`.

**What `add_member_to_group` does (KeycloakService):**
1. Search for existing user by email (`GET /users?email=...`).
2. **If user exists:** check they are not already in any group (returns `409` if they are). Attach `assigned_dimensions` to user attributes if provided.
3. **If user does not exist:** create via `POST /users` with `email_verified=false`, `required_actions=["VERIFY_EMAIL","UPDATE_PASSWORD"]`, temporary password `Temp{timestamp}!`.
4. Assign realm role `cooperative` + client roles (`query-groups`, `view-users`, `view-groups`).
5. Add user to the cooperative subgroup via `PUT /users/{user_id}/groups/{group_id}`.
6. Trigger `VERIFY_EMAIL` action email via `PUT /users/{user_id}/execute-actions-email`.
7. Returns the created/updated `KeycloakUser`.

**Response:** `201 MemberResponse`
```json
{
  "id": "user-uuid",
  "username": "user@example.com",
  "email": "user@example.com",
  "first_name": "Jean",
  "last_name": "Dupont"
}
```

The user receives an email with a link to set their password and verify their email before they can log in.

### List members

```
GET /api/v1/apex/cooperatives/{cooperative_id}/members
Authorization: Bearer <apex-token>
```

Calls `keycloak.get_group_members(cooperative_id)` → `GET /groups/{id}/members`.
Returns `Vec<MemberResponse>`.

Both `apex` and `cooperative` roles can call this endpoint.

### Update member name

```
PATCH /api/v1/apex/cooperatives/{cooperative_id}/members/{user_id}
Authorization: Bearer <apex-token>
Content-Type: application/json

{ "first_name": "Jean-Pierre", "last_name": "Dupont" }
```

Calls `keycloak.update_user_name(user_id, first_name, last_name)` → `PUT /users/{id}` then re-fetches.
Returns `200 MemberResponse`.

### Remove member

```
DELETE /api/v1/apex/cooperatives/{cooperative_id}/members/{user_id}
Authorization: Bearer <apex-token>
```

Calls `keycloak.remove_user_from_group(user_id, group_id)` → `DELETE /users/{user_id}/groups/{group_id}`.
Returns `204 No Content`. The user still exists in Keycloak but loses group membership and role access.

### Resend verification email

```
POST /api/v1/apex/cooperatives/{cooperative_id}/members/{user_id}/resend-verification
Authorization: Bearer <apex-token>
```

Calls `keycloak.trigger_email_verification_for_user(user_id)` → `PUT /users/{id}/execute-actions-email` with `["VERIFY_EMAIL"]`.
Returns `200 { "message": "Verification email resent" }`.

---

## Cooperative Self-Service (cooperative role, read-only)

These endpoints are at `/api/v1/cooperative/*` and require `cooperative` or `apex` role.

```
GET /api/v1/cooperative/profile     → CooperativeResponse (own cooperative's Keycloak group)
GET /api/v1/cooperative/members     → Vec<MemberResponse> (all members in own cooperative)
GET /api/v1/cooperative/dimensions  → { cooperative_id, assigned_dimensions, user_id }
```

The cooperative ID is extracted from `ScopeEnforcement::get_cooperative_id(&claims)` which parses the second path segment of `cooperation[0]` in the JWT.

`assigned_dimensions` come directly from the `assigned_dimensions` JWT claim — no additional API call needed.

---

## Frontend Architecture

### Hook layer

All API calls go through TanStack Query hooks in `frontend/src/hooks/cooperatives/useCooperatives.ts`. Components never call the API directly.

| Hook | Method | Endpoint |
|---|---|---|
| `useCooperatives` | GET | `/api/v1/apex/cooperatives` |
| `useCooperative(id)` | GET | `/api/v1/apex/cooperatives/{id}` |
| `useCreateCooperative` | POST | `/api/v1/apex/cooperatives` |
| `useUpdateCooperative` | PATCH | `/api/v1/apex/cooperatives/{id}` |
| `useDeleteCooperative` | DELETE | `/api/v1/apex/cooperatives/{id}` |
| `useCooperativeMembers(id)` | GET | `/api/v1/apex/cooperatives/{id}/members` |
| `useAddCooperativeMember` | POST | `/api/v1/apex/cooperatives/{id}/members` |
| `useUpdateCooperativeMember` | PATCH | `/api/v1/apex/cooperatives/{group_id}/members/{user_id}` |
| `useRemoveCooperativeMember` | DELETE | `/api/v1/apex/cooperatives/{group_id}/members/{user_id}` |
| `useResendCooperativeMemberVerification` | POST | `…/resend-verification` |
| `useMyCooperativeProfile` | GET | `/api/v1/cooperative/profile` |
| `useMyCooperativeMembers` | GET | `/api/v1/cooperative/members` |
| `useMyAssignedDimensions` | GET | `/api/v1/cooperative/dimensions` |

### Page components (Apex role)

| Component | Route | Purpose |
|---|---|---|
| `ApexDashboard` | `/app/dashboard` (apex) | Cooperative count, profile summary |
| `CooperativesPage` | `/app/cooperatives` | Full CRUD table for cooperatives |
| `CooperativeMembersPage` | `/app/cooperative-members/:cooperativeId` | Member CRUD for a cooperative |

### Page components (Cooperative role)

| Component | Route | Purpose |
|---|---|---|
| `CooperativeDashboard` | `/app/dashboard` (cooperative) | Read-only: profile, members, dimensions |

### Role protection

Every route file wraps the page in `<ProtectedRoute allowedRoles={[...]}>`. The `ProtectedRoute` component checks `user.role` from `AuthContext` (which is resolved from the Keycloak JWT realm roles). Unauthorized users see `UnauthorizedPage`.

### Cache invalidation strategy

- After `createCooperative` → invalidates `["cooperatives"]`
- After `updateCooperative` → invalidates `["cooperatives"]` + `["cooperatives", id]`
- After `deleteCooperative` → invalidates `["cooperatives"]`
- After `addCooperativeMember` / `removeCooperativeMember` → invalidates `["cooperatives", cooperativeId, "members"]`

---

## Error Handling

| Scenario | HTTP status | Message |
|---|---|---|
| Missing or invalid JWT | 401 | `Missing or invalid authentication` |
| Wrong role | 403 | `Access denied. Required role: apex` |
| No apex group in JWT | 403 | `User is not associated with an apex group` |
| Cooperative name empty | 400 | `Cooperative name is required` |
| User already in a group | 409 | `User is already a member of another group` |
| Cooperative name already exists | 409 | `Subgroup already exists` |
| Keycloak unreachable | 500 | `ExternalServiceError: ...` |

All errors are returned as JSON: `{ "error": "...", "message": "..." }`.

---

## Security Properties

- **Scope enforcement**: The apex group ID is read exclusively from the JWT `cooperation` claim — an apex user cannot create/list cooperatives under a different apex by supplying a foreign group ID, because the handler ignores any user-supplied group ID for ownership and reads it from the token.
- **Role guard fires before handler**: `role_guard_layer` rejects non-apex requests before the handler function executes, so no handler-level bypass is possible.
- **No secrets in response**: `AppError::InternalServerError` messages are generic. Keycloak internal errors are logged server-side only.
- **Email verification enforced**: New cooperative users have `email_verified=false` and `VERIFY_EMAIL` + `UPDATE_PASSWORD` in `required_actions`. They cannot authenticate until they complete the email flow.
