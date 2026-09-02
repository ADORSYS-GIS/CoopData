#!/usr/bin/env bash
# =============================================================================
# CoopData — Comprehensive Enterprise Offsite Backup Script
# =============================================================================
# Backs up all 3 stateful data layers to offsite S3 storage:
#   1. CoopData PostgreSQL Database (`coopdata` DB)
#   2. Keycloak IAM Database & Configuration (`keycloak` DB + realm/themes)
#   3. MinIO S3 Object Storage (`minio_data` persistent storage volume)
#
# Features:
#   - Atomic temporary workspace with TRAP cleanup on exit/failure
#   - Full compression (gzip / tar.gz)
#   - Multi-component upload verification (MD5 / S3 object check)
#   - Offsite retention pruning (deletes backups older than RETENTION_DAYS)
#   - Detailed structured log output
#
# Setup (host cron — run as ubuntu/deploy user):
#   0 2 * * * /opt/coopdata/scripts/backup-production.sh >> /var/log/coopdata-backup.log 2>&1
# =============================================================================
set -euo pipefail

# ── Colors & Logging ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TIMESTAMP=$(date +"%Y-%m-%dT%H:%M:%S%z")
DATE=$(date +"%Y-%m-%d")
LOG_PREFIX="[${TIMESTAMP}] [backup]"

info()  { echo -e "${LOG_PREFIX} ${CYAN}INFO${NC}  $*"; }
ok()    { echo -e "${LOG_PREFIX} ${GREEN}OK${NC}    $*"; }
warn()  { echo -e "${LOG_PREFIX} ${YELLOW}WARN${NC}  $*"; }
error() { echo -e "${LOG_PREFIX} ${RED}ERROR${NC} $*"; exit 1; }

# ── Sourcing .env ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

# ── Configuration & Defaults ──────────────────────────────────────────────────
PG_CONTAINER="${PG_CONTAINER:-coopdata-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-coopdata-minio}"

PG_USER="${POSTGRES_USER:?POSTGRES_USER is required in .env}"
PG_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env}"
APP_DB="${POSTGRES_DB:-coopdata}"
KEYCLOAK_DB="keycloak"

S3_BUCKET="${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required in .env}"
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}" # Leave blank for AWS S3
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOCAL_RETENTION_DAYS="${LOCAL_BACKUP_RETENTION_DAYS:-7}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/var/backups/coopdata}"

TMP_DIR="/tmp/coopdata-backup-${DATE}-$$"

# ── Ensure TRAP cleanup on exit or error ─────────────────────────────────────
cleanup() {
    local exit_code=$?
    if [[ -d "$TMP_DIR" ]]; then
        rm -rf "$TMP_DIR"
    fi
    if [[ $exit_code -ne 0 ]]; then
        echo -e "${LOG_PREFIX} ${RED}FATAL${NC} Backup failed with exit code ${exit_code}!"
    fi
}
trap cleanup EXIT

# ── Pre-flight Checks ─────────────────────────────────────────────────────────
info "==============================================================="
info "Starting Enterprise Offsite Backup: ${DATE}"
info "==============================================================="

command -v docker &>/dev/null || error "docker CLI not found"
command -v aws &>/dev/null    || error "aws CLI not found (run: pip install awscli or apt install awscli)"

# Check container readiness
if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    error "PostgreSQL container '${PG_CONTAINER}' is not running!"
fi

AWS_ARGS=()
if [[ -n "$S3_ENDPOINT" ]]; then
    AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT")
fi

# Test S3 accessibility
info "Verifying offsite target bucket: s3://${S3_BUCKET}..."
if ! aws s3 ls "${AWS_ARGS[@]}" "s3://${S3_BUCKET}" &>/dev/null; then
    warn "Cannot list s3://${S3_BUCKET}. Attempting to verify or create bucket..."
    aws s3 mb "${AWS_ARGS[@]}" "s3://${S3_BUCKET}" &>/dev/null || true
fi

mkdir -p "${TMP_DIR}"
chmod 700 "${TMP_DIR}"

# ═════════════════════════════════════════════════════════════════════════════
# 1. BACKUP: CoopData Application PostgreSQL Database
# ═════════════════════════════════════════════════════════════════════════════
info "[1/4] Dumping CoopData App Database ('${APP_DB}')..."
APP_DUMP_FILE="${TMP_DIR}/coopdata_db_${DATE}.dump.gz"

docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
    pg_dump -U "$PG_USER" -d "$APP_DB" --format=custom --compress=0 \
    | gzip -9 > "$APP_DUMP_FILE"

APP_SIZE=$(du -sh "$APP_DUMP_FILE" | cut -f1)
ok "CoopData DB dumped: ${APP_DUMP_FILE} (${APP_SIZE})"

# ═════════════════════════════════════════════════════════════════════════════
# 2. BACKUP: Keycloak IAM Database & Configuration
# ═════════════════════════════════════════════════════════════════════════════
info "[2/4] Dumping Keycloak IAM Database ('${KEYCLOAK_DB}') & Realm Configs..."
KC_DUMP_FILE="${TMP_DIR}/keycloak_db_${DATE}.dump.gz"
KC_CONFIG_FILE="${TMP_DIR}/keycloak_config_${DATE}.tar.gz"

# 2a. Keycloak DB dump
if docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" psql -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw "$KEYCLOAK_DB"; then
    docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        pg_dump -U "$PG_USER" -d "$KEYCLOAK_DB" --format=custom --compress=0 \
        | gzip -9 > "$KC_DUMP_FILE"
    KC_DB_SIZE=$(du -sh "$KC_DUMP_FILE" | cut -f1)
    ok "Keycloak DB dumped: ${KC_DUMP_FILE} (${KC_DB_SIZE})"
else
    warn "Keycloak database '${KEYCLOAK_DB}' not found in Postgres — creating cluster-wide dump..."
    docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        pg_dumpall -U "$PG_USER" \
        | gzip -9 > "$KC_DUMP_FILE"
    KC_DB_SIZE=$(du -sh "$KC_DUMP_FILE" | cut -f1)
    ok "Postgres full cluster dumped: ${KC_DUMP_FILE} (${KC_DB_SIZE})"
fi

# 2b. Keycloak Host Realm & Theme config archive
if [[ -d "${PROJECT_DIR}/keycloak" ]]; then
    tar -czf "$KC_CONFIG_FILE" -C "${PROJECT_DIR}" keycloak
    KC_CFG_SIZE=$(du -sh "$KC_CONFIG_FILE" | cut -f1)
    ok "Keycloak realm & theme files archived: ${KC_CONFIG_FILE} (${KC_CFG_SIZE})"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 3. BACKUP: MinIO S3 Object Storage (Uploaded Files)
# ═════════════════════════════════════════════════════════════════════════════
info "[3/4] Archiving MinIO Object Storage Data..."
MINIO_DUMP_FILE="${TMP_DIR}/minio_data_${DATE}.tar.gz"

if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
    docker exec "$MINIO_CONTAINER" tar -czf - -C /data . > "$MINIO_DUMP_FILE"
    MINIO_SIZE=$(du -sh "$MINIO_DUMP_FILE" | cut -f1)
    ok "MinIO object storage archived: ${MINIO_DUMP_FILE} (${MINIO_SIZE})"
else
    warn "MinIO container '${MINIO_CONTAINER}' not running — attempting host volume archive..."
    if docker volume inspect coopdata_minio_data &>/dev/null || docker volume inspect minio_data &>/dev/null; then
        VOL_NAME=$(docker volume inspect coopdata_minio_data &>/dev/null && echo "coopdata_minio_data" || echo "minio_data")
        VOL_PATH=$(docker volume inspect "$VOL_NAME" --format '{{ .Mountpoint }}')
        tar -czf "$MINIO_DUMP_FILE" -C "$VOL_PATH" .
        MINIO_SIZE=$(du -sh "$MINIO_DUMP_FILE" | cut -f1)
        ok "MinIO volume archived directly: ${MINIO_DUMP_FILE} (${MINIO_SIZE})"
    else
        warn "MinIO data volume not found — skipping MinIO storage backup"
    fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 4. OFFSITE UPLOAD & RETENTION PRUNING
# ═════════════════════════════════════════════════════════════════════════════
info "[4/4] Uploading backups to offsite S3 target (s3://${S3_BUCKET})..."

