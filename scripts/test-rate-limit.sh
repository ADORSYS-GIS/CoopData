#!/usr/bin/env bash
set -euo pipefail

# CoopData - Rate Limiting Test Script
# Verifies the Axum Redis token-bucket rate limiter on the sensitive auth
# endpoints (Layer 3 of the 3-layer defense). Sends N rapid requests and
# expects the (N+1)th to return HTTP 429 with a Retry-After header.
#
# Usage:  ./scripts/test-rate-limit.sh [--keycloak]
#
#   --keycloak   Also test Layer 1 (Keycloak brute-force detection) by sending
#                5 wrong passwords then a correct one. NOTE: this temporarily
#                locks the test user for ~60s+.
#
# Env overrides (all optional):
#   BACKEND_URL        default http://localhost:3000
#   KEYCLOAK_URL       default http://localhost:8180
#   KEYCLOAK_REALM     default coop-data
#   CLIENT_ID          default coopdata-backend
#   CLIENT_SECRET      default $KEYCLOAK_CLIENT_SECRET
#   RATE_LIMIT_MAX     default 5   (must match RATE_LIMIT_AUTH_MAX)
#
# The script sends RATE_LIMIT_MAX + 1 requests and expects the last to be 429.
#
# Auth: uses the coopdata-backend service account (client_credentials grant).
# The backend accepts service-account tokens (audience check is skipped for
# them), so this works without provisioning a test user.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

# Load only the vars we need from root .env (avoid sourcing the whole file,
# which breaks on values containing spaces, e.g. SMTP_PASSWORD)
if [[ -f .env ]]; then
    CLIENT_SECRET="${CLIENT_SECRET:-$(grep -E '^KEYCLOAK_CLIENT_SECRET=' .env | head -1 | cut -d= -f2-)}"
fi

# Parse flags
TEST_KEYCLOAK=0
for arg in "$@"; do
    case "$arg" in
        --keycloak) TEST_KEYCLOAK=1 ;;
        *) warn "Unknown argument ignored: $arg" ;;
    esac
done

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-coop-data}"
CLIENT_ID="${CLIENT_ID:-coopdata-backend}"
CLIENT_SECRET="${CLIENT_SECRET:-${KEYCLOAK_CLIENT_SECRET:-}}"
RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-5}"
REQUESTS=$((RATE_LIMIT_MAX + 1))

ENDPOINT="/api/v1/me/verify-identity"

# ── 1. Ensure backend is up ────────────────────────────────────────────────
if ! curl -sf --max-time 5 "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
    warn "Backend not running at $BACKEND_URL. Starting stack..."
    docker compose up -d backend postgres redis keycloak minio
    info "Waiting for backend to become healthy..."
    for i in $(seq 1 60); do
        if curl -sf --max-time 3 "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
            ok "Backend is healthy"
            break
        fi
        [[ $i -eq 60 ]] && { fail "Backend did not become healthy in time"; exit 1; }
        sleep 2
    done
else
    ok "Backend already running at $BACKEND_URL"
fi

# ── 2. Obtain a service-account JWT via Keycloak client_credentials ───────
if [[ -z "$CLIENT_SECRET" ]]; then
    fail "CLIENT_SECRET is empty. Set KEYCLOAK_CLIENT_SECRET in .env or pass CLIENT_SECRET."
    exit 1
fi
info "Fetching service-account token for $CLIENT_ID from $KEYCLOAK_URL/realms/$KEYCLOAK_REALM ..."
TOKEN_RESP=$(curl -s -X POST "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET")
TOKEN=$(printf '%s' "$TOKEN_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
    fail "Could not obtain a token. Response: $(printf '%s' "$TOKEN_RESP" | head -c 300)"
    exit 1
fi
ok "Token obtained"

# ── 3. Fire rapid requests and expect 429 on the last ─────────────────────
info "Sending $REQUESTS rapid requests to $ENDPOINT (limit=$RATE_LIMIT_MAX)..."
codes=()
for i in $(seq 1 "$REQUESTS"); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$BACKEND_URL$ENDPOINT" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"password":"wrong"}')
    codes+=("$code")
    echo "  request $i -> HTTP $code"
done

# ── 4. Assertions ──────────────────────────────────────────────────────────
LAST="${codes[-1]}"
PASS=true

if [[ "$LAST" == "429" ]]; then
    ok "Last request returned 429 (rate limit enforced)"
else
    fail "Expected 429 on the last request but got $LAST"
    PASS=false
fi

# Confirm Retry-After header is present on a limited request
RETRY=$(curl -si -X POST "$BACKEND_URL$ENDPOINT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"password":"wrong"}' | tr -d '\r' | awk -F': ' 'tolower($1)=="retry-after"{print $2}')
if [[ -n "$RETRY" ]]; then
    ok "Retry-After header present: $RETRY"
else
    warn "Retry-After header not found on limited response"
fi

# ── 5. (Optional) Layer 1: Keycloak brute-force detection ─────────────────
if [[ "$TEST_KEYCLOAK" == "1" ]]; then
    KC_USER="${KC_TEST_USER:-admin@ministry.gov}"
    KC_PASS="${KC_TEST_PASSWORD:-Ministry@Admin2026!}"
    KC_TOKEN_URL="$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token"

    info "Testing Keycloak brute-force detection for $KC_USER (locks user ~60s+)..."
    for i in 1 2 3 4 5; do
        curl -s -o /dev/null -X POST "$KC_TOKEN_URL" \
            -d "grant_type=password" -d "client_id=$CLIENT_ID" -d "client_secret=$CLIENT_SECRET" \
            -d "username=$KC_USER" -d "password=WrongPass$i"
    done

    RESULT=$(curl -s -X POST "$KC_TOKEN_URL" \
        -d "grant_type=password" -d "client_id=$CLIENT_ID" -d "client_secret=$CLIENT_SECRET" \
        -d "username=$KC_USER" -d "password=$KC_PASS")

    if printf '%s' "$RESULT" | grep -q "access_token"; then
        fail "Keycloak brute-force NOT enforced (correct password succeeded after 5 failures)"
        PASS=false
    else
        ok "Keycloak brute-force enforced (correct password blocked after 5 failures)"
    fi
fi

echo
if [[ "$PASS" == "true" ]]; then
    ok "Rate limiting is working as expected."
else
    fail "Rate limiting test FAILED."
    exit 1
fi
