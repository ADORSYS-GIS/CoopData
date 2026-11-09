#!/usr/bin/env bash
# =============================================================================
# CoopData — Database Migration Runner
# =============================================================================
# Applies pending SQL migrations in backend/migrations/ to the running
# PostgreSQL container. Tracks applied migrations in a `schema_migrations`
# table so each migration runs exactly once, even against an existing DB
# (the docker-entrypoint-initdb.d mount only runs on a fresh data volume).
#
# Identity: a migration is tracked by its full filename, so two files may share
# a number prefix. Baselining: a database that has tables but no history is
# NOT guessed at. Pass BASELINE_UP_TO=<number> to stamp migrations up to that
# number as applied and run the rest. A fresh volume is stamped by
# backend/migrations/99_record_migrations.sh during initdb.
#
# Usage:
#   ./scripts/migrate-db.sh
#   BASELINE_UP_TO=63 ./scripts/migrate-db.sh   # legacy DB with no history
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

# ── 1. Ensure tracking table exists, keyed by filename ───────────────────────
# Two files may share a number prefix (64_a.sql, 64_b.sql), so the filename is
# the identity of a migration, not the prefix. Older databases keyed the table
# on `version`; move the key to `filename` without losing history.
psql -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT NOT NULL,
    filename   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_filename_key
    ON schema_migrations (filename);" >/dev/null

record() {
    local base="$1"
    psql -c "INSERT INTO schema_migrations (version, filename)
             VALUES ('${base%%_*}', '${base}') ON CONFLICT DO NOTHING;" >/dev/null
}

is_applied() {
    [[ "$(psql -tAc "SELECT count(*) FROM schema_migrations WHERE filename='${1}';" | tr -d '[:space:]')" != "0" ]]
}

# ── 2. A database with no history is never baselined by guesswork ────────────
# Stamping every file as applied without running it hides schema that is really
# missing. A fresh volume is stamped by backend/migrations/99_record_migrations.sh;
# a legacy database must say how far it really is with BASELINE_UP_TO=<number>.
APPLIED_COUNT=$(psql -tAc "SELECT count(*) FROM schema_migrations;" | tr -d '[:space:]')
if [[ "$APPLIED_COUNT" == "0" ]]; then
    if psql -tAc "SELECT to_regclass('public.organizations');" | grep -q "organizations"; then
        if [[ -z "${BASELINE_UP_TO:-}" ]]; then
            error "Database has tables but no migration history. Refusing to guess. Re-run with BASELINE_UP_TO=<last migration number already applied> to stamp those and apply the rest."
        fi
        [[ "$BASELINE_UP_TO" =~ ^[0-9]+$ ]] || error "BASELINE_UP_TO must be a number, got '${BASELINE_UP_TO}'."
        warn "Baselining migrations up to ${BASELINE_UP_TO} as already applied."
        BASELINED=0
        for f in "$MIGRATIONS_DIR"/*.sql; do
            [[ -e "$f" ]] || continue
            base=$(basename "$f")
            if (( 10#${base%%_*} <= 10#${BASELINE_UP_TO} )); then
                record "$base"
                BASELINED=$((BASELINED + 1))
            fi
        done
        ok "Baselined ${BASELINED} migration(s)."
    fi
fi

# ── 3. Apply pending migrations in filename order ────────────────────────────
PENDING=0
for f in "$MIGRATIONS_DIR"/*.sql; do
    [[ -e "$f" ]] || continue
    base=$(basename "$f")
    if ! is_applied "$base"; then
        info "Applying migration ${base}..."
        apply_sql_file "$f"
        record "$base"
        PENDING=$((PENDING + 1))
    fi
done

if [[ "$PENDING" -eq 0 ]]; then
    ok "No pending migrations — database is up to date."
else
    ok "Applied ${PENDING} pending migration(s)."
fi