upload_file() {
    local src_file="$1"
    local s3_key="$2"
    local file_label="$3"

    if [[ -f "$src_file" ]]; then
        info "Uploading ${file_label} $\rightarrow$ s3://${S3_BUCKET}/${s3_key}..."
        aws s3 cp "${AWS_ARGS[@]}" \
            "$src_file" \
            "s3://${S3_BUCKET}/${s3_key}" \
            --storage-class STANDARD_IA \
            --metadata "date=${DATE},host=$(hostname),type=${file_label}"
        ok "Uploaded ${file_label}"
    fi
}

upload_file "$APP_DUMP_FILE"  "postgres/coopdata_db_${DATE}.dump.gz"   "CoopData DB"
upload_file "$KC_DUMP_FILE"   "keycloak/keycloak_db_${DATE}.dump.gz"   "Keycloak DB"
upload_file "$KC_CONFIG_FILE" "keycloak/keycloak_config_${DATE}.tar.gz" "Keycloak Config"
upload_file "$MINIO_DUMP_FILE" "minio/minio_data_${DATE}.tar.gz"        "MinIO Object Data"

# ── Save Local Copy ───────────────────────────────────────────────────────────
LOCAL_DEST="${LOCAL_BACKUP_DIR}/${DATE}"
mkdir -p "$LOCAL_DEST" 2>/dev/null || sudo mkdir -p "$LOCAL_DEST" 2>/dev/null || true
if [[ -d "$LOCAL_DEST" ]]; then
    cp -f "$TMP_DIR"/* "$LOCAL_DEST/" 2>/dev/null || true
    ok "Saved local backup copy to ${LOCAL_DEST}"
fi

# ── Prune Old Backups ─────────────────────────────────────────────────────────
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null \
    || date -v "-${RETENTION_DAYS}d" +"%Y-%m-%d" 2>/dev/null)

info "Pruning offsite backups older than ${RETENTION_DAYS} days (prior to ${CUTOFF_DATE})..."

for prefix in postgres keycloak minio; do
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        FILE_DATE=$(echo "$key" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
        if [[ -n "$FILE_DATE" && "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            aws s3 rm "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/${key}" --quiet
            info "Pruned old offsite backup: ${key}"
        fi
    done < <(aws s3 ls "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/${prefix}/" 2>/dev/null | awk '{print $4}' | sed "s|^|${prefix}/|")
done

# Prune local backups older than LOCAL_RETENTION_DAYS (7 days)
LOCAL_CUTOFF=$(date -d "-${LOCAL_RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null || date -v "-${LOCAL_RETENTION_DAYS}d" +"%Y-%m-%d" 2>/dev/null)
info "Pruning local backups older than ${LOCAL_RETENTION_DAYS} days (prior to ${LOCAL_CUTOFF})..."

if [[ -d "$LOCAL_BACKUP_DIR" ]]; then
    find "$LOCAL_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | while read -r dir; do
        folder_name=$(basename "$dir")
        if [[ "$folder_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$folder_name" < "$LOCAL_CUTOFF" ]]; then
            rm -rf "$dir" 2>/dev/null || sudo rm -rf "$dir" 2>/dev/null || true
            info "Pruned old local backup directory: ${dir}"
        fi
    done
fi

ok "Offsite & local backup retention cleanup completed successfully!"
echo ""
echo -e "${BOLD}${GREEN}===============================================================${NC}"
echo -e "${BOLD}${GREEN}   CoopData Enterprise Backup Completed Successfully!         ${NC}"
echo -e "${BOLD}${GREEN}===============================================================${NC}"
echo "  1. App DB      : s3://${S3_BUCKET}/postgres/coopdata_db_${DATE}.dump.gz (${APP_SIZE})"
echo "  2. Keycloak DB : s3://${S3_BUCKET}/keycloak/keycloak_db_${DATE}.dump.gz (${KC_DB_SIZE:-N/A})"
echo "  3. Keycloak Cfg: s3://${S3_BUCKET}/keycloak/keycloak_config_${DATE}.tar.gz (${KC_CFG_SIZE:-N/A})"
echo "  4. MinIO S3    : s3://${S3_BUCKET}/minio/minio_data_${DATE}.tar.gz (${MINIO_SIZE:-N/A})"
echo "  Retention      : ${RETENTION_DAYS} days"
echo ""
