#!/bin/bash
set -uo pipefail

# ===========================================
# CoopData Keycloak Admin Provisioning
# ===========================================
# Creates two admin users:
#   1. DGRV Admin   (admin@dgrv.coop)       — ministry + realm-admin
#   2. Ministry Admin (admin@ministry.gov)  — ministry + realm-admin
#
# Safe to re-run: uses kcadm get-users to check existence.
# ===========================================

KEYCLOAK_BIN_DIR="${KEYCLOAK_BIN_DIR:-/opt/keycloak/bin}"
KEYCLOAK_SERVER="${KEYCLOAK_SERVER:-http://keycloak:8180}"
REALM="coop-data"

ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

DGRV_EMAIL="${COOPDATA_DGRV_ADMIN_EMAIL:-admin@dgrv.coop}"
DGRV_FIRSTNAME="${COOPDATA_DGRV_ADMIN_FIRSTNAME:-DGRV}"
DGRV_LASTNAME="${COOPDATA_DGRV_ADMIN_LASTNAME:-Administrator}"
DGRV_PASSWORD="${COOPDATA_DGRV_ADMIN_PASSWORD:-Dgrv@Admin2026!}"

MINISTRY_EMAIL="${COOPDATA_MINISTRY_ADMIN_EMAIL:-admin@ministry.gov}"
MINISTRY_FIRSTNAME="${COOPDATA_MINISTRY_ADMIN_FIRSTNAME:-Ministry}"
MINISTRY_LASTNAME="${COOPDATA_MINISTRY_ADMIN_LASTNAME:-Administrator}"
MINISTRY_PASSWORD="${COOPDATA_MINISTRY_ADMIN_PASSWORD:-Ministry@Admin2026!}"

cd "${KEYCLOAK_BIN_DIR}"

echo "[provision] Waiting for Keycloak at ${KEYCLOAK_SERVER}..."
AUTH_OK=false
for i in $(seq 1 120); do
  if ./kcadm.sh config credentials \
    --server "${KEYCLOAK_SERVER}" \
    --realm master \
    --user "${ADMIN_USER}" \
    --password "${ADMIN_PASS}" 2>/dev/null; then
    echo "[provision] Authenticated"
    AUTH_OK=true
    break
  fi
  echo "[provision] Waiting... ($i/120)"
  sleep 2
done

if [ "${AUTH_OK}" != "true" ]; then
  echo "[provision] ERROR: Could not authenticate to Keycloak"
  exit 1
fi

# ─── Helper: extract user ID from kcadm get JSON ─────────────────────────────
# Handles both compact ("id":"value") and pretty ("id" : "value") JSON formats
extract_user_id() {
  echo "$1" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"//;s/"//'
}

