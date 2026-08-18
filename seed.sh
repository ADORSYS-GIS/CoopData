#!/usr/bin/env bash
# =============================================================================
# seed.sh — CoopData End-to-End Test Hierarchy Seeder
# =============================================================================
# Run this from the project root to seed Keycloak + PostgreSQL with:
#   • 1 Federation  → fed_south@test.coopdata  (password: 1)
#   • 1 Apex        → apex_south@test.coopdata  (password: 1)
#   • 3 Cooperatives → lubombo / shiselweni / hhohho @test.coopdata  (password: 1)
#   • Approved submissions & KPIs for years 2023–2026
#
# Usage:
#   chmod +x seed.sh
#   ./seed.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           CoopData Test Hierarchy Seeder                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check python3 is available
if ! command -v python3 &>/dev/null; then
    echo "[error] python3 is not installed or not in PATH. Please install Python 3."
    exit 1
fi

# Check the seeder script exists
SEED_SCRIPT="$SCRIPT_DIR/seed_matrix_test_data.py"
if [ ! -f "$SEED_SCRIPT" ]; then
    echo "[error] seed_matrix_test_data.py not found at: $SEED_SCRIPT"
    exit 1
fi

# Check Docker is running
if ! docker info &>/dev/null; then
    echo "[error] Docker is not running. Please start Docker before seeding."
    exit 1
fi

# Check required containers are up
for container in coopdata-postgres coopdata-keycloak coopdata-redis; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "[error] Container '${container}' is not running."
        echo "        Run 'docker compose up -d' first."
        exit 1
    fi
done

echo "[seed] All containers are running. Starting seed..."
echo ""

cd "$SCRIPT_DIR"
python3 seed_matrix_test_data.py

echo ""
echo "[seed] Patching non-financial KPI records..."
python3 patch_nf_kpis.py

echo ""
echo "[seed] Flushing Redis cache..."
docker exec coopdata-redis redis-cli FLUSHALL > /dev/null

echo "[seed] Done. Cache cleared."
echo ""
echo "============================================================"
echo " Test accounts ready (password: 1)"
echo "  fed_south@test.coopdata    → Federation user"
echo "  apex_south@test.coopdata   → Apex user"
echo "  lubombo@test.coopdata      → Lubombo Sacco"
echo "  shiselweni@test.coopdata   → Shiselweni Sacco"
echo "  hhohho@test.coopdata       → Hhohho Sacco"
echo " Submissions seeded for years: 2023 · 2024 · 2025 · 2026"
echo "============================================================"
echo ""
