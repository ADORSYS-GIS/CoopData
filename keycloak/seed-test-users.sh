#!/bin/bash
set -uo pipefail

# ===========================================
# CoopData Keycloak Test Realm Seed Script
# ===========================================
# Creates test users for all 4 RBAC roles:
#   1. Ministry user      (ministry@test.coopdata)
#   2. Federation user    (federation@test.coopdata)
#   3. Apex user          (apex@test.coopdata)
#   4. Cooperative user   (cooperative@test.coopdata)
#
# Safe to re-run: checks user existence before creating.
#
# Usage:
#   ./keycloak/seed-test-users.sh
#
# Requires: Keycloak running on localhost:8180 with admin credentials.
# ===========================================

KEYCLOAK_BIN_DIR="${KEYCLOAK_BIN_DIR:-/opt/keycloak/bin}"
KEYCLOAK_SERVER="${KEYCLOAK_SERVER:-http://localhost:8180}"
REALM="coop-data"

ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

TEST_PASSWORD="${COOPDATA_TEST_USER_PASSWORD:-Test@Password2026!}"

cd "${KEYCLOAK_BIN_DIR}"

echo "[seed] Waiting for Keycloak at ${KEYCLOAK_SERVER}..."
AUTH_OK=false
for i in $(seq 1 120); do
  if ./kcadm.sh config credentials \
    --server "${KEYCLOAK_SERVER}" \
    --realm master \
    --user "${ADMIN_USER}" \
    --password "${ADMIN_PASS}" 2>/dev/null; then
    echo "[seed] Authenticated"
    AUTH_OK=true
    break
  fi
  echo "[seed] Waiting... ($i/120)"
  sleep 2
done

if [ "${AUTH_OK}" != "true" ]; then
  echo "[seed] ERROR: Could not authenticate to Keycloak"
  exit 1
fi

extract_user_id() {
  echo "$1" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"//;s/"//'
}

provision_test_user() {
  local email="$1" firstname="$2" lastname="$3" rolename="$4"

  echo ""
  echo "[seed] === Provisioning: ${email} (role: ${rolename}) ==="

  local existing
  existing=$(./kcadm.sh get users \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    -q "email=${email}" 2>/dev/null || echo "")

  local user_id=""

  if echo "${existing}" | grep -q "${email}"; then
    user_id=$(extract_user_id "${existing}")
    echo "[seed] User exists (id=${user_id}), updating credentials and roles"
  else
    echo "[seed] Creating user: ${email}"
    ./kcadm.sh create users \
      -r "${REALM}" \
      --server "${KEYCLOAK_SERVER}" \
      -s "username=${email}" \
      -s "email=${email}" \
      -s "enabled=true" \
      -s "emailVerified=true" \
      -s "firstName=${firstname}" \
      -s "lastName=${lastname}" 2>&1

    local created
    created=$(./kcadm.sh get users \
      -r "${REALM}" \
      --server "${KEYCLOAK_SERVER}" \
      -q "email=${email}" 2>/dev/null || echo "")
    user_id=$(extract_user_id "${created}")
    echo "[seed] Created user id=${user_id}"
  fi

  if [ -z "${user_id}" ]; then
    echo "[seed] ERROR: Could not get user ID for ${email}"
    return 1
  fi

  echo "[seed] Setting password for ${email}"
  ./kcadm.sh set-password \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --userid "${user_id}" \
    --new-password "${TEST_PASSWORD}" 2>&1

  echo "[seed] Assigning ${rolename} realm role"
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --uid "${user_id}" \
    --rolename "${rolename}" 2>&1 || echo "[seed] Note: ${rolename} role may already be assigned"

  echo "[seed] Done: ${email}"
}

provision_test_user "ministry@test.coopdata"      "Ministry"      "Tester"      "ministry"
provision_test_user "federation@test.coopdata"    "Federation"    "Tester"      "federation"
provision_test_user "apex@test.coopdata"          "Apex"          "Tester"      "apex"
provision_test_user "cooperative@test.coopdata"    "Cooperative"   "Tester"      "cooperative"

echo ""
echo "[seed] ========================================"
echo "[seed] Test user provisioning complete!"
echo "[seed]"
echo "[seed]   Ministry user"
echo "[seed]     Email:    ministry@test.coopdata"
echo "[seed]     Password: ${TEST_PASSWORD}"
echo "[seed]     Role:    ministry"
echo "[seed]"
echo "[seed]   Federation user"
echo "[seed]     Email:    federation@test.coopdata"
echo "[seed]     Password: ${TEST_PASSWORD}"
echo "[seed]     Role:    federation"
echo "[seed]"
echo "[seed]   Apex user"
echo "[seed]     Email:    apex@test.coopdata"
echo "[seed]     Password: ${TEST_PASSWORD}"
echo "[seed]     Role:    apex"
echo "[seed]"
echo "[seed]   Cooperative user"
echo "[seed]     Email:    cooperative@test.coopdata"
echo "[seed]     Password: ${TEST_PASSWORD}"
echo "[seed]     Role:    cooperative"
echo "[seed] ========================================"