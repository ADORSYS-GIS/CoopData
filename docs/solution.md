# Pending Invitation Tracking

## The Problem

Keycloak has no native API to list pending (unaccepted) invitations. When you call the `invite-user` endpoint, Keycloak sends an email and that is it — there is no endpoint to query who has not accepted yet.

## The Solution

We use a single Keycloak user attribute as a tracking breadcrumb.

### The Attribute: `org.ro.active`

This attribute is already defined in the Keycloak User Profile schema for the `sustainability-realm`. When a user is invited, the backend sets this attribute on their Keycloak user profile to the ID of the organisation they were invited to.

This is the only piece of information we store to track the invitation. Everything else (email verification status, org membership) is read directly from Keycloak at query time.

## How Invitation Works

When an admin invites a user (either DGRV admin or org admin), the backend:

1. Creates the user in Keycloak via `POST /admin/realms/{realm}/users` with the `org.ro.active` attribute set to the org ID.
2. Triggers the email verification action via `POST /admin/realms/{realm}/users/{id}/execute-actions-email` with `["VERIFY_EMAIL"]`.
3. Sends the org invitation email via `POST /admin/realms/{realm}/organizations/{org}/members/invite-user`.

## How Pending Detection Works

The frontend calls `GET /api/admin/organizations/{org_id}/pending-invitations`.

The backend then makes two calls to Keycloak:

**Call 1 — Find invited users:**
```
GET /admin/realms/{realm}/users?q=org.ro.active:{org_id}&briefRepresentation=false&max=1000
```
Keycloak's `q` parameter supports attribute search in the format `key:value`. This returns all users who have this org ID stored in their `org.ro.active` attribute — meaning everyone who was ever invited to this org.

**Call 2 — Find active members:**
```
GET /admin/realms/{realm}/organizations/{org_id}/members
```
This returns users who have already accepted their invitation and are active members of the org.

**The logic:**
```
pending = (users with org.ro.active = org_id) MINUS (active members)
```

The backend builds a set of active member IDs and filters them out of the attribute-tagged users. What remains are the users who were invited but have not accepted yet.

For each pending user, the status is derived from Keycloak's own `emailVerified` field:
- `emailVerified = false` → the user has not yet clicked the verification link
- `emailVerified = true` → the user verified their email but has not accepted the org invitation

## How Resend Works

The frontend calls `POST /api/admin/organizations/{org_id}/users/{user_id}/resend-invitation`.

The backend:
1. Fetches the user to get their email address.
2. Re-triggers the email verification action (in case they lost the first email).
3. Re-calls `invite-user` with just the email — no role reassignment, no category reassignment, nothing else. Just the two emails.

## State Transitions

A user moves through these states:

**Invited** — `org.ro.active` is set, `emailVerified = false`, not an org member. Shows as pending with "Awaiting email verification".

**Email verified** — `org.ro.active` is set, `emailVerified = true`, not an org member. Shows as pending with "Email verified".

**Active** — User appears in the org members list. Disappears from pending, appears in the active members grid.

## Important Notes

- The attribute name must be exactly `org.ro.active` — this is the name registered in Keycloak's User Profile schema. Any other name is silently ignored by Keycloak.
- Attribute values must be arrays: `["org-uuid"]` not `"org-uuid"`. Keycloak requires this format.
- The `q` search does a value-level scan through the attribute array, so array-stored values are searchable.
- This works for both DGRV admin invitations (`POST /api/admin/user-invitations`) and org admin invitations (`POST /api/organizations/{org}/org-admin/members`) because both set the same `org.ro.active` attribute.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/organizations/{org_id}/pending-invitations` | List pending invitees for an org |
| POST | `/api/admin/organizations/{org_id}/users/{user_id}/resend-invitation` | Resend emails to a pending user |
| DELETE | `/api/admin/users/{user_id}` | Delete a pending user entirely from Keycloak |

## Permissions

- DGRV admin (`application_admin` role): can access all orgs
- Org admin (`org_admin` role): can access only their own org (checked against their JWT `organizations` claim)
- Delete is restricted to DGRV admin only — deleting a user removes them from the entire system, not just the org