#!/usr/bin/env bash
#
# install-git-hooks.sh — Install a git pre-commit hook that runs gitleaks
# secret scanning before every commit.
#
# This script automatically installs gitleaks if it is not already present
# (downloads the official prebuilt binary from GitHub releases).
#
# Options:
#   ./scripts/install-git-hooks.sh          Install (auto-installs gitleaks if needed)
#   ./scripts/install-git-hooks.sh --native Force the lightweight native git hook
#                                           (no python/pre-commit needed)
#
# The native hook runs gitleaks on staged files and aborts the commit if any
# secret is detected. If gitleaks is missing at commit time, the hook will
# attempt to auto-install it as well.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.githooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"

GITLEAKS_VERSION="8.21.2"
GITLEAKS_INSTALL_DIR="${GITLEAKS_INSTALL_DIR:-$HOME/.local/bin}"

info()  { echo -e "[install-git-hooks] $*"; }
error() { echo -e "[install-git-hooks] ERROR: $*" >&2; exit 1; }

# Download the official gitleaks prebuilt binary for the current OS/arch.
install_gitleaks() {
    local os arch
    case "$(uname -s)" in
        Linux)  os="linux" ;;
        Darwin) os="darwin" ;;
        *) error "Unsupported OS for auto-install: $(uname -s). Install gitleaks manually (https://github.com/gitleaks/gitleaks)." ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) error "Unsupported architecture for auto-install: $(uname -m). Install gitleaks manually." ;;
    esac

    mkdir -p "$GITLEAKS_INSTALL_DIR"
    local url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz"
    local tmp
    tmp="$(mktemp -d)"

    info "gitleaks not found — downloading v${GITLEAKS_VERSION} (${os}_${arch})..."
    if command -v curl >/dev/null 2>&1; then
        if ! curl -fsSL "$url" -o "$tmp/gitleaks.tar.gz"; then
            rm -rf "$tmp"
            error "Failed to download gitleaks from $url. Install it manually."
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -q "$url" -O "$tmp/gitleaks.tar.gz"; then
            rm -rf "$tmp"
            error "Failed to download gitleaks from $url. Install it manually."
        fi
    else
        rm -rf "$tmp"
        error "Neither curl nor wget is available. Install gitleaks manually."
    fi

    tar -xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
    install -m 0755 "$tmp/gitleaks" "$GITLEAKS_INSTALL_DIR/gitleaks"
    rm -rf "$tmp"
    info "Installed gitleaks to $GITLEAKS_INSTALL_DIR/gitleaks"
}

# Ensure gitleaks is available; returns its path in GITLEAKS_BIN.
ensure_gitleaks() {
    if command -v gitleaks >/dev/null 2>&1; then
        GITLEAKS_BIN="$(command -v gitleaks)"
        return 0
    fi
    if [[ -x "$GITLEAKS_INSTALL_DIR/gitleaks" ]]; then
        GITLEAKS_BIN="$GITLEAKS_INSTALL_DIR/gitleaks"
        return 0
    fi
    install_gitleaks
    GITLEAKS_BIN="$GITLEAKS_INSTALL_DIR/gitleaks"
}

install_native_hook() {
    mkdir -p "$HOOKS_DIR"

    cat > "$HOOK_FILE" <<'HOOK'
#!/usr/bin/env bash
# Native gitleaks pre-commit hook (installed by scripts/install-git-hooks.sh).
# Runs gitleaks on staged files and blocks the commit if a secret is found.
# If gitleaks is missing, it is auto-installed.

set -uo pipefail

GITLEAKS_VERSION="8.21.2"
GITLEAKS_INSTALL_DIR="${GITLEAKS_INSTALL_DIR:-$HOME/.local/bin}"

find_gitleaks() {
    if command -v gitleaks >/dev/null 2>&1; then
        echo "$(command -v gitleaks)"
        return 0
    fi
    if [[ -x "$GITLEAKS_INSTALL_DIR/gitleaks" ]]; then
        echo "$GITLEAKS_INSTALL_DIR/gitleaks"
        return 0
    fi
    return 1
}

auto_install_gitleaks() {
    local os arch
    case "$(uname -s)" in
        Linux)  os="linux" ;;
        Darwin) os="darwin" ;;
        *) echo "pre-commit: unsupported OS for auto-install. Install gitleaks manually." >&2; return 1 ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) echo "pre-commit: unsupported arch for auto-install. Install gitleaks manually." >&2; return 1 ;;
    esac

    mkdir -p "$GITLEAKS_INSTALL_DIR"
    local url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz"
    local tmp
    tmp="$(mktemp -d)"

    echo "pre-commit: gitleaks not found — downloading v${GITLEAKS_VERSION}..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$tmp/gitleaks.tar.gz" || { rm -rf "$tmp"; return 1; }
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$url" -O "$tmp/gitleaks.tar.gz" || { rm -rf "$tmp"; return 1; }
    else
        rm -rf "$tmp"
        return 1
    fi
    tar -xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
    install -m 0755 "$tmp/gitleaks" "$GITLEAKS_INSTALL_DIR/gitleaks"
    rm -rf "$tmp"
    echo "pre-commit: installed gitleaks to $GITLEAKS_INSTALL_DIR/gitleaks"
}

GITLEAKS_BIN="$(find_gitleaks || true)"
if [[ -z "$GITLEAKS_BIN" ]]; then
    if ! auto_install_gitleaks; then
        echo "pre-commit: could not auto-install gitleaks. Skipping secret scan for this commit." >&2
        exit 0
    fi
    GITLEAKS_BIN="$(find_gitleaks || true)"
fi

if git diff --cached --quiet; then
    exit 0
fi

echo "pre-commit: scanning staged files for secrets with gitleaks..."
if ! "$GITLEAKS_BIN" protect --staged --verbose --no-banner; then
    echo "pre-commit: SECRET DETECTED — commit blocked."
    echo "Remove the secret, or if it is a false positive, add it to .gitleaks.toml allowlist."
    exit 1
fi
exit 0
HOOK

    chmod +x "$HOOK_FILE"
    git -C "$REPO_ROOT" config core.hooksPath "$HOOKS_DIR"
    info "Installed native gitleaks pre-commit hook at $HOOK_FILE"
    info "Configured core.hooksPath=$HOOKS_DIR"
}

install_precommit_framework() {
    if ! command -v pre-commit >/dev/null 2>&1; then
        info "pre-commit framework not installed — falling back to native git hook."
        install_native_hook
        return
    fi
    (cd "$REPO_ROOT" && pre-commit install)
    info "Installed pre-commit framework hook (gitleaks via .pre-commit-config.yaml)."
}

main() {
    ensure_gitleaks
    info "gitleaks ready at: $GITLEAKS_BIN"

    if [[ "${1:-}" == "--native" ]]; then
        install_native_hook
    else
        install_precommit_framework
    fi
}

main "$@"
