#!/usr/bin/env bash
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROD_COMPOSE="docker-compose.ghcr.yaml"

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

check_command() {
    local name="$1"
    local cmd="$2"
    local min_version="${3:-}"
    if ! command -v "$cmd" &>/dev/null; then
        error "$name is not installed. Please install it first."
    fi
    if [[ -n "$min_version" ]]; then
        local version
        version=$("$cmd" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
        if [[ -n "$version" ]]; then
            local major="${version%%.*}"
            local minor="${version#*.}"
            local req_major="${min_version%%.*}"
            local req_minor="${min_version#*.}"
            if (( major < req_major || (major == req_major && minor < req_minor) )); then
                error "$name version $version is too old. Minimum required: $min_version"
            fi
        fi
    fi
    ok "$name is installed"
}

prompt_choice() {
    local prompt="$1"
    shift
    local options=("$@")
    local count=${#options[@]}

    echo -e "\n${BOLD}${prompt}${NC}"
    local i=1
    for opt in "${options[@]}"; do
        echo -e "  ${CYAN}${i})${NC} ${opt}"
        i=$((i + 1))
    done
    echo -ne "\n${BOLD}Enter choice [1-${count}]:${NC} "

    local choice
    read -r choice
    while ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > count )); do
        echo -ne "Invalid. Enter a number 1-${count}: "
        read -r choice
    done
    echo ""
    PROMPT_RESULT=$((choice - 1))
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     CoopData — Production Startup (GHCR)        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────
info "Checking prerequisites..."

check_command "Docker" "docker" "24.0"

if ! docker compose version &>/dev/null; then
    if ! docker-compose version &>/dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose V2."
    fi
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi
ok "Docker Compose is available (using: $COMPOSE_CMD)"

if [[ ! -f "$PROD_COMPOSE" ]]; then
    error "Production compose file '$PROD_COMPOSE' not found in $SCRIPT_DIR"
fi
ok "Found $PROD_COMPOSE"

# ── .env Check ─────────────────────────────────────────────────────────────
info "Checking .env configuration..."

if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        warn "Created .env from .env.example"
        warn "You MUST edit .env with production values before continuing!"
        echo -ne "\n${BOLD}Have you edited the .env file? [y/N]:${NC} "
        read -r edited
        if [[ "$edited" != "y" && "$edited" != "Y" ]]; then
            info "Please edit .env now: nano .env"
            info "Then re-run this script."
            exit 0
        fi
    else
        error "No .env or .env.example found. Cannot continue."
    fi
else
    ok ".env file exists"

    if grep -q "change-me-in-production" .env 2>/dev/null; then
        warn "Your .env still contains default placeholder passwords!"
        warn "Generate strong secrets with: openssl rand -base64 32"
        echo -ne "\n${BOLD}Continue anyway? [y/N]:${NC} "
        read -r continue_anyway
        if [[ "$continue_anyway" != "y" && "$continue_anyway" != "Y" ]]; then
            info "Please update .env with strong production passwords."
            info "Then re-run this script."
            exit 0
        fi
    fi
fi

# ── Running Containers Check ──────────────────────────────────────────────
RUNNING_CONTAINERS=$($COMPOSE_CMD -f "$PROD_COMPOSE" ps -q 2>/dev/null | wc -l || true)

if [[ "$RUNNING_CONTAINERS" -gt 0 ]]; then
    warn "CoopData is already running ($RUNNING_CONTAINERS container(s) active)."
    echo ""
    $COMPOSE_CMD -f "$PROD_COMPOSE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || $COMPOSE_CMD -f "$PROD_COMPOSE" ps
    echo ""

    prompt_choice "What would you like to do?" \
        "Restart (stop and start fresh — pull latest images)" \
        "Stop and remove containers (keep data volumes)" \
        "Stop and remove everything (DANGER: deletes all data)" \
        "Cancel — leave everything as is"

    case $PROMPT_RESULT in
        0)
            info "Stopping all services..."
            $COMPOSE_CMD -f "$PROD_COMPOSE" down
            ok "Services stopped (data preserved)"
            ;;
        1)
            info "Stopping services (keeping data)..."
            $COMPOSE_CMD -f "$PROD_COMPOSE" down
            ok "Services stopped (data preserved)"
            ;;
        2)
            warn "This will DELETE all data (database, cache, Keycloak state, MinIO)."
            echo -ne "${RED}${BOLD}Type 'yes' to confirm:${NC} "
            read -r confirm
            if [[ "$confirm" != "yes" ]]; then
                info "Aborted. Leaving everything running."
                exit 0
            fi
            info "Stopping and removing all data..."
            $COMPOSE_CMD -f "$PROD_COMPOSE" down -v
            ok "All services and data removed"
            ;;
        3)
            info "Leaving everything as is. Bye!"
            exit 0
            ;;
    esac
fi

# ── Pull Images ────────────────────────────────────────────────────────────
info "Pulling pre-built images from GHCR..."
$COMPOSE_CMD -f "$PROD_COMPOSE" pull
ok "All images pulled"

# ── Start Services ─────────────────────────────────────────────────────────
info "Starting CoopData production stack..."
$COMPOSE_CMD -f "$PROD_COMPOSE" up -d --no-build
ok "Services started"

# ── Wait for Health ────────────────────────────────────────────────────────
info "Waiting for core services to become healthy..."
MAX_WAIT=180
ELAPSED=0
ALL_HEALTHY=false

