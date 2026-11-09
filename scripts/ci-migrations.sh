#!/usr/bin/env bash
# Applies every migration to an empty Postgres the way a fresh deploy does
# (initdb mount), then runs migrate-db.sh and checks nothing is left over.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="migcheck-pg-$$"
export PG_CONTAINER="$NAME" POSTGRES_USER=coopdata POSTGRES_PASSWORD=ci POSTGRES_DB=coopdata

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" \
    -e POSTGRES_USER -e POSTGRES_PASSWORD -e POSTGRES_DB \
    -v "$ROOT/backend/migrations:/docker-entrypoint-initdb.d:ro" \
    postgres:16-alpine >/dev/null

for _ in $(seq 1 60); do
    sleep 2
    docker exec "$NAME" pg_isready -U coopdata -d coopdata >/dev/null 2>&1 \
        && docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete" && break
done
docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete" || { docker logs "$NAME" | tail -40; exit 1; }

sql() { docker exec -e PGPASSWORD=ci "$NAME" psql -U coopdata -d coopdata -tAc "$1"; }

files=$(ls "$ROOT"/backend/migrations/*.sql | wc -l)
recorded=$(sql "SELECT count(*) FROM schema_migrations")
[[ "$recorded" == "$files" ]] || { echo "ERROR: $files files but $recorded recorded"; exit 1; }

"$ROOT/scripts/migrate-db.sh" | tee /dev/stderr | grep -q "No pending migrations"

# Simulate the legacy state: tables exist, history is gone. Without a flag the
# runner must refuse; with BASELINE_UP_TO it must apply exactly the rest.
sql "TRUNCATE schema_migrations" >/dev/null
if "$ROOT/scripts/migrate-db.sh" >/dev/null 2>&1; then
    echo "ERROR: runner baselined an empty history without BASELINE_UP_TO"; exit 1
fi
sql "DROP TABLE mambu_sync_items CASCADE" >/dev/null 2>&1 || true
BASELINE_UP_TO=63 "$ROOT/scripts/migrate-db.sh" >/dev/null 2>&1 || true
[[ "$(sql "SELECT count(*) FROM schema_migrations WHERE filename='64_mambu_sync.sql'")" == "1" ]] \
    || { echo "ERROR: 64_mambu_sync.sql was not recorded (duplicate prefix skipped?)"; exit 1; }

echo "Migrations OK."
