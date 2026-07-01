#!/bin/bash
# Disables the "Organization" identity-first flow step so users go directly
# to the username+password form (no two-step login).
# Run: bash keycloak/fix-login-flow.sh

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-change-me-in-production}"
REALM="coop-data"

echo "[flow] Getting admin token..."
TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=${ADMIN_USER}&password=${ADMIN_PASS}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[flow] ERROR: Could not get admin token."
  exit 1
fi

echo "[flow] Finding browser flow ID..."
FLOW_ID=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/flows" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "import sys,json; flows=json.load(sys.stdin); print(next(f['id'] for f in flows if f['alias']=='browser'))" 2>/dev/null)

if [ -z "$FLOW_ID" ]; then
  echo "[flow] ERROR: Could not find browser flow."
  exit 1
fi

echo "[flow] Browser flow ID: ${FLOW_ID}"
echo "[flow] Finding Organization execution..."

EXEC_ID=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/flows/${FLOW_ID}/executions" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import sys,json
execs=json.load(sys.stdin)
for e in execs:
    if e.get('displayName','').lower().find('organization') >= 0 or e.get('alias','').lower().find('organization') >= 0 or e.get('flowAlias','').lower().find('organization') >= 0:
        print(e['id'])
        break
" 2>/dev/null)

if [ -z "$EXEC_ID" ]; then
  echo "[flow] Organization execution not found — may already be disabled."
else
  echo "[flow] Disabling Organization execution ${EXEC_ID}..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/flows/${FLOW_ID}/executions" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"${EXEC_ID}\",\"requirement\":\"DISABLED\"}")
  
  if [ "$STATUS" = "202" ] || [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    echo "[flow] Done — Organization flow disabled."
  else
    echo "[flow] WARNING: Got HTTP ${STATUS}"
  fi
fi

echo "[flow] Also setting loginTheme=coopdata..."
curl -s -o /dev/null -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"loginTheme":"coopdata"}'

echo "[flow] Complete. Users will now see the combined username+password form directly."
