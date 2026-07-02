#!/bin/bash
# Applies the coopdata login theme to the running Keycloak instance.
# Run once after starting docker compose:
#   bash keycloak/apply-theme.sh

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="coop-data"

echo "[theme] Getting admin token..."
TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=${ADMIN_USER}&password=${ADMIN_PASS}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[theme] ERROR: Could not get admin token. Is Keycloak running?"
  exit 1
fi

echo "[theme] Setting loginTheme=coopdata on realm ${REALM}..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  "${KEYCLOAK_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"loginTheme":"coopdata"}')

if [ "$STATUS" = "204" ]; then
  echo "[theme] Done — login theme set to 'coopdata'."
  echo "[theme] Reload the Keycloak login page to see the new theme."
else
  echo "[theme] ERROR: Got HTTP ${STATUS}. Check Keycloak logs."
  exit 1
fi
