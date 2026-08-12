#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# CoopData — AWS GPU Ollama Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Run this ON the GPU EC2 instance (e.g. g5.xlarge / g6.xlarge) as root.
#
# Installs:
#   1. NVIDIA driver + CUDA (if not already present)
#   2. Ollama (OpenAI-compatible /v1 endpoint)
#   3. Pulls the production multimodal model (qwen2.5vl:32b)
#   4. Binds Ollama to 0.0.0.0 so the backend can reach it over the VPC
#
# Usage:  sudo ./setup-ollama-gpu.sh [model]
#   Default model: qwen2.5vl:32b
# ═══════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

MODEL="${1:-qwen2.5vl:32b}"

if [[ $EUID -ne 0 ]]; then
    error "Please run as root: sudo ./setup-ollama-gpu.sh"
fi

echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   CoopData — AWS GPU Ollama Setup                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"

# ── 1. Detect GPU ──────────────────────────────────────────────────────────
if command -v nvidia-smi &>/dev/null; then
    ok "NVIDIA driver already present:"
    nvidia-smi --query-gpu=name,memory.total --format=csv
else
    warn "No NVIDIA driver detected. Installing NVIDIA driver + CUDA..."
    # Amazon Linux 2023 / Ubuntu NVIDIA driver install.
    # For a GPU AMI (e.g. "Deep Learning AMI"), the driver is preinstalled and
    # this block is skipped. For a generic AMI, install the driver package.
    if command -v dnf &>/dev/null; then
        dnf install -y kernel-devel-$(uname -r) gcc make
        dnf install -y nvidia-driver-latest-dkms 2>/dev/null \
            || dnf groupinstall -y "NVIDIA" 2>/dev/null \
            || warn "Could not auto-install NVIDIA driver. Install it manually, then reboot."
    elif command -v apt-get &>/dev/null; then
        apt-get update
        apt-get install -y ubuntu-drivers-common
        ubuntu-drivers autoinstall || warn "Driver autoinstall failed. Install manually, then reboot."
    else
        warn "Unknown package manager. Install the NVIDIA driver manually, then reboot."
    fi
    warn "A REBOOT is required after installing the NVIDIA driver."
    warn "Re-run this script after rebooting to continue."
    exit 0
fi

# ── 2. Install Ollama ──────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
    ok "Ollama already installed: $(ollama --version)"
else
    info "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    ok "Ollama installed."
fi

# ── 3. Bind Ollama to 0.0.0.0 (so the backend can reach it over the VPC) ──
# The systemd unit reads OLLAMA_HOST. Set it to listen on all interfaces.
SERVICE="/etc/systemd/system/ollama.service"
if [[ -f "$SERVICE" ]] && ! grep -q "OLLAMA_HOST" "$SERVICE"; then
    info "Configuring Ollama to listen on 0.0.0.0:11434..."
    # Insert Environment=OLLAMA_HOST=0.0.0.0 into the [Service] section.
    sed -i '/^\[Service\]/a Environment=OLLAMA_HOST=0.0.0.0:11434' "$SERVICE"
    systemctl daemon-reload
    systemctl restart ollama
    ok "Ollama now listening on 0.0.0.0:11434."
else
    info "Ollama already configured to listen on 0.0.0.0."
fi

# ── 4. Pull the production model ───────────────────────────────────────────
info "Pulling model: ${MODEL} (this downloads several GB, may take a while)..."
ollama pull "$MODEL"
ok "Model pulled: ${MODEL}"

# ── 5. Verify ──────────────────────────────────────────────────────────────
info "Verifying Ollama is serving the OpenAI-compatible endpoint..."
sleep 2
curl -sf http://localhost:11434/v1/models >/dev/null \
    && ok "Ollama endpoint healthy: http://localhost:11434/v1" \
    || warn "Ollama endpoint not responding yet — check 'systemctl status ollama'."

PUBLIC_IP="$(curl -sf http://checkip.amazonaws.com 2>/dev/null || echo '<instance-ip>')"
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Point the CoopData backend at this instance by setting in .env:"
echo "  AI_PROVIDER_URL=http://${PUBLIC_IP}:11434/v1"
echo "  AI_MODEL=${MODEL}"
echo "  AI_VISION_MODEL=${MODEL}"
echo "  AI_API_KEY=ollama"
echo ""
echo "SECURITY: restrict port 11434 to the backend's security group / VPC."
echo "Do NOT expose it to the public internet."
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
