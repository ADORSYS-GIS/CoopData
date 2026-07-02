# Apex & Cooperative IAM — Testing Guide

## Prerequisites

Make sure the full stack is running:

```bash
docker-compose up -d          # starts Postgres, Redis, Keycloak
cd backend && cargo run       # starts on http://localhost:3000
cd frontend && npm run dev    # starts on http://localhost:5173
```

Keycloak admin console: http://localhost:8180/admin (admin / admin)
Swagger UI: http://localhost:3000/swagger-ui/

---

## Step 0 — Understand the token you need

Each test section requires a token for a specific role. The easiest way to get one:

### Via the app UI
1. Open http://localhost:5173
2. Log in as the role you need
3. Open **Debug Auth** page (`/app/debug-auth`) and copy the access token shown

### Via curl (direct Keycloak token endpoint)
```bash
# Replace USERNAME, PASSWORD, and CLIENT_SECRET with real values from backend/.env
TOKEN=$(curl -s -X POST \
  http://localhost:8180/realms/coop-data/protocol/openid-connect/token \
  -d "grant_type=password&client_id=coopdata-frontend&username=USERNAME&password=PASSWORD" \
  | jq -r .access_token)

echo $TOKEN
```

---

## Part 1 — Backend API tests (curl)

All commands below assume `$TOKEN` is set to a valid bearer token for the correct role.

### 1.1 Apex profile

```bash
curl -s http://localhost:3000/api/v1/apex/profile \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:** `200` with `ApexResponse` — `id`, `name`, `sub_groups` array.

**Failure cases:**
- No token → `401 unauthorized`
- Token has `federation` role → `403 forbidden`

---

### 1.2 Cooperative CRUD

#### Create
```bash
curl -s -X POST http://localhost:3000/api/v1/apex/cooperatives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Cooperative","description":"A test coop"}' | jq
```

**Expected:** `201` with `CooperativeResponse` — save the `id` as `COOP_ID`.

```bash
COOP_ID="<id from response>"
```

Failure cases:
- Empty name → `400 Cooperative name is required`
- Token lacks apex role → `403`
- Duplicate name → `409 Subgroup already exists`

#### List
```bash
curl -s http://localhost:3000/api/v1/apex/cooperatives \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:** `200` array containing the cooperative you just created.

#### Get by ID
```bash
curl -s http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:** `200` with the single `CooperativeResponse`.

#### Update
```bash
curl -s -X PATCH http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed Cooperative","description":"Updated desc"}' | jq
```

**Expected:** `200` with updated `name` and `description`.

---

### 1.3 Cooperative member management

#### Add member (creates a new user)
```bash
curl -s -X POST http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testmember@example.com",
    "first_name": "Jean",
    "last_name": "Dupont",
    "role": "cooperative",
    "assigned_dimensions": ["finance", "operations"]
  }' | jq
```

**Expected:** `201` with `MemberResponse`. Save `id` as `USER_ID`.

```bash
USER_ID="<id from response>"
```

Check in Keycloak admin:
- User `testmember@example.com` exists under Users
- Has realm role `cooperative`
- Is a member of the cooperative subgroup
- `email_verified=false`, `requiredActions` includes `VERIFY_EMAIL`

Failure cases:
- `role` is not `"cooperative"` → `400 Only 'cooperative' role is allowed`
- User already in a group → `409 User is already a member of another group`

#### List members
```bash
curl -s http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:** `200` array with Jean Dupont in it.

#### Update member name
```bash
curl -s -X PATCH \
  "http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jean-Pierre","last_name":"Dupont"}' | jq
```

**Expected:** `200` with updated `first_name`.

#### Resend verification email
```bash
curl -s -X POST \
  "http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members/$USER_ID/resend-verification" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:** `200 { "message": "Verification email resent" }`.

Check your email (or Mailhog at http://localhost:8025 if configured) for the verification link.

#### Remove member
```bash
curl -s -X DELETE \
  "http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" -v
```

**Expected:** `204 No Content`.

Verify: list members again — user should be gone from the group. User still exists in Keycloak but has no group membership.

#### Delete cooperative (cleanup)
```bash
curl -s -X DELETE http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID \
  -H "Authorization: Bearer $TOKEN" -v
```

**Expected:** `204 No Content`.

---

### 1.4 Cooperative self-service endpoints

These require a token with `cooperative` role. Get one after the user completes email verification and sets their password.

```bash
COOP_TOKEN="<token for cooperative user>"
```

#### Own profile
```bash
curl -s http://localhost:3000/api/v1/cooperative/profile \
  -H "Authorization: Bearer $COOP_TOKEN" | jq
```

**Expected:** `200 CooperativeResponse` for the cooperative the user belongs to.

#### Own members
```bash
curl -s http://localhost:3000/api/v1/cooperative/members \
  -H "Authorization: Bearer $COOP_TOKEN" | jq
```

**Expected:** `200` array of members in the same cooperative.

#### Assigned dimensions
```bash
curl -s http://localhost:3000/api/v1/cooperative/dimensions \
  -H "Authorization: Bearer $COOP_TOKEN" | jq
