#!/usr/bin/env bash
# =============================================================================
# CoopData — Backup Wrapper
# Calls the comprehensive production backup script (backup-production.sh)
# which backs up:
#   1. CoopData PostgreSQL Database
#   2. Keycloak IAM Database & Configurations
#   3. MinIO S3 Object Storage Data
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/backup-production.sh" "$@"
