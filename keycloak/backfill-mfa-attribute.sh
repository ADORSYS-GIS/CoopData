#!/bin/bash
# ============================================================
# Backfill: MFA attributes + recovery-codes action for existing users
# ============================================================
# The realm's "Browser - Conditional 2FA" flow now prompts for
# OTP based on the `mfa_enabled` user attribute (instead of
# credential existence), and recovery codes are offered at MFA
# setup. Users who configured MFA *before* these changes:
#   1. have an OTP credential but no `mfa_enabled` attribute
#      -> they would silently stop being prompted at login
#   2. were never offered recovery codes
# This script fixes both:
#   - sets `mfa_enabled=true` for every user with an OTP credential
#     (never overrides an explicit `mfa_enabled=false`, i.e. users
#     who soft-disabled MFA)
#   - arms the `CONFIGURE_RECOVERY_AUTHN_CODES` required action so
#     those users are asked to generate backup codes at their next
#     sign-in (Keycloak skips the screen automatically for users who
#     already have recovery codes)
#
# Run manually: bash keycloak/backfill-mfa-attribute.sh
# Also invoked automatically at the end of provision.sh.
# Idempotent — safe to re-run.
# ============================================================

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-coop-data}"
ATTRIBUTE_NAME="mfa_enabled"
ATTRIBUTE_VALUE="true"
RECOVERY_ACTION="CONFIGURE_RECOVERY_AUTHN_CODES"

PYTHON_BIN="$(command -v python3 || command -v python)"

if [ -z "$PYTHON_BIN" ]; then
  echo "[backfill] ERROR: python3/python not found — cannot parse JSON responses."
  echo "[backfill] Backfill skipped. Set mfa_enabled=true manually for users with OTP credentials."
  exit 1
fi

echo "[backfill] Getting admin token..."
TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=${ADMIN_USER}&password=${ADMIN_PASS}" \
  | "${PYTHON_BIN}" -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[backfill] ERROR: Could not get admin token. Backfill skipped."
  exit 1
fi

echo "[backfill] Listing users in realm '${REALM}'..."
# Paginate over the user list (Keycloak caps results at `max` per request).
# Without looping, realms with more than PAGE_SIZE users would silently miss
# backfilled users and leave them without OTP prompts under the new
# attribute-keyed flow.
PAGE_SIZE=1000
FIRST=0
USER_IDS=""
while true; do
  PAGE=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/users?max=${PAGE_SIZE}&first=${FIRST}" \
    -H "Authorization: Bearer ${TOKEN}")

  PAGE_IDS=$(echo "$PAGE" | "${PYTHON_BIN}" -c "
import sys, json
users = json.load(sys.stdin)
for u in users:
    print(u.get('id', ''))
" 2>/dev/null)

  COUNT=$(echo "$PAGE" | "${PYTHON_BIN}" -c "
import sys, json
try:
    print(len(json.load(sys.stdin)))
except Exception:
    print(0)
" 2>/dev/null)

  if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ]; then
    break
  fi

  if [ -n "$PAGE_IDS" ]; then
    USER_IDS="${USER_IDS}
${PAGE_IDS}"
  fi
  FIRST=$((FIRST + PAGE_SIZE))
done

TOTAL=0
ATTR_UPDATED=0
ACTION_UPDATED=0

while IFS= read -r USER_ID; do
  [ -z "$USER_ID" ] && continue
  TOTAL=$((TOTAL + 1))

  CREDS=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USER_ID}/credentials" \
    -H "Authorization: Bearer ${TOKEN}")

  HAS_OTP=$(echo "$CREDS" | "${PYTHON_BIN}" -c "
import sys, json
try:
    creds = json.load(sys.stdin)
except Exception:
    sys.exit(1)
print('yes' if any(c.get('type') == 'otp' for c in creds) else 'no')
" 2>/dev/null)

  if [ "$HAS_OTP" != "yes" ]; then
    continue
  fi

  # Fetch the full user representation (attributes + required actions).
  USER_JSON=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USER_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

  # --- 1. mfa_enabled attribute --------------------------------
  CURRENT_ATTR=$(echo "$USER_JSON" | "${PYTHON_BIN}" -c "
import sys, json
try:
    u = json.load(sys.stdin)
except Exception:
    sys.exit(1)
attrs = u.get('attributes') or {}
vals = attrs.get('${ATTRIBUTE_NAME}', [])
print(vals[0] if vals else '')
" 2>/dev/null)

  if [ "$CURRENT_ATTR" = "${ATTRIBUTE_VALUE}" ]; then
    ATTR_OK="yes"
  else
    ATTR_OK="no"
  fi

  # --- 2. recovery-codes required action ------------------------
  HAS_ACTION=$(echo "$USER_JSON" | "${PYTHON_BIN}" -c "
import sys, json
try:
    u = json.load(sys.stdin)
except Exception:
    sys.exit(1)
actions = u.get('requiredActions') or []
print('yes' if '${RECOVERY_ACTION}' in actions else 'no')
" 2>/dev/null)

  if [ "$ATTR_OK" = "yes" ] && [ "$HAS_ACTION" = "yes" ]; then
    continue
  fi

  # PUT is a full replace: merge the new attribute/action into the existing
  # representation, preserving every other field.
  echo "[backfill] Updating ${USER_ID} (attr=${ATTRIBUTE_NAME}=${ATTRIBUTE_VALUE}, action=${RECOVERY_ACTION})"
  curl -s -o /dev/null -X PUT \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USER_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(echo "$USER_JSON" | "${PYTHON_BIN}" -c "
import sys, json
u = json.load(sys.stdin)
attrs = u.get('attributes') or {}
attrs['${ATTRIBUTE_NAME}'] = ['${ATTRIBUTE_VALUE}']
u['attributes'] = attrs
actions = list(u.get('requiredActions') or [])
if '${RECOVERY_ACTION}' not in actions:
    actions.append('${RECOVERY_ACTION}')
u['requiredActions'] = actions
print(json.dumps(u))
" 2>/dev/null)"

  if [ "$ATTR_OK" != "yes" ]; then
    ATTR_UPDATED=$((ATTR_UPDATED + 1))
  fi
  if [ "$HAS_ACTION" != "yes" ]; then
    ACTION_UPDATED=$((ACTION_UPDATED + 1))
  fi
done <<< "$USER_IDS"

echo "[backfill] Done. Scanned ${TOTAL} user(s): set ${ATTRIBUTE_NAME}=${ATTRIBUTE_VALUE} for ${ATTR_UPDATED}, armed ${RECOVERY_ACTION} for ${ACTION_UPDATED}."
