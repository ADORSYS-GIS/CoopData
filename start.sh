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

PROMPT_RESULT=""

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

check_command() {
    local name="$1"
    local cmd="$2"
    local min_version="${3:-}"
    if ! command -v "$cmd" &>/dev/null; then
        error "$name is not installed. Please install it first: https://docs.docker.com/get-docker/"
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

check_port() {
    local port="$1"
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       lsof -i :"$port" 2>/dev/null | grep -q LISTEN; then
        return 1
    fi
    return 0
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
echo -e "${BOLD}║         CoopData — Startup Script                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

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

check_command "Git" "git"

RUNNING_CONTAINERS=$($COMPOSE_CMD ps -q 2>/dev/null | wc -l || true)

if [[ "$RUNNING_CONTAINERS" -gt 0 ]]; then
    warn "CoopData is already running ($RUNNING_CONTAINERS container(s) active)."
    echo ""
    $COMPOSE_CMD ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || $COMPOSE_CMD ps
    echo ""

    prompt_choice "What would you like to do?" \
        "Restart (stop, rebuild, and start fresh)" \
        "Stop and remove everything (including data volumes)" \
        "Rebuild and start (keep data volumes)" \
        "Cancel — leave everything as is"

    case $PROMPT_RESULT in
        0)
            info "Stopping all services..."
            $COMPOSE_CMD down
            ok "Services stopped (data preserved)"
            ;;
        1)
            warn "This will DELETE all data (database, cache, Keycloak state)."
            echo -ne "${RED}${BOLD}Type 'yes' to confirm:${NC} "
            read -r confirm
            if [[ "$confirm" != "yes" ]]; then
                info "Aborted. Leaving everything running."
                exit 0
            fi
            info "Stopping and removing all data..."
            $COMPOSE_CMD down -v
            ok "All services and data removed"
            ;;
        2)
            info "Stopping services (keeping data)..."
            $COMPOSE_CMD down
            ok "Services stopped (data preserved)"
            ;;
        3)
            info "Leaving everything as is. Bye!"
            exit 0
            ;;
    esac
fi

info "Checking ports..."
PORTS_IN_USE=0
for port in 3000 5432 6379 8180; do
    if ! check_port "$port"; then
        warn "Port $port is already in use."
        PORTS_IN_USE=$((PORTS_IN_USE + 1))
    fi
done

if [[ $PORTS_IN_USE -gt 0 ]]; then
    warn "$PORTS_IN_USE port(s) in use by other processes."
    echo -e "       Press Ctrl+C to abort, or wait 5 seconds to continue..."
    sleep 5
fi

info "Creating .env from .env.example if it does not exist..."
if [[ ! -f backend/.env ]]; then
    cp backend/.env.example backend/.env
    ok "Created backend/.env from .env.example"
else
    ok "backend/.env already exists — keeping it"
fi

info "Pulling Docker images..."
$COMPOSE_CMD pull 2>/dev/null || true

info "Building containers..."
$COMPOSE_CMD build

info "Starting CoopData stack..."
$COMPOSE_CMD up -d

info "Waiting for services to become healthy..."
MAX_WAIT=120
ELAPSED=0
ALL_HEALTHY=false

while (( ELAPSED < MAX_WAIT )); do
    POSTGRES_UP=false
    REDIS_UP=false
    KEYCLOAK_UP=false
    BACKEND_UP=false

    if $COMPOSE_CMD ps postgres 2>/dev/null | grep -q "healthy"; then
        POSTGRES_UP=true
    fi
    if $COMPOSE_CMD ps redis 2>/dev/null | grep -q "healthy"; then
        REDIS_UP=true
    fi
    if $COMPOSE_CMD ps keycloak 2>/dev/null | grep -q "healthy"; then
        KEYCLOAK_UP=true
    fi
    if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
        BACKEND_UP=true
    fi

    if $POSTGRES_UP && $REDIS_UP && $KEYCLOAK_UP && $BACKEND_UP; then
        ALL_HEALTHY=true
        break
    fi

    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -e "  ${YELLOW}⏳${NC} Waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
done

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           CoopData is Running!                   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}►${NC}  Frontend:       ${CYAN}http://localhost:5174${NC}"
echo -e "  ${GREEN}►${NC}  Backend API:    ${CYAN}http://localhost:3000/api/v1${NC}"
echo -e "  ${GREEN}►${NC}  Swagger UI:     ${CYAN}http://localhost:3000/swagger-ui/${NC}"
echo -e "  ${GREEN}►${NC}  Keycloak Admin: ${CYAN}http://localhost:8180${NC}"
echo -e "                   Username: admin  Password: (from .env)"
echo -e "  ${GREEN}►${NC}  PostgreSQL:     ${CYAN}localhost:5432${NC} (coopdata / password)"
echo -e "  ${GREEN}►${NC}  Redis:           ${CYAN}localhost:6379${NC}"
echo ""

if [[ "$ALL_HEALTHY" == false ]]; then
    warn "Not all services became healthy within ${MAX_WAIT}s."
    info "Check status with: $COMPOSE_CMD ps"
    info "Check logs with:   $COMPOSE_CMD logs -f <service>"
else
    ok "All services are healthy"
fi

echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    $COMPOSE_CMD logs -f          Follow all logs"
echo -e "    $COMPOSE_CMD logs -f backend  Follow backend logs"
echo -e "    $COMPOSE_CMD down             Stop all services (keep data)"
echo -e "    $COMPOSE_CMD down -v           Stop and remove volumes (data loss!)"
echo ""