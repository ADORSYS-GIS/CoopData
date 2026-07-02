#!/bin/bash
set -euo pipefail

# ===========================================
# CoopData Keycloak Admin Provisioning
# ===========================================
# Creates two admin users:
#   1. DGRV Admin  — platform super-admin (manages everything)
#   2. Ministry Admin — national oversight user
# Both receive:
#   - ministry realm role
#   - realm-admin client role (full realm-management access)
#   - account view-groups client role
# ===========================================

KEYCLOAK_BIN_DIR="${KEYCLOAK_BIN_DIR:-/opt/keycloak/bin}"
KEYCLOAK_SERVER="${KEYCLOAK_SERVER:-http://keycloak:8180}"
REALM="coop-data"

ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

# DGRV Super Admin
DGRV_EMAIL="${COOPDATA_DGRV_ADMIN_EMAIL:-admin@dgrv.coop}"
DGRV_FIRSTNAME="${COOPDATA_DGRV_ADMIN_FIRSTNAME:-DGRV}"
DGRV_LASTNAME="${COOPDATA_DGRV_ADMIN_LASTNAME:-Administrator}"
DGRV_PASSWORD="${COOPDATA_DGRV_ADMIN_PASSWORD:-Dgrv@Admin2026!}"

# Ministry Admin
MINISTRY_EMAIL="${COOPDATA_MINISTRY_ADMIN_EMAIL:-admin@ministry.gov}"
MINISTRY_FIRSTNAME="${COOPDATA_MINISTRY_ADMIN_FIRSTNAME:-Ministry}"
MINISTRY_LASTNAME="${COOPDATA_MINISTRY_ADMIN_LASTNAME:-Administrator}"
MINISTRY_PASSWORD="${COOPDATA_MINISTRY_ADMIN_PASSWORD:-Ministry@Admin2026!}"

MARKER_DIR="/tmp/coopdata-provision"
mkdir -p "${MARKER_DIR}"

echo "[provision] CoopData Keycloak Provisioning"
echo "[provision] Server: ${KEYCLOAK_SERVER}  Realm: ${REALM}"

cd "${KEYCLOAK_BIN_DIR}"

# ─── 1. Wait for Keycloak and authenticate ────────────────────────────────────
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
echo "[provision] Authenticated with Keycloak master realm"

# ─── Helper: create user + assign roles ──────────────────────────────────────
provision_admin_user() {
  local email="$1"
  local firstname="$2"
  local lastname="$3"
  local password="$4"
  local marker_prefix="$5"

  local user_marker="${MARKER_DIR}/.${marker_prefix}_user"
  local roles_marker="${MARKER_DIR}/.${marker_prefix}_roles"
  local mgmt_marker="${MARKER_DIR}/.${marker_prefix}_mgmt"

  # Create user
  if [ ! -f "${user_marker}" ]; then
    echo "[provision] Creating user: ${email}"
    ./kcadm.sh create users \
      -r "${REALM}" \
      -s "username=${email}" \
      -s "email=${email}" \
      -s "enabled=true" \
      -s "emailVerified=true" \
      -s "firstName=${firstname}" \
      -s "lastName=${lastname}" \
      --server "${KEYCLOAK_SERVER}"

    echo "[provision] Setting password for ${email}"
    ./kcadm.sh set-password \
      -r "${REALM}" \
      --username "${email}" \
      --new-password "${password}" \
      --temporary false \
      --server "${KEYCLOAK_SERVER}"

    touch "${user_marker}"
    echo "[provision] User ${email} created"
  else
    echo "[provision] User ${email} already exists, skipping creation"
  fi

  # Assign ministry realm role
  if [ ! -f "${roles_marker}" ]; then
    echo "[provision] Assigning ministry realm role to ${email}"
    ./kcadm.sh add-roles \
      -r "${REALM}" \
      --uusername "${email}" \
      --rolename ministry \
      --server "${KEYCLOAK_SERVER}"
    touch "${roles_marker}"
  else
    echo "[provision] Realm role already assigned for ${email}, skipping"
  fi

  # Assign realm-management realm-admin (composite — covers all admin permissions)
  if [ ! -f "${mgmt_marker}" ]; then
    echo "[provision] Assigning realm-admin client role to ${email}"
    ./kcadm.sh add-roles \
      -r "${REALM}" \
      --uusername "${email}" \
      --cclientid realm-management \
      --rolename realm-admin \
      --server "${KEYCLOAK_SERVER}"

    # Also assign account view-groups so the user can see group membership
    ./kcadm.sh add-roles \
      -r "${REALM}" \
      --uusername "${email}" \
      --cclientid account \
      --rolename view-groups \
      --server "${KEYCLOAK_SERVER}" 2>/dev/null || true

    touch "${mgmt_marker}"
    echo "[provision] Client roles assigned for ${email}"
  else
    echo "[provision] Client roles already assigned for ${email}, skipping"
  fi
}

# ─── 2. Provision DGRV admin ─────────────────────────────────────────────────
provision_admin_user \
  "${DGRV_EMAIL}" \
  "${DGRV_FIRSTNAME}" \
  "${DGRV_LASTNAME}" \
  "${DGRV_PASSWORD}" \
  "dgrv"

# ─── 3. Provision Ministry admin ─────────────────────────────────────────────
provision_admin_user \
  "${MINISTRY_EMAIL}" \
  "${MINISTRY_FIRSTNAME}" \
  "${MINISTRY_LASTNAME}" \
  "${MINISTRY_PASSWORD}" \
  "ministry"

# ─── 4. Grant coopdata-backend service account realm-management roles ─────────
SA_MARKER="${MARKER_DIR}/.service_account_roles"
if [ ! -f "${SA_MARKER}" ]; then
  echo "[provision] Granting coopdata-backend service account admin roles..."
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
  echo "[provision] Service account roles granted"
else
  echo "[provision] Service account roles already assigned, skipping"
fi

# ─── 5. Set login theme ───────────────────────────────────────────────────────
THEME_MARKER="${MARKER_DIR}/.theme_set"
if [ ! -f "${THEME_MARKER}" ]; then
  echo "[provision] Setting login theme to 'coopdata'..."
  ./kcadm.sh update "realms/${REALM}" \
    -s "loginTheme=coopdata" \
    --server "${KEYCLOAK_SERVER}" && touch "${THEME_MARKER}" \
    || echo "[provision] WARN: Could not set theme"
else
  echo "[provision] Theme already set, skipping"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "[provision] =================================================="
echo "[provision] Provisioning complete. Admin accounts ready:"
echo "[provision]"
echo "[provision]   DGRV Super Admin"
echo "[provision]     Email:    ${DGRV_EMAIL}"
echo "[provision]     Password: ${DGRV_PASSWORD}"
echo "[provision]     Role:     ministry + realm-admin"
echo "[provision]"
echo "[provision]   Ministry Admin"
echo "[provision]     Email:    ${MINISTRY_EMAIL}"
echo "[provision]     Password: ${MINISTRY_PASSWORD}"
echo "[provision]     Role:     ministry + realm-admin"
echo "[provision]"
echo "[provision]   Realm: ${REALM}"
echo "[provision] =================================================="
