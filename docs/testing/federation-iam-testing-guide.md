# Federation IAM — Daily Testing Guide

## Prerequisites

1. Keycloak running with realm `coopdata` (see `docker-compose.yml` + `keycloak-startup.sh`)
2. PostgreSQL running with migrations applied
3. Backend running on `http://localhost:3000`
4. Frontend running on `http://localhost:5173`
5. A **ministry** user already exists (created by provisioning: `360@dgrv.coop`)
6. A **federation** user has been invited and has logged in at least once

## Test Scenario: Federation Admin Creates Apex and Manages Users

### Step 1: Create a Federation (Ministry role)

1. Login as ministry user (`360@dgrv.coop`)
2. Navigate to **Federations** page (`/app/federations`)
3. Click **"Register Federation"**
4. Fill in:
   - Name: `Test Federation`
   - Domains: `testfed.org`
   - Description: `A test federation`
5. Click **Register**
6. Verify: Federation appears in the list with name "Test Federation"

### Step 2: Invite a Federation Admin

1. On the same Federations page, click **"Invite User"** on the newly created federation
2. Fill in:
   - Email: `fed-admin@testfed.org`
   - First Name: `Fed`
   - Last Name: `Admin`
   - Role: `federation`
   - Redirect URL: `http://localhost:5173/auth/login`
3. Click **Send Invitation**
4. Verify: Toast notification confirms invitation sent

### Step 3: Accept Invitation and Login as Federation Admin

1. Check the email for `fed-admin@testfed.org` (or use Keycloak admin console to set a password)
2. Open `http://localhost:5173/auth/login`
3. Login with `fed-admin@testfed.org` credentials
4. Verify: Redirected to `/app/dashboard`
5. Verify: Dashboard shows Federation-specific view
6. Verify: Sidebar shows "Apexes" and "Federation Profile" links

### Step 4: View Federation Profile

1. Click **"Federation Profile"** in the sidebar (under System section)
2. Verify: Profile page shows federation name "Test Federation"
3. Verify: Description and domains are displayed
4. Edit the description to "Updated test federation"
5. Click **Save Changes**
6. Verify: Toast notification confirms update

### Step 5: Change Password

1. On the same Profile page, scroll to "Change Password" card
2. Fill in:
   - Current Password: (the temporary password set during invitation)
   - New Password: `NewSecurePass123!`
   - Confirm New Password: `NewSecurePass123!`
3. Click **"Update Password"**
4. Verify: Toast notification confirms password change
5. **Logout** and log back in with the new password
6. Verify: Login succeeds

### Step 6: Create an Apex

1. Navigate to **Apexes** page (`/app/apexes`)
2. Click **"Register Apex"**
3. Fill in:
   - Apex Name: `Manzini Agricultural Apex`
   - Description: `Agricultural cooperative oversight body`
4. Click **Register Apex**
5. Verify: Apex appears in the list
6. Verify: Stats update (Total Apexes count increments)

### Step 7: Edit an Apex

1. Click the **edit (pencil)** icon on the newly created apex
2. Change the description to: `Regional agricultural cooperative oversight`
3. Click **Save Changes**
4. Verify: Toast confirms update, description updated in table

### Step 8: Add a Member to the Apex

