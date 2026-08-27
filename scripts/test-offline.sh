#!/usr/bin/env bash
set -euo pipefail

# CoopData - Offline Testing Script
# The DEV environment (./start.sh / Vite dev server) CANNOT test offline -
# its service worker doesn't precache the app shell.
#
# This script builds the PRODUCTION frontend (which precaches everything) and
# serves it via `vite preview` so you can test offline.
#
# Usage:  ./scripts/test-offline.sh

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
FRONTEND_DIR="$ROOT_DIR/frontend"
cd "$ROOT_DIR"

# Start the backend stack (if not already running)
if ! curl -sf --max-time 5 http://localhost:3000/api/v1/health >/dev/null 2>&1; then
    info "Backend not running. Starting backend stack via docker compose..."
    docker compose up -d backend postgres redis keycloak minio
    info "Waiting for backend to become healthy..."
    for i in $(seq 1 60); do
        if curl -sf --max-time 3 http://localhost:3000/api/v1/health >/dev/null 2>&1; then
            ok "Backend is healthy"
            break
        fi
        sleep 3
    done
fi

# Free port 5173 (dev container + any leftover preview process)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'coopdata-frontend-dev'; then
    info "Stopping dev frontend container (frees port 5173)..."
    docker stop coopdata-frontend-dev >/dev/null 2>&1 || true
fi
if command -v lsof >/dev/null 2>&1; then
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
fi
sleep 1

cd "$FRONTEND_DIR"

# Build production frontend
info "Building production frontend (this precaches the app shell for offline)..."
if ! npm run build; then
    echo -e "${RED}[ERROR]${NC} Build failed."
    exit 1
fi
ok "Build complete"

# Serve via preview
info "Serving production build on http://localhost:5173"
info "Press Ctrl+C to stop."
echo ""
echo -e "${GREEN}TESTING OFFLINE:${NC}"
echo "  1. Open http://localhost:5173 and log in (let it fully load)"
echo "  2. DevTools -> Application -> Service Workers -> Unregister (clear old SW)"
echo "  3. Reload online, then DevTools -> Network -> check 'Offline'"
echo "  4. Refresh -> app loads from cache (no error page)"
echo ""

npm run preview -- --port 5173 --host 0.0.0.0 --strictPort
