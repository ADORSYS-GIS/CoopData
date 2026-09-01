#!/usr/bin/env bash
# =============================================================================
# CoopData — Install docker-rollout CLI Plugin
# =============================================================================
# docker-rollout enables zero-downtime rolling deployments for Docker Compose.
# https://github.com/Wowu/docker-rollout
#
# After installation:
#   docker rollout -f docker-compose.ghcr.yaml backend
#   docker rollout -f docker-compose.ghcr.yaml frontend
# =============================================================================
set -euo pipefail

PLUGIN_DIR="${HOME}/.docker/cli-plugins"
PLUGIN_PATH="${PLUGIN_DIR}/docker-rollout"
ROLLOUT_URL="https://raw.githubusercontent.com/wowu/docker-rollout/main/docker-rollout"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

if [[ -x "$PLUGIN_PATH" ]]; then
    CURRENT_VERSION=$(docker rollout --version 2>/dev/null || echo "unknown")
    ok "docker-rollout is already installed (${CURRENT_VERSION})"
    ok "Plugin path: ${PLUGIN_PATH}"
    exit 0
fi

info "Installing docker-rollout to ${PLUGIN_PATH}..."

mkdir -p "$PLUGIN_DIR"

if command -v curl &>/dev/null; then
    curl -fsSL "$ROLLOUT_URL" -o "$PLUGIN_PATH"
elif command -v wget &>/dev/null; then
    wget -qO "$PLUGIN_PATH" "$ROLLOUT_URL"
else
    echo "ERROR: Neither curl nor wget found. Please install one." >&2
    exit 1
fi

chmod +x "$PLUGIN_PATH"

if ! docker rollout --version &>/dev/null; then
    echo "ERROR: Installation failed — 'docker rollout --version' did not succeed." >&2
    rm -f "$PLUGIN_PATH"
    exit 1
fi

VERSION=$(docker rollout --version 2>/dev/null || echo "installed")
ok "docker-rollout installed successfully (${VERSION})"
echo ""
echo "  Usage:"
echo "    docker rollout -f docker-compose.ghcr.yaml backend"
echo "    docker rollout -f docker-compose.ghcr.yaml frontend"
echo ""
warn "Requirements for zero-downtime rollout:"
echo "  1. Service must have a healthcheck defined in docker-compose.ghcr.yaml"
echo "  2. Service must NOT have container_name set (backend/frontend comply)"
echo "  3. Nginx reverse proxy must be routing traffic (already configured)"
echo ""
