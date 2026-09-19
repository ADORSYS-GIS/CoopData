#!/usr/bin/env bash
set -euo pipefail

# CoopData - Chaos & Resilience Test Script (T18)
#
# Verifies the platform recovers from infrastructure / dependency failures:
#
#   Scenario 1: Database (Postgres) failure  -> stop, verify degraded, restore, verify recovery + integrity
#   Scenario 2: Redis failure                -> stop, verify degraded, restore, verify recovery
#   Scenario 3: Keycloak failure             -> stop, verify degraded, restore, verify recovery
#
# The backend must NOT crash and must automatically reconnect once each
# dependency is restored (no data corruption, no manual intervention).
#
# Usage:  ./scripts/test-chaos.sh [--no-keycloak]
#
# Env overrides (all optional):
#   BACKEND_URL   default http://localhost:3000
#   COMPOSE_FILE  default docker-compose.yml (production build, no dev override)
#
# NOTE: This script uses `docker compose -f docker-compose.yml` explicitly so the
# dev override (cargo-watch) is NOT used — we test the production image.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()   { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()     { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()   { echo -e "${RED}[FAIL]${NC}  $*"; }
header() { echo; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

TEST_KEYCLOAK=1
for arg in "$@"; do
    case "$arg" in
        --no-keycloak) TEST_KEYCLOAK=0 ;;
        *) warn "Unknown argument ignored: $arg" ;;
    esac
done

PASS=true