# ─── Helper: idempotent user provisioning ────────────────────────────────────
provision_admin() {
  local email="$1" firstname="$2" lastname="$3" password="$4"

  echo ""
  echo "[provision] === Provisioning: ${email} ==="

  # Check if user already exists
  local existing
  existing=$(./kcadm.sh get users \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    -q "email=${email}" 2>/dev/null || echo "")

  local user_id=""

  if echo "${existing}" | grep -q "${email}"; then
    user_id=$(extract_user_id "${existing}")
    echo "[provision] User exists (id=${user_id}), updating credentials and roles"
  else
    echo "[provision] Creating user: ${email}"
    ./kcadm.sh create users \
      -r "${REALM}" \
      --server "${KEYCLOAK_SERVER}" \
      -s "username=${email}" \
      -s "email=${email}" \
      -s "enabled=true" \
      -s "emailVerified=true" \
      -s "firstName=${firstname}" \
      -s "lastName=${lastname}" 2>&1

    # Re-fetch the ID after creation
    local created
    created=$(./kcadm.sh get users \
      -r "${REALM}" \
      --server "${KEYCLOAK_SERVER}" \
      -q "email=${email}" 2>/dev/null || echo "")
    user_id=$(extract_user_id "${created}")
    echo "[provision] Created user id=${user_id}"
  fi

  if [ -z "${user_id}" ]; then
    echo "[provision] ERROR: Could not get user ID for ${email}"
    return 1
  fi

  # Set password (always, to ensure it's correct)
  # --temporary is a boolean flag: omit it for a permanent (non-temporary) password
  echo "[provision] Setting password for ${email}"
  ./kcadm.sh set-password \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --userid "${user_id}" \
    --new-password "${password}" 2>&1
  echo "[provision] Password set"

  # Assign ministry realm role (idempotent)
  echo "[provision] Assigning ministry realm role"
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --uid "${user_id}" \
    --rolename ministry 2>&1 || echo "[provision] Note: ministry role may already be assigned"

  # Assign realm-management client roles (full admin access)
  echo "[provision] Assigning realm-management client roles"
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --uid "${user_id}" \
    --cclientid realm-management \
    --rolename realm-admin 2>&1 || echo "[provision] Note: realm-admin may already be assigned"

  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --uid "${user_id}" \
    --cclientid realm-management \
    --rolename manage-users \
    --rolename view-users \
    --rolename query-users \
    --rolename manage-groups \
    --rolename view-groups \
    --rolename query-groups \
    --rolename view-realm \
    --rolename query-clients \
    --rolename view-clients 2>&1 || echo "[provision] Note: realm-management roles may already be assigned"

  # Grant account view-groups
  ./kcadm.sh add-roles \
    -r "${REALM}" \
    --server "${KEYCLOAK_SERVER}" \
    --uid "${user_id}" \
    --cclientid account \
    --rolename view-groups 2>&1 || echo "[provision] Note: view-groups may already be assigned"

  echo "[provision] Done: ${email}"
}
# ─── Provision both admin users ──────────────────────────────────────────────
provision_admin "${DGRV_EMAIL}"     "${DGRV_FIRSTNAME}"     "${DGRV_LASTNAME}"     "${DGRV_PASSWORD}"
provision_admin "${MINISTRY_EMAIL}" "${MINISTRY_FIRSTNAME}" "${MINISTRY_LASTNAME}" "${MINISTRY_PASSWORD}"

# ─── Update Frontend Client redirect URIs based on DOMAIN_NAME ───────────────
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
if [ "${DOMAIN_NAME}" != "localhost" ] && [ -n "${DOMAIN_NAME}" ]; then
  FRONTEND_BASE_URL="https://${DOMAIN_NAME}"
  echo "[provision] Production domain detected: ${FRONTEND_BASE_URL}. Updating client coopdata-frontend..."
  
  CLIENT_INTERNAL_ID=$(./kcadm.sh get clients -r "${REALM}" --server "${KEYCLOAK_SERVER}" -q clientId=coopdata-frontend --fields id --format csv 2>/dev/null | tr -d '"' || echo "")
  
  if [ -n "${CLIENT_INTERNAL_ID}" ]; then
    echo "[provision] Found client internal ID: ${CLIENT_INTERNAL_ID}"
    # Update rootUrl, baseUrl, redirectUris, and post.logout.redirect.uris attribute
    ./kcadm.sh update "clients/${CLIENT_INTERNAL_ID}" \
      -r "${REALM}" \
      --server "${KEYCLOAK_SERVER}" \
      -s "rootUrl=${FRONTEND_BASE_URL}" \
      -s "baseUrl=${FRONTEND_BASE_URL}" \
      -s "redirectUris=[\"${FRONTEND_BASE_URL}/*\"]" \
      -s "attributes.post.logout.redirect.uris=${FRONTEND_BASE_URL}/*" 2>&1
    echo "[provision] Client coopdata-frontend updated successfully."
  else
    echo "[provision] WARNING: Client coopdata-frontend not found in Keycloak."
  fi
fi

echo ""
echo "[provision] Granting coopdata-backend service account roles..."
./kcadm.sh add-roles \
  -r "${REALM}" \
  --server "${KEYCLOAK_SERVER}" \
  --uusername "service-account-coopdata-backend" \
  --cclientid realm-management \
  --rolename view-users \
  --rolename manage-users \
  --rolename query-groups \
  --rolename view-groups \
  --rolename manage-groups \
  --rolename query-users 2>&1 || echo "[provision] Note: service account roles may already be assigned"

