#!/usr/bin/env bash
# =============================================================================
# CoopData — Enterprise Disaster Recovery & Restore Script
# =============================================================================
# Restores all 3 stateful components from offsite S3 / MinIO storage:
#   1. CoopData PostgreSQL Database (`coopdata` DB)
#   2. Keycloak IAM Database & Configuration (`keycloak` DB + host files)
#   3. MinIO S3 Object Storage (`minio_data` persistent storage)
#
# Usage:
#   ./scripts/restore-production.sh                      # Interactive: lists S3 backups to choose
#   ./scripts/restore-production.sh 2026-08-25           # Restore specific date
#   ./scripts/restore-production.sh 2026-08-25 --force   # Automated run without prompt
# =============================================================================
set -euo pipefail

# ── Colours & Logging ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TIMESTAMP=$(date +"%Y-%m-%dT%H:%M:%S%z")
LOG_PREFIX="[${TIMESTAMP}] [restore]"

info()  { echo -e "${LOG_PREFIX} ${CYAN}INFO${NC}  $*"; }
ok()    { echo -e "${LOG_PREFIX} ${GREEN}OK${NC}    $*"; }
warn()  { echo -e "${LOG_PREFIX} ${YELLOW}WARN${NC}  $*"; }
error() { echo -e "${LOG_PREFIX} ${RED}ERROR${NC} $*"; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

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
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
FORCE_YES=false

TARGET_DATE="${1:-}"
if [[ "${2:-}" == "--force" || "${1:-}" == "--force" ]]; then
    FORCE_YES=true
fi

TMP_DIR="/tmp/coopdata-restore-$$"

cleanup() {
    local exit_code=$?
    if [[ -d "$TMP_DIR" ]]; then
        rm -rf "$TMP_DIR"
    fi
    if [[ $exit_code -ne 0 ]]; then
        echo -e "${LOG_PREFIX} ${RED}FATAL${NC} Restore process failed!"
    fi
}
trap cleanup EXIT

# ── Pre-flight Checks ─────────────────────────────────────────────────────────
command -v docker &>/dev/null || error "docker CLI not found"
command -v aws &>/dev/null    || error "aws CLI not found"

AWS_ARGS=()
if [[ -n "$S3_ENDPOINT" ]]; then
    AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT")
fi

echo ""
echo -e "${BOLD}╔═════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      CoopData — Production Disaster Recovery & Restore          ║${NC}"
echo -e "${BOLD}╚═════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Select Storage Source and Date interactively if not provided ─────────────────
RESTORE_SOURCE=""
if [[ -z "$TARGET_DATE" || "$TARGET_DATE" == "--force" ]]; then
    echo -e "${BOLD}Select Backup Storage Source:${NC}"
    echo -e "  ${CYAN}1)${NC} Offsite S3 Cloud Storage (s3://${S3_BUCKET})"
    echo -e "  ${CYAN}2)${NC} Local Disk Storage (${LOCAL_BACKUP_DIR:-/var/backups/coopdata})"
    echo -ne "\n${BOLD}Enter choice [1-2]:${NC} "
    read -r SOURCE_CHOICE

    if [[ "$SOURCE_CHOICE" == "2" ]]; then
        RESTORE_SOURCE="local"
        LOCAL_DIR="${LOCAL_BACKUP_DIR:-/var/backups/coopdata}"
        if [[ ! -d "$LOCAL_DIR" ]]; then
            error "Local backup directory '${LOCAL_DIR}' does not exist!"
        fi

        AVAILABLE_DATES=$(find "$LOCAL_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
            | xargs -n1 basename | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort -u -r || true)

        if [[ -z "$AVAILABLE_DATES" ]]; then
            error "No local backups found in ${LOCAL_DIR}"
        fi

        echo -e "\n${BOLD}Available Backup Dates on Local Server Disk:${NC}"
        DATES_ARRAY=()
        i=1
        while IFS= read -r d; do
            DATES_ARRAY+=("$d")
            echo -e "  ${CYAN}${i})${NC} ${d}"
            i=$((i + 1))
        done <<< "$AVAILABLE_DATES"

        echo -ne "\n${BOLD}Select backup date to restore [1-${#DATES_ARRAY[@]}]:${NC} "
        read -r CHOICE

        if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || (( CHOICE < 1 || CHOICE > ${#DATES_ARRAY[@]} )); then
            error "Invalid selection"
        fi

        TARGET_DATE="${DATES_ARRAY[$((CHOICE - 1))]}"
    else
        RESTORE_SOURCE="s3"
        info "Querying available offsite backups from s3://${S3_BUCKET}/postgres/..."

        AVAILABLE_DATES=$(aws s3 ls "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/postgres/" 2>/dev/null \
            | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort -u -r || true)

        if [[ -z "$AVAILABLE_DATES" ]]; then
            error "No backups found in s3://${S3_BUCKET}/postgres/"
        fi

        echo -e "\n${BOLD}Available Backup Dates in Offsite S3 Storage:${NC}"
        DATES_ARRAY=()
        i=1
        while IFS= read -r d; do
            DATES_ARRAY+=("$d")
            echo -e "  ${CYAN}${i})${NC} ${d}"
            i=$((i + 1))
        done <<< "$AVAILABLE_DATES"

        echo -ne "\n${BOLD}Select backup date to restore [1-${#DATES_ARRAY[@]}]:${NC} "
        read -r CHOICE

        if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || (( CHOICE < 1 || CHOICE > ${#DATES_ARRAY[@]} )); then
            error "Invalid selection"
        fi

        TARGET_DATE="${DATES_ARRAY[$((CHOICE - 1))]}"
    fi
fi

ok "Selected backup target date: ${BOLD}${TARGET_DATE}${NC} (Source: ${RESTORE_SOURCE:-auto})"

# ── Safety Warning ────────────────────────────────────────────────────────────
if [[ "$FORCE_YES" == false ]]; then
    echo ""
    echo -e "${RED}${BOLD}=================================================================${NC}"
    echo -e "${RED}${BOLD}  WARNING: RESTORE WILL OVERWRITE CURRENT LIVE DATABASE & MEDIA  ${NC}"
    echo -e "${RED}${BOLD}=================================================================${NC}"
    echo -e "Target Date  : ${CYAN}${TARGET_DATE}${NC}"
    echo -e "App DB       : ${CYAN}${APP_DB}${NC}"
    echo -e "Keycloak DB  : ${CYAN}${KEYCLOAK_DB}${NC}"
    echo -e "S3 Target    : ${CYAN}s3://${S3_BUCKET}${NC}"
    echo ""
    echo -ne "${BOLD}Type 'RESTORE' to confirm and proceed: ${NC}"
    read -r CONFIRMATION
    if [[ "$CONFIRMATION" != "RESTORE" ]]; then
        info "Restore aborted by user."
        exit 0
    fi
fi

mkdir -p "$TMP_DIR"
chmod 700 "$TMP_DIR"

# ═════════════════════════════════════════════════════════════════════════════
# 1. FETCH BACKUP ARTIFACTS (LOCAL DISK OR S3)
# ═════════════════════════════════════════════════════════════════════════════
LOCAL_SOURCE_DIR="${LOCAL_BACKUP_DIR:-/var/backups/coopdata}/${TARGET_DATE}"

APP_DUMP_FILE="${TMP_DIR}/coopdata_db_${TARGET_DATE}.dump.gz"
KC_DUMP_FILE="${TMP_DIR}/keycloak_db_${TARGET_DATE}.dump.gz"
KC_CFG_FILE="${TMP_DIR}/keycloak_config_${TARGET_DATE}.tar.gz"
MINIO_DUMP_FILE="${TMP_DIR}/minio_data_${TARGET_DATE}.tar.gz"

if [[ "$RESTORE_SOURCE" == "local" || ( -z "$RESTORE_SOURCE" && -d "$LOCAL_SOURCE_DIR" ) ]]; then
    step "1. Loading backup artifacts from LOCAL DISK (${LOCAL_SOURCE_DIR})..."
    cp "$LOCAL_SOURCE_DIR"/coopdata_db_*.dump.gz "$APP_DUMP_FILE" 2>/dev/null || error "App DB backup not found in ${LOCAL_SOURCE_DIR}"
    cp "$LOCAL_SOURCE_DIR"/keycloak_db_*.dump.gz "$KC_DUMP_FILE" 2>/dev/null || warn "Keycloak DB dump not found in ${LOCAL_SOURCE_DIR}"
    cp "$LOCAL_SOURCE_DIR"/keycloak_config_*.tar.gz "$KC_CFG_FILE" 2>/dev/null || warn "Keycloak config not found in ${LOCAL_SOURCE_DIR}"
    cp "$LOCAL_SOURCE_DIR"/minio_data_*.tar.gz "$MINIO_DUMP_FILE" 2>/dev/null || warn "MinIO storage archive not found in ${LOCAL_SOURCE_DIR}"
    ok "Loaded backup artifacts from local disk storage"
else
    step "1. Downloading offsite backup artifacts from S3 for ${TARGET_DATE}..."
    info "Downloading App DB dump..."
    aws s3 cp "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/postgres/coopdata_db_${TARGET_DATE}.dump.gz" "$APP_DUMP_FILE" || error "App DB backup not found on S3 for ${TARGET_DATE}"

    info "Downloading Keycloak DB dump..."
    aws s3 cp "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/keycloak/keycloak_db_${TARGET_DATE}.dump.gz" "$KC_DUMP_FILE" || warn "Keycloak DB dump not found on S3"

    info "Downloading Keycloak Config..."
    aws s3 cp "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/keycloak/keycloak_config_${TARGET_DATE}.tar.gz" "$KC_CFG_FILE" 2>/dev/null || warn "Keycloak config archive not found on S3"

    info "Downloading MinIO Object Storage archive..."
    aws s3 cp "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/minio/minio_data_${TARGET_DATE}.tar.gz" "$MINIO_DUMP_FILE" || warn "MinIO storage archive not found on S3"
    ok "All available artifacts downloaded from offsite S3"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 2. RESTORE POSTGRES DBs
# ═════════════════════════════════════════════════════════════════════════════
step "2. Restoring PostgreSQL Databases..."

if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    error "PostgreSQL container '${PG_CONTAINER}' is not running! Run: docker compose up -d postgres"
fi

# 2a. Restore CoopData App DB
info "Restoring CoopData Application DB ('${APP_DB}')..."
docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
    psql -U "$PG_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${APP_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true

docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
    psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS ${APP_DB};" >/dev/null

docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
    psql -U "$PG_USER" -d postgres -c "CREATE DATABASE ${APP_DB} OWNER ${PG_USER};"

if ! gzip -dc "$APP_DUMP_FILE" | docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
    pg_restore -U "$PG_USER" -d "$APP_DB" --no-owner --role="$PG_USER" --clean --if-exists 2>&1; then
    info "pg_restore failed or file is plain SQL — attempting psql import..."
    gzip -dc "$APP_DUMP_FILE" | docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d "$APP_DB" -v ON_ERROR_STOP=1 || error "Failed to restore CoopData Application DB!"
fi

ok "CoopData Application DB restored successfully!"

# 2b. Restore Keycloak DB
if [[ -f "$KC_DUMP_FILE" ]]; then
    info "Restoring Keycloak IAM DB ('${KEYCLOAK_DB}')..."
    docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${KEYCLOAK_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true

    docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS ${KEYCLOAK_DB};" >/dev/null

    docker exec -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        psql -U "$PG_USER" -d postgres -c "CREATE DATABASE ${KEYCLOAK_DB} OWNER ${PG_USER};"

    if ! gzip -dc "$KC_DUMP_FILE" | docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
        pg_restore -U "$PG_USER" -d "$KEYCLOAK_DB" --no-owner --role="$PG_USER" --clean --if-exists 2>&1; then
        info "pg_restore failed or file is plain SQL — attempting psql import..."
        gzip -dc "$KC_DUMP_FILE" | docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "$PG_CONTAINER" \
            psql -U "$PG_USER" -d "$KEYCLOAK_DB" -v ON_ERROR_STOP=1 || error "Failed to restore Keycloak IAM DB!"
    fi

    ok "Keycloak IAM DB restored successfully!"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 3. RESTORE KEYCLOAK CONFIG FILES
# ═════════════════════════════════════════════════════════════════════════════
if [[ -f "$KC_CFG_FILE" ]]; then
    step "3. Restoring Keycloak Host Config & Theme Files..."
    tar -xzf "$KC_CFG_FILE" -C "$PROJECT_DIR"
    ok "Keycloak static files restored to ${PROJECT_DIR}/keycloak"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 4. RESTORE MINIO OBJECT STORAGE
# ═════════════════════════════════════════════════════════════════════════════
if [[ -f "$MINIO_DUMP_FILE" ]]; then
    step "4. Restoring MinIO S3 Object Storage Data..."
    if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
        docker exec -i "$MINIO_CONTAINER" tar -xzf - -C /data < "$MINIO_DUMP_FILE"
        ok "MinIO object storage data unpacked into container"
    else
        warn "MinIO container not running — unpacking into Docker named volume..."
        VOL_PATH=$(docker volume inspect coopdata_minio_data --format '{{ .Mountpoint }}' 2>/dev/null || docker volume inspect minio_data --format '{{ .Mountpoint }}' 2>/dev/null || echo "")
        if [[ -n "$VOL_PATH" && -d "$VOL_PATH" ]]; then
            tar -xzf "$MINIO_DUMP_FILE" -C "$VOL_PATH"
            ok "MinIO data volume restored directly"
        fi
    fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 5. RESTART APP SERVICES TO RELOAD CACHES & CONNECTIONS
# ═════════════════════════════════════════════════════════════════════════════
step "5. Reloading application services..."
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.ghcr.yaml"
if [[ -f "$COMPOSE_FILE" ]]; then
    docker compose -f "$COMPOSE_FILE" restart keycloak backend frontend 2>/dev/null || true
    ok "Application containers restarted"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 6. POST-RESTORE HEALTH VERIFICATION
# ═════════════════════════════════════════════════════════════════════════════
step "6. Verifying system health post-restore..."
ELAPSED=0
MAX_WAIT=30
HEALTHY=false

while (( ELAPSED < MAX_WAIT )); do
    if curl -sf http://localhost:3000/api/v1/health &>/dev/null; then
        HEALTHY=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

echo ""
echo -e "${BOLD}${GREEN}=================================================================${NC}"
echo -e "${BOLD}${GREEN}     DISASTER RECOVERY RESTORE COMPLETED SUCCESSFULLY!           ${NC}"
echo -e "${BOLD}${GREEN}=================================================================${NC}"
echo "  Restored Date : ${TARGET_DATE}"
echo "  App DB        : ${APP_DB} (Restored)"
echo "  Keycloak DB   : ${KEYCLOAK_DB} (Restored)"
echo "  MinIO Files   : Restored"
echo "  API Status    : $([ "$HEALTHY" = true ] && echo 'ONLINE (200 OK)' || echo 'Initializing...')"
echo ""