# Always clean up chaos-test rows, even if the script aborts mid-way.
cleanup() {
    "${PG[@]}" -c "DELETE FROM audit_logs WHERE actor_keycloak_id='chaos-test';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────────────────
# Returns the "status" field from the health endpoint (healthy|degraded).
health_status() {
    curl -s --max-time 5 "$BACKEND_URL/api/v1/health" 2>/dev/null \
        | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true
}

# Returns the per-check value for a dependency (ok|down) from the health body.
health_check() {
    local dep="$1"
    curl -s --max-time 5 "$BACKEND_URL/api/v1/health" 2>/dev/null \
        | python3 -c "import sys,json;print(json.load(sys.stdin).get('checks',{}).get('$dep',''))" 2>/dev/null || true
}

wait_for_health() {
    local want="$1"
    local dep="$2"
    for i in $(seq 1 60); do
        local st
        st=$(health_status)
        local dep_state
        dep_state=$(health_check "$dep")
        # For "healthy", the aggregate status must be healthy. For "degraded",
        # the specific dependency must be down (not just any check failing).
        if [[ "$want" == "healthy" && "$st" == "healthy" ]]; then
            return 0
        fi
        if [[ "$want" == "degraded" && "$dep_state" == "down" ]]; then
            return 0
        fi
        # For "recovered", the specific dependency must be back to ok.
        if [[ "$want" == "recovered" && "$dep_state" == "ok" ]]; then
            return 0
        fi
        [[ $i -eq 60 ]] && return 1
        sleep 2
    done
}

# ── DB helpers (run psql inside the postgres container) ────────────────────
PG=(docker exec coopdata-postgres psql -U coopdata -d coopdata -t -A)

# Row count of a table (empty string when DB unreachable).
db_count() {
    local table="$1"
    "${PG[@]}" -c "SELECT count(*) FROM $table;" 2>/dev/null || true
}

# A stable checksum of a table's rows (empty string when DB unreachable).
db_checksum() {
    local table="$1"
    "${PG[@]}" -c "SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) FROM $table t;" 2>/dev/null || true
}

# ── 0. Ensure stack is up ──────────────────────────────────────────────────
header "Preparing stack (production compose: $COMPOSE_FILE)"
if ! curl -sf --max-time 5 "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
    warn "Backend not running at $BACKEND_URL. Starting stack..."
    "${COMPOSE[@]}" up -d postgres redis keycloak backend
    info "Waiting for backend to become healthy..."
    if ! wait_for_health "healthy" "database"; then
        fail "Backend did not become healthy in time"
        exit 1
    fi
    ok "Backend is healthy"
else
    ok "Backend already running at $BACKEND_URL"
fi

# ── Scenario 1: Database failure ───────────────────────────────────────────
header "SCENARIO 1 - Database (Postgres) failure"

# Capture baseline before the outage so we can prove no corruption afterwards.
BASELINE_COUNT=$(db_count submissions)
BASELINE_CHECKSUM=$(db_checksum submissions)
info "Baseline: submissions count=$BASELINE_COUNT checksum=$BASELINE_CHECKSUM"

info "Stopping postgres..."
"${COMPOSE[@]}" stop postgres

info "Waiting for backend to report degraded..."
if wait_for_health "degraded" "database"; then
    ok "Backend reports degraded while DB is down (database=down)"
else
    fail "Backend did not report degraded while DB was down"
    PASS=false
fi

# During the outage, a write transaction must FAIL cleanly (no partial write).
info "Attempting a write transaction while DB is down (must fail cleanly)..."
if "${PG[@]}" -c "BEGIN; INSERT INTO audit_logs (actor_keycloak_id, action, resource_type) VALUES ('chaos-test','chaos','chaos'); COMMIT;" >/dev/null 2>&1; then
    fail "Write transaction unexpectedly succeeded while DB was down"
    PASS=false
else
    ok "Write transaction failed cleanly while DB was down (no partial write)"
fi

info "Restoring postgres..."
"${COMPOSE[@]}" start postgres

info "Waiting for backend to recover..."
if wait_for_health "recovered" "database"; then
    ok "Backend recovered automatically after DB restore (database=ok)"
else
    fail "Backend did not recover after DB restore"
    PASS=false
fi

# ── Transaction integrity verification ─────────────────────────────────────
header "TRANSACTION INTEGRITY - after DB recovery"

# 1. Data must be unchanged from baseline (no corruption / no partial writes).
AFTER_COUNT=$(db_count submissions)
AFTER_CHECKSUM=$(db_checksum submissions)
if [[ "$AFTER_COUNT" == "$BASELINE_COUNT" && "$AFTER_CHECKSUM" == "$BASELINE_CHECKSUM" ]]; then
    ok "Data intact after outage (submissions count=$AFTER_COUNT, checksum unchanged)"
else
    fail "Data changed after outage! count: $BASELINE_COUNT -> $AFTER_COUNT"
    PASS=false
fi

# 2. Atomicity: a rolled-back transaction must leave no trace.
info "Testing atomicity (rollback leaves no trace)..."
"${PG[@]}" -c "BEGIN; INSERT INTO audit_logs (actor_keycloak_id, action, resource_type) VALUES ('chaos-test','rollback','chaos'); ROLLBACK;" >/dev/null 2>&1 || true
ROLLBACK_ROWS=$("${PG[@]}" -c "SELECT count(*) FROM audit_logs WHERE actor_keycloak_id='chaos-test';" 2>/dev/null | tr -d '[:space:]')
if [[ "$ROLLBACK_ROWS" == "0" ]]; then
    ok "Rolled-back transaction left no trace (0 rows)"
else
    fail "Rolled-back transaction left $ROLLBACK_ROWS rows - atomicity broken"
    PASS=false
fi

# 3. A committed transaction must persist (write path works after recovery).
info "Testing commit persists after recovery..."
"${PG[@]}" -c "BEGIN; INSERT INTO audit_logs (actor_keycloak_id, action, resource_type) VALUES ('chaos-test','commit','chaos'); COMMIT;" >/dev/null 2>&1 || true
COMMIT_ROWS=$("${PG[@]}" -c "SELECT count(*) FROM audit_logs WHERE actor_keycloak_id='chaos-test';" 2>/dev/null | tr -d '[:space:]')
if [[ "$COMMIT_ROWS" == "1" ]]; then
    ok "Committed transaction persisted (1 row)"
else
    fail "Committed transaction did not persist (rows=$COMMIT_ROWS)"
    PASS=false
fi

# Test rows are removed by the cleanup trap on exit.

# ── Scenario 2: Redis failure ──────────────────────────────────────────────
header "SCENARIO 2 - Redis failure"
info "Stopping redis..."
"${COMPOSE[@]}" stop redis

info "Waiting for backend to report degraded..."
if wait_for_health "degraded" "redis"; then
    ok "Backend reports degraded while Redis is down (redis=down)"
else
    fail "Backend did not report degraded while Redis was down"
    PASS=false
fi

info "Restoring redis..."
"${COMPOSE[@]}" start redis

info "Waiting for backend to recover..."
if wait_for_health "recovered" "redis"; then
    ok "Backend recovered automatically after Redis restore (redis=ok)"
else
    fail "Backend did not recover after Redis restore"
    PASS=false
fi

# ── Scenario 3: Keycloak failure ───────────────────────────────────────────
if [[ "$TEST_KEYCLOAK" == "1" ]]; then
    header "SCENARIO 3 - Keycloak failure"
    info "Stopping keycloak..."
    "${COMPOSE[@]}" stop keycloak

    info "Waiting for backend to report degraded..."
    if wait_for_health "degraded" "keycloak"; then
        ok "Backend reports degraded while Keycloak is down (keycloak=down)"
    else
        fail "Backend did not report degraded while Keycloak was down"
        PASS=false
    fi

    info "Restoring keycloak..."
    "${COMPOSE[@]}" start keycloak

    info "Waiting for backend to recover..."
    if wait_for_health "recovered" "keycloak"; then
        ok "Backend recovered automatically after Keycloak restore (keycloak=ok)"
    else
        fail "Backend did not recover after Keycloak restore"
        PASS=false
    fi
else
    header "SCENARIO 3 - Keycloak failure"
    warn "Skipped (use --no-keycloak to skip, or remove it to run)"
fi

# ── Final health snapshot ──────────────────────────────────────────────────
header "Final health snapshot"
curl -s --max-time 5 "$BACKEND_URL/api/v1/health" | python3 -m json.tool 2>/dev/null || true

echo
if [[ "$PASS" == "true" ]]; then
    header "RESULT: All chaos scenarios passed - services recover automatically"
else
    header "RESULT: Chaos test FAILED"
    exit 1
fi
