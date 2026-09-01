#!/usr/bin/env bash
# =============================================================================
# CoopData — Demo / Staging Environment Deployment Script
# =============================================================================
# Deploys updates to the isolated Demo environment (coopdata-demo project).
# Capped at 25% server resources.
#
# Usage:
#   ./scripts/deploy-demo.sh                     # Deploy latest develop branch images
#   ./scripts/deploy-demo.sh v1.1.0-rc1          # Deploy specific release candidate
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.demo.yaml"

TARGET_TAG="${1:-develop}"

export DEMO_BACKEND_IMAGE_TAG="${TARGET_TAG}"
export DEMO_FRONTEND_IMAGE_TAG="${TARGET_TAG}"

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      CoopData — Demo Environment Deployment           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "Target Version Tag: ${CYAN}${TARGET_TAG}${NC}\n"

# ── Detect Docker ─────────────────────────────────────────────────────────────
DOCKER_SUDO=""
if ! docker info &>/dev/null 2>&1; then
    if sudo docker info &>/dev/null 2>&1; then
        DOCKER_SUDO="sudo"
    else
        error "Cannot access Docker. Run: sudo usermod -aG docker \$USER && newgrp docker"
    fi
fi

COMPOSE_CMD="$DOCKER_SUDO docker compose -p coopdata-demo -f ${COMPOSE_FILE}"

# ── Pull & Deploy Demo Stack ──────────────────────────────────────────────────
info "Pulling Demo images (${TARGET_TAG})..."
$COMPOSE_CMD pull demo-backend demo-frontend || warn "Could not pull image ${TARGET_TAG}"

info "Starting Demo stack (25% host resource cap)..."
$COMPOSE_CMD up -d

# ── Post-Deploy Health Check ──────────────────────────────────────────────────
info "Verifying Demo health..."
ELAPSED=0
MAX_WAIT=40
HEALTHY=false

while (( ELAPSED < MAX_WAIT )); do
    if curl -sf http://localhost:3005/api/v1/health &>/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [[ "$HEALTHY" == true ]]; then
    ok "Demo deployment complete and healthy!"
    echo ""
    echo -e "  ${GREEN}►${NC} Demo API        : http://localhost:3005/api/v1/health"
    echo -e "  ${GREEN}►${NC} Demo Frontend   : http://localhost:5175"
    echo -e "  ${GREEN}►${NC} Demo Subdomain  : https://demo.yourdomain.com"
    echo ""
else
    warn "Demo containers are initializing..."
fi
