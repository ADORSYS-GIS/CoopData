#!/usr/bin/env bash
#
# load-secrets.sh — Load production secrets from an external secret manager
# and export them as environment variables.
#
# Supported backends (set SECRETS_BACKEND):
#   env   -> (default) no-op. Values already come from the environment / .env.
#   aws   -> fetch a JSON secret from AWS Secrets Manager and export its keys.
#   vault -> fetch a JSON secret from HashiCorp Vault and export its keys.
#
# Usage:
#   source scripts/load-secrets.sh
#
# The script only exports variables that are NOT already set in the environment,
# so explicit env vars always win over secret-manager values.
#
# NEVER log or print secret values.

set -uo pipefail

load_secrets() {
    local backend="${SECRETS_BACKEND:-env}"

    case "$backend" in
        env|"")
            return 0
            ;;
        aws)
            load_secrets_aws
            ;;
        vault)
            load_secrets_vault
            ;;
        *)
            echo "[load-secrets] ERROR: Unknown SECRETS_BACKEND='$backend' (expected: env|aws|vault)" >&2
            return 1
            ;;
    esac
}

# Export every key/value pair from a JSON object as an env var, unless already set.
export_json_secrets() {
    local json="$1"
    local key value
    while IFS=$'\t' read -r key value; do
        [[ -z "$key" ]] && continue
        if [[ -z "${!key:-}" ]]; then
            export "$key=$value"
        fi
    done < <(printf '%s' "$json" | jq -r 'to_entries[] | [.key, (.value|tostring)] | @tsv')
}

load_secrets_aws() {
    if ! command -v aws >/dev/null 2>&1; then
        echo "[load-secrets] ERROR: 'aws' CLI not found. Install the AWS CLI to use SECRETS_BACKEND=aws." >&2
        return 1
    fi

    local secret_id="${AWS_SECRETS_NAME:-}"
    if [[ -z "$secret_id" ]]; then
        echo "[load-secrets] ERROR: SECRETS_BACKEND=aws requires AWS_SECRETS_NAME." >&2
        return 1
    fi

    local region_args=()
    if [[ -n "${AWS_REGION:-}" ]]; then
        region_args=(--region "$AWS_REGION")
    fi

    local json
    if ! json="$(aws secretsmanager get-secret-value "${region_args[@]}" --secret-id "$secret_id" \
        --query SecretString --output text 2>/dev/null)"; then
        echo "[load-secrets] ERROR: Failed to fetch secret '$secret_id' from AWS Secrets Manager." >&2
        return 1
    fi

    export_json_secrets "$json"
}

load_secrets_vault() {
    if ! command -v vault >/dev/null 2>&1; then
        echo "[load-secrets] ERROR: 'vault' CLI not found. Install the Vault CLI to use SECRETS_BACKEND=vault." >&2
        return 1
    fi

    local path="${VAULT_SECRET_PATH:-}"
    if [[ -z "$path" ]]; then
        echo "[load-secrets] ERROR: SECRETS_BACKEND=vault requires VAULT_SECRET_PATH." >&2
        return 1
    fi

    local json
    if ! json="$(vault kv get -format=json "$path" 2>/dev/null)"; then
        echo "[load-secrets] ERROR: Failed to fetch secret at '$path' from Vault." >&2
        return 1
    fi

    # Vault KV v2 wraps data under .data.data; KV v1 under .data. Handle both.
    local payload
    if ! payload="$(printf '%s' "$json" | jq -c '.data.data // .data // .' 2>/dev/null)"; then
        echo "[load-secrets] ERROR: Could not parse Vault secret at '$path'." >&2
        return 1
    fi

    export_json_secrets "$payload"
}

load_secrets