1. Click the **members (users)** icon on the apex row
2. Click **"Add Member"**
3. Fill in:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john.doe@testfed.org`
   - Role: `Apex Admin` (or `apex`)
4. Click **Add Member**
5. Verify: Toast confirms member added
6. Verify: Member appears in the member list

### Step 9: Remove a Member from the Apex

1. Click **"Remove"** on the member row
2. Verify: Confirmation appears (the member row shows a loading spinner)
3. Verify: Toast confirms removal
4. Verify: Member disappears from the list

### Step 10: Delete an Apex

1. Click the **delete (trash)** icon on the apex row
2. Verify: Confirmation dialog appears with apex name
3. Click **Delete**
4. Verify: Toast confirms deletion
5. Verify: Apex disappears from the table

### Step 11: Verify Scope Enforcement

1. Login as a **different** federation admin (from a different federation)
2. Navigate to **Apexes**
3. Verify: The list shows ONLY apexes belonging to THIS federation
4. Try to access another federation's apex directly via API:
   ```bash
   curl -H "Authorization: Bearer <other-fed-token>" \
     http://localhost:3000/api/v1/federation/apexes/<other-fed-apex-id>
   ```
5. Verify: Returns 403 Forbidden with message "apex does not belong to your federation"

### Step 12: Verify Role-Based Access

1. Login as a **cooperative** user
2. Try to access `/app/apexes`
3. Verify: Redirected to `/unauthorized` (cooperative role cannot access federation pages)
4. Try API call:
   ```bash
   curl -H "Authorization: Bearer <cooperative-token>" \
     http://localhost:3000/api/v1/federation/apexes
   ```
5. Verify: Returns 403 Forbidden — role guard rejects at middleware level

### Step 13: Verify Federation Stats

1. Login as federation admin
2. Call the stats API:
   ```bash
   curl -H "Authorization: Bearer <federation-token>" \
     http://localhost:3000/api/v1/federation/stats
   ```
3. Verify: Returns JSON with `total_apexes`, `total_members`, and `federation` profile data
4. Create 2 apexes, add 3 members total
5. Call stats API again
6. Verify: `total_apexes` = 2, `total_members` = 3

## API Testing with curl

### Get a Federation Token

```bash
# Login as ministry user
TOKEN=$(curl -s -X POST http://localhost:8080/keycloak/realms/coopdata/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=coopdata-frontend&username=360@dgrv.coop&password=<password>" | jq -r '.access_token')
```

### Create Federation (Ministry)

```bash
curl -X POST http://localhost:3000/api/v1/ministry/federations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Federation", "domains": [{"name": "myfed.org"}], "description": "Test federation"}'
```

### Get Federation Profile (Federation)

```bash
curl http://localhost:3000/api/v1/federation/profile \
  -H "Authorization: Bearer $FEDERATION_TOKEN"
```

### Update Federation Profile (Federation)

```bash
curl -X PATCH http://localhost:3000/api/v1/federation/profile \
  -H "Authorization: Bearer $FEDERATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

### Get Federation Stats (Federation)

```bash
curl http://localhost:3000/api/v1/federation/stats \
  -H "Authorization: Bearer $FEDERATION_TOKEN"
```

### Change Password (Any authenticated user)

```bash
curl -X POST http://localhost:3000/api/v1/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password": "old_password", "new_password": "new_secure_password_123"}'
```

### Create Apex (Federation)

```bash
curl -X POST http://localhost:3000/api/v1/federation/apexes \
  -H "Authorization: Bearer $FEDERATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Apex", "description": "Test apex body"}'
```

### List Apexes (Federation)

```bash
curl http://localhost:3000/api/v1/federation/apexes \
  -H "Authorization: Bearer $FEDERATION_TOKEN"
```

### Add Member to Apex (Federation)

```bash
curl -X POST http://localhost:3000/api/v1/federation/apexes/<apex-id>/members \
  -H "Authorization: Bearer $FEDERATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "first_name": "Jane", "last_name": "Smith", "role": "apex"}'
```

## Common Issues & Debugging

### 403 Forbidden on Federation Endpoints
- **Cause**: JWT doesn't have `federation` realm role
- **Fix**: In Keycloak admin console, assign the `federation` role to the user and add them to the federation's organization

### 403 "No organization associated"
- **Cause**: JWT missing `organization_id` claim
- **Fix**: User must be a member of the Keycloak organization. Check `is_member_of` claim in token.

### Apex creation fails with "Failed to create apex group"
- **Cause**: Keycloak admin client can't create groups
- **Fix**: Verify `coopdata-admin-client` has `realm-admin` role in `realm-management` client

### Member addition fails with "User already in another group"
- **Cause**: The user already belongs to a Keycloak group
- **Fix**: This is by design (exclusivity check). Remove the user from their existing group first.

### Password change fails with "Failed to update password"
- **Cause**: Keycloak admin API unavailable or token expired
- **Fix**: Check backend logs for the exact Keycloak error. Verify `COOPDATA_KEYCLOAK_CLIENT_SECRET` env var is correct.