while (( ELAPSED < MAX_WAIT )); do
    POSTGRES_UP=false
    REDIS_UP=false
    MINIO_UP=false
    KEYCLOAK_UP=false
    BACKEND_UP=false

    if $COMPOSE_CMD -f "$PROD_COMPOSE" ps postgres 2>/dev/null | grep -q "healthy"; then
        POSTGRES_UP=true
    fi
    if $COMPOSE_CMD -f "$PROD_COMPOSE" ps redis 2>/dev/null | grep -q "healthy"; then
        REDIS_UP=true
    fi
    if $COMPOSE_CMD -f "$PROD_COMPOSE" ps minio 2>/dev/null | grep -q "healthy"; then
        MINIO_UP=true
    fi
    if $COMPOSE_CMD -f "$PROD_COMPOSE" ps keycloak 2>/dev/null | grep -q "healthy"; then
        KEYCLOAK_UP=true
    fi
    if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
        BACKEND_UP=true
    fi

    if $POSTGRES_UP && $REDIS_UP && $MINIO_UP && $KEYCLOAK_UP && $BACKEND_UP; then
        ALL_HEALTHY=true
        break
    fi

    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -e "  ${YELLOW}⏳${NC} Waiting... [PG: $([ "$POSTGRES_UP" = true ] && echo "OK" || echo ".."), Redis: $([ "$REDIS_UP" = true ] && echo "OK" || echo ".."), MinIO: $([ "$MINIO_UP" = true ] && echo "OK" || echo ".."), KC: $([ "$KEYCLOAK_UP" = true ] && echo "OK" || echo ".."), API: $([ "$BACKEND_UP" = true ] && echo "OK" || echo "..")] (${ELAPSED}s / ${MAX_WAIT}s)"
done

if [[ "$ALL_HEALTHY" == false ]]; then
    warn "Not all services became healthy within ${MAX_WAIT}s."
    info "Check status with: $COMPOSE_CMD -f $PROD_COMPOSE ps"
    info "Check logs with:   $COMPOSE_CMD -f $PROD_COMPOSE logs -f <service>"
else
    ok "All core services are healthy"
fi

# ── Keycloak Provisioning ─────────────────────────────────────────────────
info "Verifying Keycloak provisioning..."
PROVISION_WAIT=90
PROVISION_ELAPSED=0
PROVISION_SUCCESS=false

while (( PROVISION_ELAPSED < PROVISION_WAIT )); do
    STATUS=$(docker inspect -f '{{.State.Status}}' coopdata-keycloak-provision 2>/dev/null || echo "not-found")
    if [[ "$STATUS" == "exited" ]]; then
        EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' coopdata-keycloak-provision 2>/dev/null || echo "1")
        if [[ "$EXIT_CODE" == "0" ]]; then
            PROVISION_SUCCESS=true
            break
        else
            warn "Keycloak provisioning exited with code $EXIT_CODE. Check: docker logs coopdata-keycloak-provision"
            PROVISION_SUCCESS=true
            break
        fi
    elif [[ "$STATUS" == "not-found" ]]; then
        PROVISION_SUCCESS=true
        break
    fi
    sleep 3
    PROVISION_ELAPSED=$((PROVISION_ELAPSED + 3))
    echo -e "  ${YELLOW}⏳${NC} Waiting for Keycloak provisioning... (${PROVISION_ELAPSED}s / ${PROVISION_WAIT}s)"
done

if [[ "$PROVISION_SUCCESS" == true ]]; then
    ok "Keycloak provisioning completed"
else
    warn "Keycloak provisioning is taking longer than expected."
fi

# ── Determine Domain ──────────────────────────────────────────────────────
DOMAIN="localhost"
if [[ -f .env ]]; then
    FRONTEND_URL=$(grep -E "^FRONTEND_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's|https\?://||' | sed 's|/.*||')
    if [[ -n "$FRONTEND_URL" ]]; then
        DOMAIN="$FRONTEND_URL"
    fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔═════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              CoopData Production is Running!                            ║${NC}"
echo -e "${BOLD}╚═════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}►${NC}  Frontend App:     ${CYAN}https://${DOMAIN}${NC}"
echo -e "  ${GREEN}►${NC}  Backend API:      ${CYAN}https://${DOMAIN}/api/v1${NC}"
echo -e "  ${GREEN}►${NC}  Swagger UI:       ${CYAN}https://${DOMAIN}/swagger-ui/${NC}"
echo -e "  ${GREEN}►${NC}  Keycloak Console: ${CYAN}https://${DOMAIN}/auth/admin${NC}"
echo -e "  ${GREEN}►${NC}  Health Check:     ${CYAN}https://${DOMAIN}/api/v1/health${NC}"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    $COMPOSE_CMD -f $PROD_COMPOSE logs -f          Follow all logs"
echo -e "    $COMPOSE_CMD -f $PROD_COMPOSE logs -f backend  Follow backend logs"
echo -e "    $COMPOSE_CMD -f $PROD_COMPOSE ps               Check service status"
echo -e "    $COMPOSE_CMD -f $PROD_COMPOSE down             Stop (keep data)"
echo -e "    $COMPOSE_CMD -f $PROD_COMPOSE down -v          Stop + DELETE data"
echo ""
echo -e "  ${GREEN}►${NC}  Test: curl -sf https://${DOMAIN}/api/v1/health"
echo ""