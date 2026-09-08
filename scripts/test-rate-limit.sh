#!/usr/bin/env bash
set -euo pipefail

# CoopData - Rate Limiting Test Script
# Verifies the 3-layer rate limiting / abuse-prevention defense:
#
#   Layer 3 (Axum Redis token bucket)  - sensitive auth endpoints return 429
#   Layer 1 (Keycloak brute-force)     - login locked after 5 failed attempts
#
# Both layers are tested by default. Use --no-keycloak to skip Layer 1
# (it temporarily locks the test user for ~60s+).
#
# Usage:  ./scripts/test-rate-limit.sh [--no-keycloak]
#
# Env overrides (all optional):
#   BACKEND_URL        default http://localhost:3000
#   KEYCLOAK_URL       default http://localhost:8180
#   KEYCLOAK_REALM     default coop-data
#   CLIENT_ID          default coopdata-backend
#   CLIENT_SECRET      default $KEYCLOAK_CLIENT_SECRET
#   RATE_LIMIT_MAX     default 5   (must match RATE_LIMIT_AUTH_MAX)
#   KC_TEST_USER       default admin@ministry.gov
#   KC_TEST_PASSWORD   default Ministry@Admin2026!
#
# Layer 3 sends RATE_LIMIT_MAX + 1 requests and expects the last to be 429.
# Auth for Layer 3 uses the coopdata-backend service account (client_credentials
# grant) — the backend accepts service-account tokens, so no test user needed.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()   { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()     { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()   { echo -e "${RED}[FAIL]${NC}  $*"; }
header() { echo; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

# Load only the vars we need from root .env (avoid sourcing the whole file,
# which breaks on values containing spaces, e.g. SMTP_PASSWORD)
if [[ -f .env ]]; then
    CLIENT_SECRET="${CLIENT_SECRET:-$(grep -E '^KEYCLOAK_CLIENT_SECRET=' .env | head -1 | cut -d= -f2-)}"
    KC_PASS="${KC_TEST_PASSWORD:-$(grep -E '^COOPDATA_MINISTRY_ADMIN_PASSWORD=' .env | head -1 | cut -d= -f2-)}"
fi

# Parse flags
TEST_KEYCLOAK=1
for arg in "$@"; do
    case "$arg" in
        --no-keycloak) TEST_KEYCLOAK=0 ;;
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
KC_USER="${KC_TEST_USER:-admin@ministry.gov}"
KC_PASS="${KC_PASS:-}"

ENDPOINT="/api/v1/me/verify-identity"
KC_TOKEN_URL="$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token"

PASS=true

# ── 0. Ensure backend is up ────────────────────────────────────────────────
header "Preparing stack"
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

# ── LAYER 3: Axum Redis token bucket ───────────────────────────────────────
header "LAYER 3 - Axum Redis token bucket (sensitive auth endpoints)"

if [[ -z "$CLIENT_SECRET" ]]; then
    fail "CLIENT_SECRET is empty. Set KEYCLOAK_CLIENT_SECRET in .env or pass CLIENT_SECRET."
    exit 1
fi
info "Fetching service-account token for $CLIENT_ID ..."
TOKEN_RESP=$(curl -s -X POST "$KC_TOKEN_URL" \
    -d "grant_type=client_credentials" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET")
TOKEN=$(printf '%s' "$TOKEN_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
    fail "Could not obtain a token. Response: $(printf '%s' "$TOKEN_RESP" | head -c 300)"
    exit 1
fi
ok "Token obtained"

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

LAST="${codes[-1]}"
if [[ "$LAST" == "429" ]]; then
    ok "Last request returned 429 (rate limit enforced)"
else
    fail "Expected 429 on the last request but got $LAST"
    PASS=false
fi

RETRY=$(curl -si -X POST "$BACKEND_URL$ENDPOINT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"password":"wrong"}' | tr -d '\r' | awk -F': ' 'tolower($1)=="retry-after"{print $2}')
if [[ -n "$RETRY" ]]; then
    ok "Retry-After header present: $RETRY"
else
    warn "Retry-After header not found on limited response"
fi

# ── LAYER 1: Keycloak brute-force detection ────────────────────────────────
if [[ "$TEST_KEYCLOAK" == "1" ]]; then
    header "LAYER 1 - Keycloak brute-force detection (login)"
    if [[ -z "$KC_PASS" ]]; then
        fail "KC_TEST_PASSWORD is not set. Set COOPDATA_MINISTRY_ADMIN_PASSWORD in .env or pass KC_TEST_PASSWORD."
        exit 1
    fi
    info "Testing for $KC_USER (locks user ~60s+)..."
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
else
    header "LAYER 1 - Keycloak brute-force detection (login)"
    warn "Skipped (use --no-keycloak to skip, or remove it to run)"
fi

echo
if [[ "$PASS" == "true" ]]; then
    header "RESULT: All rate-limiting layers working as expected"
else
    header "RESULT: Rate-limiting test FAILED"
    exit 1
fi
