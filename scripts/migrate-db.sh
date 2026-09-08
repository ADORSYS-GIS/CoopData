#!/usr/bin/env bash
# =============================================================================
# CoopData — Database Migration Runner
# =============================================================================
# Applies pending SQL migrations in backend/migrations/ to the running
# PostgreSQL container. Tracks applied migrations in a `schema_migrations`
# table so each migration runs exactly once, even against an existing DB
# (the docker-entrypoint-initdb.d mount only runs on a fresh data volume).
#
# Baseline behaviour: if the DB is already initialized (e.g. `organizations`
# table exists) but has no migration history, all current migration files are
# marked as applied so they are NOT re-run on an existing production DB. Only
# migrations added after this point will be applied.
#
# Usage:
#   ./scripts/migrate-db.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${LOG_PREFIX} ${CYAN}INFO${NC}  $*"; }
ok()    { echo -e "${LOG_PREFIX} ${GREEN}OK${NC}    $*"; }
warn()  { echo -e "${LOG_PREFIX} ${YELLOW}WARN${NC}  $*"; }
error() { echo -e "${LOG_PREFIX} ${RED}ERROR${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="${PROJECT_DIR}/backend/migrations"
LOG_PREFIX="[migrate]"

# ── Source .env for DB credentials ───────────────────────────────────────────
ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

PG_CONTAINER="${PG_CONTAINER:-coopdata-postgres}"
PG_USER="${POSTGRES_USER:?POSTGRES_USER is required in .env}"
PG_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env}"
APP_DB="${POSTGRES_DB:-coopdata}"

# ── Docker access ─────────────────────────────────────────────────────────────
DOCKER_SUDO=""
if ! docker info &>/dev/null 2>&1; then
    if sudo docker info &>/dev/null 2>&1; then
        DOCKER_SUDO="sudo"
    else
        error "Cannot access Docker. Run: sudo usermod -aG docker \$USER && newgrp docker"
    fi
fi

if ! $DOCKER_SUDO docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    error "PostgreSQL container '${PG_CONTAINER}' is not running. Start the stack first."
fi

psql() {
    $DOCKER_SUDO docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d "$APP_DB" -v ON_ERROR_STOP=1 "$@"
}

# Apply a migration file by piping it into psql via stdin (the file lives on the
# host, not inside the container, so `-f` cannot be used).
apply_sql_file() {
    local file="$1"
    $DOCKER_SUDO docker exec -i -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d "$APP_DB" -v ON_ERROR_STOP=1 < "$file"
}

# ── 1. Ensure tracking table exists ──────────────────────────────────────────
psql -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);" >/dev/null

# ── 2. Baseline existing DB (no history) so migrations are not re-run ────────
APPLIED_COUNT=$(psql -tAc "SELECT count(*) FROM schema_migrations;" | tr -d '[:space:]')
if [[ "$APPLIED_COUNT" == "0" ]]; then
    if psql -tAc "SELECT to_regclass('public.organizations');" | grep -q "organizations"; then
        warn "Existing DB detected with no migration history — baselining current migrations."
        BASELINED=0
        for f in "$MIGRATIONS_DIR"/*.sql; do
            [[ -e "$f" ]] || continue
            base=$(basename "$f")
            version="${base%%_*}"
            psql -c "INSERT INTO schema_migrations (version, filename)
                     VALUES ('${version}', '${base}') ON CONFLICT DO NOTHING;" >/dev/null
            BASELINED=$((BASELINED + 1))
        done
        ok "Baselined ${BASELINED} existing migration(s)."
    fi
fi

# ── 3. Apply pending migrations in order ─────────────────────────────────────
PENDING=0
for f in "$MIGRATIONS_DIR"/*.sql; do
    [[ -e "$f" ]] || continue
    base=$(basename "$f")
    version="${base%%_*}"
    if [[ "$(psql -tAc "SELECT count(*) FROM schema_migrations WHERE version='${version}';" | tr -d '[:space:]')" == "0" ]]; then
        info "Applying migration ${base}..."
        apply_sql_file "$f"
        psql -c "INSERT INTO schema_migrations (version, filename)
                 VALUES ('${version}', '${base}') ON CONFLICT DO NOTHING;" >/dev/null
        PENDING=$((PENDING + 1))
    fi
done

if [[ "$PENDING" -eq 0 ]]; then
    ok "No pending migrations — database is up to date."
else
    ok "Applied ${PENDING} pending migration(s)."
fi
