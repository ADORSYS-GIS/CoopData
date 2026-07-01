#!/bin/bash
set -euo pipefail

# ===========================================
# CoopData Keycloak Super Admin Provisioning
# ===========================================
# Creates the super admin user and assigns the ministry role
# plus realm-management client roles for full admin access.
#
# Usage:
#   docker compose up -d   (runs automatically via keycloak-provision service)
#   OR manually:
#   ./keycloak/provision.sh
# ===========================================

KEYCLOAK_BIN_DIR="${KEYCLOAK_BIN_DIR:-/opt/keycloak/bin}"
KEYCLOAK_SERVER="${KEYCLOAK_SERVER:-http://keycloak:8180}"
REALM="coop-data"

ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

SUPER_ADMIN_EMAIL="${COOPDATA_SUPER_ADMIN_EMAIL:-admin@dgrv.coop}"
SUPER_ADMIN_FIRSTNAME="${COOPDATA_SUPER_ADMIN_FIRSTNAME:-Super}"
SUPER_ADMIN_LASTNAME="${COOPDATA_SUPER_ADMIN_LASTNAME:-Admin}"
SUPER_ADMIN_PASSWORD="${COOPDATA_SUPER_ADMIN_PASSWORD:-Admin@2026}"

MARKER_DIR="/tmp/coopdata-provision"

echo "[provision] CoopData Keycloak Provisioning"
echo "[provision] Server: ${KEYCLOAK_SERVER}  Realm: ${REALM}"
echo "[provision] User:   ${SUPER_ADMIN_EMAIL}"

cd "${KEYCLOAK_BIN_DIR}"

# --- 1. Wait for Keycloak & login ---
echo "[provision] Waiting for Keycloak..."
login_ok=false
for i in $(seq 1 120); do
  if ./kcadm.sh config credentials \
    --server "${KEYCLOAK_SERVER}" \
    --realm master \
    --user "${ADMIN_USER}" \
    --password "${ADMIN_PASS}" 2>/dev/null; then
    login_ok=true
    break
  fi
  echo "[provision] Waiting... ($i/120)"
  sleep 2
done

if [ "$login_ok" != true ]; then
  echo "[provision] ERROR: Could not authenticate with Keycloak"
  exit 1
fi
echo "[provision] Authenticated"

mkdir -p "${MARKER_DIR}"

# --- 2. Create super admin user ---
USER_MARKER="${MARKER_DIR}/.user_created"
if [ ! -f "${USER_MARKER}" ]; then
  echo "[provision] Creating user: ${SUPER_ADMIN_EMAIL}"
  ./kcadm.sh create users \
    -r "${REALM}" \
    -s "username=${SUPER_ADMIN_EMAIL}" \
    -s "email=${SUPER_ADMIN_EMAIL}" \
    -s "enabled=true" \
    -s "emailVerified=true" \
    -s "firstName=${SUPER_ADMIN_FIRSTNAME}" \
    -s "lastName=${SUPER_ADMIN_LASTNAME}" \
    --server "${KEYCLOAK_SERVER}"

  echo "[provision] Setting password (permanent)"
  ./kcadm.sh set-password \
    -r "${REALM}" \
    --username "${SUPER_ADMIN_EMAIL}" \
    --new-password "${SUPER_ADMIN_PASSWORD}" \
    --temporary false \
    --server "${KEYCLOAK_SERVER}"

  touch "${USER_MARKER}"
else
  echo "[provision] User already exists, skipping creation"
fi

# --- 3. Assign ministry realm role ---
ROLES_MARKER="${MARKER_DIR}/.realm_roles_assigned"
if [ ! -f "${ROLES_MARKER}" ]; then
  echo "[provision] Assigning ministry realm role"
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --uusername "${SUPER_ADMIN_EMAIL}" \
    --rolename ministry \
    --server "${KEYCLOAK_SERVER}"

  touch "${ROLES_MARKER}"
else
  echo "[provision] Realm roles already assigned, skipping"
fi

# --- 4. Assign realm-management client roles (full admin) ---
MGMT_MARKER="${MARKER_DIR}/.mgmt_roles_assigned"
if [ ! -f "${MGMT_MARKER}" ]; then
  echo "[provision] Assigning realm-admin (composite of all realm-management roles)"
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --uusername "${SUPER_ADMIN_EMAIL}" \
    --cclientid realm-management \
    --rolename realm-admin \
    --server "${KEYCLOAK_SERVER}"

  touch "${MGMT_MARKER}"
else
  echo "[provision] Realm-management roles already assigned, skipping"
fi

# --- 5. Grant coopdata-backend service account admin group permissions ---
SA_MARKER="${MARKER_DIR}/.service_account_roles_assigned"
if [ ! -f "${SA_MARKER}" ]; then
  echo "[provision] Granting coopdata-backend service account realm-management roles..."
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --uusername "service-account-coopdata-backend" \
    --cclientid realm-management \
    --rolename view-users \
    --rolename manage-users \
    --rolename query-groups \
    --rolename view-groups \
    --rolename manage-groups \
    --rolename query-users \
    --server "${KEYCLOAK_SERVER}"

  touch "${SA_MARKER}"
else
  echo "[provision] Service account roles already assigned, skipping"
fi

# --- 6. Set custom login theme ---
THEME_MARKER="${MARKER_DIR}/.theme_set"
if [ ! -f "${THEME_MARKER}" ]; then
  echo "[provision] Setting login theme to 'coopdata'..."
  ./kcadm.sh update "realms/${REALM}" \
    -s "loginTheme=coopdata" \
    --server "${KEYCLOAK_SERVER}" && touch "${THEME_MARKER}" || echo "[provision] WARN: Could not set theme (may need manual restart)"
else
  echo "[provision] Theme already set, skipping"
fi

echo "[provision] ========================================"
echo "[provision] Done! Super admin ready:"
echo "[provision]   Email:    ${SUPER_ADMIN_EMAIL}"
echo "[provision]   Password: ${SUPER_ADMIN_PASSWORD}"
echo "[provision]   Realm:    ${REALM}"
echo "[provision] ========================================"