# ─── Login theme ─────────────────────────────────────────────────────────────
echo "[provision] Setting login theme..."
./kcadm.sh update "realms/${REALM}" \
  --server "${KEYCLOAK_SERVER}" \
  -s "loginTheme=coopdata" 2>&1 || echo "[provision] Note: Could not set theme"

# ─── SMTP (email delivery for invitations, verification, password reset) ─────
# Configured from environment so secrets never live in the committed realm JSON.
# Defaults to Gmail via an app password. Override in .env for other providers.
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_STARTTLS="${SMTP_STARTTLS:-true}"
SMTP_AUTH="${SMTP_AUTH:-true}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
SMTP_FROM="${SMTP_FROM:-${SMTP_USER}}"
SMTP_FROM_DISPLAY="${SMTP_FROM_DISPLAY:-CoopData}"
SMTP_REPLY_TO="${SMTP_REPLY_TO:-${SMTP_USER}}"
SMTP_ENVELOPE_FROM="${SMTP_ENVELOPE_FROM:-${SMTP_USER}}"

echo "[provision] Configuring realm SMTP (${SMTP_HOST}:${SMTP_PORT})..."
SMTP_JSON="{\"starttls\":\"${SMTP_STARTTLS}\",\"auth\":\"${SMTP_AUTH}\",\"host\":\"${SMTP_HOST}\",\"port\":\"${SMTP_PORT}\",\"user\":\"${SMTP_USER}\",\"password\":\"${SMTP_PASSWORD}\",\"from\":\"${SMTP_FROM}\",\"fromDisplayName\":\"${SMTP_FROM_DISPLAY}\",\"replyTo\":\"${SMTP_REPLY_TO}\",\"envelopeFrom\":\"${SMTP_ENVELOPE_FROM}\"}"
./kcadm.sh update "realms/${REALM}" \
  --server "${KEYCLOAK_SERVER}" \
  -s "smtpServer=${SMTP_JSON}" 2>&1 || echo "[provision] Note: Could not set SMTP"

# SMTP delivery is verified implicitly: creating a user triggers a verification
# email, and the backend now rolls back + returns a failure if that email fails.

# ─── MFA attribute backfill ──────────────────────────────────────────────────
# The realm's "Browser - Conditional 2FA" flow now keys off the `mfa_enabled`
# user attribute instead of credential existence. Users who configured MFA
# before this change have an OTP credential but no attribute, so they would
# silently stop being prompted. Backfill the attribute for them.
# The script lives next to this file (mounted at the same path in the container)
# and is idempotent.
echo "[provision] Backfilling mfa_enabled attribute for existing OTP users..."
BACKFILL_SCRIPT="$(dirname "$0")/backfill-mfa-attribute.sh"
if [ -f "${BACKFILL_SCRIPT}" ]; then
  KEYCLOAK_URL="${KEYCLOAK_SERVER}" \
    ADMIN_USER="${ADMIN_USER}" \
    ADMIN_PASS="${ADMIN_PASS}" \
    REALM="${REALM}" \
    bash "${BACKFILL_SCRIPT}" || echo "[provision] WARNING: MFA backfill failed — run it manually later."
else
  echo "[provision] WARNING: ${BACKFILL_SCRIPT} not found — MFA backfill skipped."
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "[provision] ========================================"
echo "[provision] Provisioning complete!"
echo "[provision]"
echo "[provision]   DGRV Admin"
echo "[provision]     Email:    ${DGRV_EMAIL}"
echo "[provision]     Password: ${DGRV_PASSWORD}"
echo "[provision]"
echo "[provision]   Ministry Admin"
echo "[provision]     Email:    ${MINISTRY_EMAIL}"
echo "[provision]     Password: ${MINISTRY_PASSWORD}"
echo "[provision]"
echo "[provision]   Both have: ministry role + realm-admin + realm-management client roles"
echo "[provision] ========================================"