```

**Expected:**
```json
{
  "cooperative_id": "subgroup-uuid",
  "assigned_dimensions": ["finance", "operations"],
  "user_id": "user-uuid"
}
```

---

### 1.5 RBAC enforcement checks

These should all return errors — they verify scope enforcement is working.

```bash
# Cooperative user trying to call apex endpoint (should get 403)
curl -s http://localhost:3000/api/v1/apex/cooperatives \
  -H "Authorization: Bearer $COOP_TOKEN" | jq

# Unauthenticated request (should get 401)
curl -s http://localhost:3000/api/v1/apex/cooperatives | jq

# Apex user trying to add member with wrong role (should get 400)
curl -s -X POST http://localhost:3000/api/v1/apex/cooperatives/$COOP_ID/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","first_name":"X","last_name":"X","role":"apex"}' | jq
```

---

## Part 2 — Frontend UI tests

### 2.1 Apex user flow

1. Log in as a user with the `apex` realm role.
2. Confirm redirect lands on `/app/dashboard` showing **Apex Dashboard** — cooperative count and profile summary visible.
3. Navigate to **Cooperatives** (`/app/cooperatives`).

**Create:**
- Click **Register cooperative**
- Submit with empty name → toast error "Cooperative name is required"
- Fill in a name, submit → toast success, cooperative appears in table

**Edit:**
- Click the pencil icon on a row → modal opens with pre-filled name and description
- Change name → click Save Changes → toast success, table updates

**Delete:**
- Click the trash icon → confirmation dialog appears
- Click Delete → toast success, cooperative removed from table

**Member management:**
- Click **Members** chevron button on a cooperative row
- Lands on `/app/cooperative-members/{id}`
- Click **Invite member** → form expands
- Submit with empty fields → toast error
- Fill in first name, last name, email, submit → toast "Invitation sent to..."
- New member appears in the list
- Click pencil → edit modal → save → member name updates
- Click resend (circular arrow) → toast "Verification email resent"
- Click remove (user minus) → confirmation dialog → confirm → member removed

### 2.2 Cooperative user flow

1. Complete email verification from the invite email (follow the link, set password).
2. Log in — Keycloak should redirect to the app.
3. Confirm redirect lands on `/app/dashboard` showing **Cooperative Dashboard**:
   - Cooperative name shown as page title
   - Member count, assigned dimensions, member table all populated
   - No create/edit/delete buttons visible anywhere
4. Navigate to `/app/cooperatives` — should show **UnauthorizedPage** (apex role required).

### 2.3 Role isolation check

While logged in as a `cooperative` user, try navigating directly to:
- `/app/cooperatives` → UnauthorizedPage
- `/app/cooperative-members/any-id` → UnauthorizedPage

While logged in as a `federation` user, try:
- `/app/cooperatives` → UnauthorizedPage (requires apex role)

---

## Part 3 — Keycloak admin verification

After running the above tests, open http://localhost:8180/admin and verify:

### Groups structure
- Go to **Realm settings → Groups**
- Find an Apex group (named `{org_id}-{apex_name}`)
- Expand it → child subgroups should be the cooperatives you created
- Each subgroup should have attributes: `type=cooperative`

### User verification
- Go to **Users** → find `testmember@example.com`
- Check **Groups** tab → should show the cooperative subgroup
- Check **Role mappings** tab → should have realm role `cooperative` plus client roles
- Check **Attributes** tab → `assigned_dimensions` should be set

### Token inspection
After a cooperative user logs in, copy their token and decode it at https://jwt.io:

```json
{
  "realm_access": { "roles": ["cooperative", "default-roles-coop-data"] },
  "cooperation": ["/apex-group-uuid/cooperative-subgroup-uuid"],
  "assigned_dimensions": ["finance", "operations"]
}
```

The `cooperation` path format must be `/apex-id/cooperative-id` — if the second segment is missing, `get_cooperative_id()` will return a 403.

---

## Part 4 — Common issues and fixes

### "User is not associated with an apex group"
The apex user's `cooperation` JWT claim is empty or malformed. In Keycloak:
- Go to **Clients → coopdata-frontend → Client scopes**
- Verify the `cooperation` group membership mapper is present and configured
- Ensure the apex user is actually a member of an Apex group (not just has the role)

### Cooperative created but does not appear in list
The `list_cooperatives` handler filters subgroups by `attributes.type == "cooperative"`. If the cooperative was created without the `type` attribute (e.g. via direct Keycloak API), it still appears (the filter defaults to `true`). If it is missing entirely from `sub_groups`, the Keycloak response may have `briefRepresentation=true` — verify `get_group_by_id` returns full representation.

### User gets 403 on cooperative self-service routes
The `cooperation` claim path needs two segments: `/{apex_uuid}/{cooperative_uuid}`. If the user is in the apex group directly (not a subgroup), `get_cooperative_id()` returns an error because there is no second segment. Ensure the user was added to the subgroup, not the parent group.

### Email not arriving
If using local Keycloak without an SMTP server configured, emails are silently dropped. Configure Mailhog:
- Add to `docker-compose.yml`: Mailhog container on port 8025
- In Keycloak realm email settings: SMTP host `mailhog`, port `1025`
- Open http://localhost:8025 to see all sent emails

### "Subgroup already exists" on create
Keycloak enforces unique group names within a parent. Pick a different name or delete the existing subgroup first via the Keycloak admin console.
