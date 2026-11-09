#!/bin/bash
# Runs last during first-time initdb. Every *.sql file in this directory has just
# been applied by the entrypoint, so record them in schema_migrations. Without
# this, scripts/migrate-db.sh would see a database with tables and no history.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-$POSTGRES_USER}" <<-EOSQL
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT NOT NULL,
        filename   TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_filename_key
        ON schema_migrations (filename);
EOSQL

for f in /docker-entrypoint-initdb.d/*.sql; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-$POSTGRES_USER}" \
        -c "INSERT INTO schema_migrations (version, filename) VALUES ('${base%%_*}', '${base}') ON CONFLICT DO NOTHING;"
done
