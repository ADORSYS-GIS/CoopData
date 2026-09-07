#!/usr/bin/env bash
#
# install-git-hooks.sh — Install a git pre-commit hook that runs gitleaks
# secret scanning before every commit.
#
# Two options:
#   1. (Recommended) Install the pre-commit framework hook:
#        ./scripts/install-git-hooks.sh
#      This uses .pre-commit-config.yaml (gitleaks) if pre-commit is available,
#      otherwise falls back to a lightweight native git hook.
#   2. Force the lightweight native git hook (no python/pre-commit needed):
#        ./scripts/install-git-hooks.sh --native
#
# The native hook runs gitleaks on staged files and aborts the commit if any
# secret is detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.githooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"

GITLEAKS_BIN="$(command -v gitleaks || true)"

info()  { echo -e "[install-git-hooks] $*"; }
error() { echo -e "[install-git-hooks] ERROR: $*" >&2; exit 1; }

install_native_hook() {
    mkdir -p "$HOOKS_DIR"

    cat > "$HOOK_FILE" <<'HOOK'
#!/usr/bin/env bash
# Native gitleaks pre-commit hook (installed by scripts/install-git-hooks.sh).
# Runs gitleaks on staged files and blocks the commit if a secret is found.

set -uo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
    echo "pre-commit: gitleaks not found. Install it (https://github.com/gitleaks/gitleaks) or run:"
    echo "  brew install gitleaks   # macOS"
    echo "  go install github.com/gitleaks/gitleaks/v8@latest"
    echo "Skipping secret scan for this commit."
    exit 0
fi

if git diff --cached --quiet; then
    exit 0
fi

echo "pre-commit: scanning staged files for secrets with gitleaks..."
if ! gitleaks protect --staged --verbose --no-banner; then
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
    if [[ "${1:-}" == "--native" ]]; then
        install_native_hook
    else
        install_precommit_framework
    fi

    if [[ -n "$GITLEAKS_BIN" ]]; then
        info "gitleaks found at: $GITLEAKS_BIN"
    else
        info "NOTE: gitleaks is not installed. Install it so the hook can actually scan."
    fi
}

main "$@"
