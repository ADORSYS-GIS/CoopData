#!/usr/bin/env bash
# =============================================================================
# CoopData — Zero-Downtime Production Deployment Script
# =============================================================================
# Pulls the latest images from GHCR and performs rolling updates of the
# backend and frontend with < 1 second connection drop window.
#
# Prerequisites:
#   1. docker-rollout installed (run: ./scripts/install-docker-rollout.sh)
#   2. .env configured with production values
#   3. Stack already running via: docker compose -f docker-compose.ghcr.yaml up -d
#
# Usage:
#   ./scripts/deploy.sh                    # Deploy latest (backend + frontend)
#   ./scripts/deploy.sh v1.1.0             # Deploy specific release version v1.1.0
#   ./scripts/deploy.sh backend            # Deploy backend only (latest)
#   ./scripts/deploy.sh backend v1.1.0     # Deploy backend only (version v1.1.0)
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
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.ghcr.yaml"

TARGET_TAG="latest"
SERVICES_TO_DEPLOY=()

for arg in "$@"; do
    if [[ "$arg" =~ ^v[0-9]+ || "$arg" =~ ^[0-9]+\.[0-9]+ || "$arg" =~ ^[a-f0-9]{7,40}$ ]]; then
        TARGET_TAG="$arg"
    elif [[ "$arg" == "backend" || "$arg" == "frontend" ]]; then
        SERVICES_TO_DEPLOY+=("$arg")
    fi
done

if [[ ${#SERVICES_TO_DEPLOY[@]} -eq 0 ]]; then
    SERVICES_TO_DEPLOY=(backend frontend)
fi

export BACKEND_IMAGE_TAG="${TARGET_TAG}"
export FRONTEND_IMAGE_TAG="${TARGET_TAG}"

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }
success() { echo -e "\n${BOLD}${GREEN}✔ $*${NC}\n"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     CoopData — Zero-Downtime Deployment              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect Docker Compose command ────────────────────────────────────────────
DOCKER_SUDO=""
if ! docker info &>/dev/null 2>&1; then
    if sudo docker info &>/dev/null 2>&1; then
        DOCKER_SUDO="sudo"
    else
        error "Cannot access Docker. Run: sudo usermod -aG docker \$USER && newgrp docker"
    fi
fi

if $DOCKER_SUDO docker compose version &>/dev/null; then
    COMPOSE_CMD="$DOCKER_SUDO docker compose"
else
    error "Docker Compose V2 not found."
fi

# ── Validate compose file exists ─────────────────────────────────────────────
[[ -f "$COMPOSE_FILE" ]] || error "Compose file not found: ${COMPOSE_FILE}"

# ── Check docker-rollout is installed ────────────────────────────────────────
HAS_ROLLOUT=false
if docker rollout --version &>/dev/null 2>&1; then
    HAS_ROLLOUT=true
    ok "docker-rollout: $(docker rollout --version 2>/dev/null || echo 'installed')"
else
    warn "docker-rollout not installed — falling back to standard restart (causes ~5s downtime)"
    warn "Install it: ./scripts/install-docker-rollout.sh"
fi

# ── Pull latest images ────────────────────────────────────────────────────────
step "Pulling latest images from GHCR..."
for svc in "${SERVICES_TO_DEPLOY[@]}"; do
    info "Pulling ${svc}..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" pull "$svc"
done
ok "Images pulled"

# ── Rolling deployment ────────────────────────────────────────────────────────
step "Deploying services: ${SERVICES_TO_DEPLOY[*]}"
DEPLOY_START=$(date +%s)

for svc in "${SERVICES_TO_DEPLOY[@]}"; do
    if [[ "$HAS_ROLLOUT" == true ]]; then
        info "Rolling update: ${svc}..."
        docker rollout -f "$COMPOSE_FILE" "$svc"
        ok "${svc} rolled out with zero downtime"
    else
        info "Standard update: ${svc} (brief downtime expected)..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --no-build "$svc"
        ok "${svc} updated"
    fi
done

DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))

# ── Post-deploy health verification ──────────────────────────────────────────
step "Verifying deployment health..."

MAX_WAIT=60
ELAPSED=0
ALL_HEALTHY=false

while (( ELAPSED < MAX_WAIT )); do
    BACKEND_OK=false
    FRONTEND_OK=false

    if curl -sf http://localhost:3000/api/v1/health &>/dev/null 2>&1; then
        BACKEND_OK=true
    fi
    if curl -sf http://localhost:5174/ &>/dev/null 2>&1; then
        FRONTEND_OK=true
    fi

    if $BACKEND_OK && $FRONTEND_OK; then
        ALL_HEALTHY=true
        break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -e "  ${YELLOW}⏳${NC} Waiting... [API: $([ "$BACKEND_OK" = true ] && echo "✓" || echo ".."), Frontend: $([ "$FRONTEND_OK" = true ] && echo "✓" || echo "..")] (${ELAPSED}s)"
done

if [[ "$ALL_HEALTHY" == true ]]; then
    success "Deployment successful — all services healthy"
else
    warn "Services may still be starting. Check:"
    warn "  $COMPOSE_CMD -f $COMPOSE_FILE ps"
    warn "  $COMPOSE_CMD -f $COMPOSE_FILE logs -f backend"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              Deployment Summary                            ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}►${NC} Services deployed : ${SERVICES_TO_DEPLOY[*]}"
echo -e "  ${GREEN}►${NC} Method            : $([ "$HAS_ROLLOUT" = true ] && echo "Zero-downtime (docker-rollout)" || echo "Standard restart")"
echo -e "  ${GREEN}►${NC} Duration          : ${DEPLOY_DURATION}s"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    $COMPOSE_CMD -f $COMPOSE_FILE ps          Check container status"
echo -e "    $COMPOSE_CMD -f $COMPOSE_FILE logs -f     Follow logs"
echo -e "    docker stats                               Monitor resource usage"
echo ""
