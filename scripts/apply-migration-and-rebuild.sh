#!/usr/bin/env bash
set -euo pipefail

echo "=== Step 1: Apply migration ==="
sudo docker exec -i coopdata-postgres psql -U coopdata -d coopdata < backend/migrations/02_audit_and_tables.sql

echo "=== Step 2: Rebuild backend image ==="
sudo docker compose build backend

echo "=== Step 3: Restart backend container ==="
sudo docker compose up -d backend

echo "=== Done ==="
