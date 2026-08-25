#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# CoopData EC2 Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Run this ON the EC2 instance as the FIRST step after SSHing in.
# Installs Docker, Nginx, and (optionally) Certbot + SSL.
#
# Supports two modes:
#   1. With domain  → full HTTPS via Let's Encrypt
#   2. No domain    → self-signed HTTPS via EC2 public DNS hostname
#
# Usage:  sudo ./setup-ec2.sh
# ═══════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ $EUID -ne 0 ]]; then
    error "Please run as root: sudo ./setup-ec2.sh"
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      CoopData — EC2 Environment Setup            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect public IP + public DNS hostname ────────────────────────────────
EC2_TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || echo "")

get_metadata() {
    if [[ -n "$EC2_TOKEN" ]]; then
        curl -s -H "X-aws-ec2-metadata-token: $EC2_TOKEN" "$1" 2>/dev/null
    else
        curl -s "$1" 2>/dev/null
    fi
}

PUBLIC_IP=$(get_metadata "http://169.254.169.254/latest/meta-data/public-ipv4" || echo "")
if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
fi
ok "Detected EC2 public IP: $PUBLIC_IP"

PUBLIC_DNS=$(get_metadata "http://169.254.169.254/latest/meta-data/public-hostname" || echo "")
if [[ -z "$PUBLIC_DNS" ]] || [[ "$PUBLIC_DNS" == "$PUBLIC_IP" ]]; then
    AZ=$(get_metadata "http://169.254.169.254/latest/meta-data/placement/availability-zone" || echo "")
    REGION="${AZ%?}"
    IP_DASHED="${PUBLIC_IP//./-}"
    if [[ -n "$REGION" ]]; then
        PUBLIC_DNS="ec2-${IP_DASHED}.${REGION}.compute.amazonaws.com"
    else
        PUBLIC_DNS="$PUBLIC_IP"
    fi
fi
ok "Detected EC2 public DNS: $PUBLIC_DNS"

# ── Ask: domain or no domain? ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Do you have a domain name configured?${NC}"
echo -e "  ${CYAN}1)${NC} Yes — I have a domain pointing to this EC2 (HTTPS with Let's Encrypt)"
echo -e "  ${CYAN}2)${NC} No  — Use self-signed HTTPS with the EC2 public DNS hostname"
echo -ne "\n${BOLD}Enter choice [1-2]:${NC} "
read -r HAS_DOMAIN_CHOICE

HAS_DOMAIN=false
DOMAIN=""
EMAIL=""

if [[ "$HAS_DOMAIN_CHOICE" == "1" ]]; then
    HAS_DOMAIN=true
    echo -ne "${BOLD}Enter your domain name (e.g. coopdata.example.com):${NC} "
    read -r DOMAIN
    [[ -z "$DOMAIN" ]] && error "Domain is required."

    echo -ne "${BOLD}Enter your email for Let's Encrypt:${NC} "
    read -r EMAIL
    [[ -z "$EMAIL" ]] && error "Email is required."
    PROTOCOL="https"
else
    DOMAIN="$PUBLIC_DNS"
    PROTOCOL="https"
    warn "Using self-signed HTTPS mode: https://$PUBLIC_DNS"
    warn "Browser will show a certificate warning — click 'Advanced → Proceed' to continue."
    warn "Ensure port 443 is open in your EC2 security group!"
fi

echo ""

# ── Step 1: System update ─────────────────────────────────────────────────
info "[1/5] Updating system packages..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git unzip ca-certificates gnupg lsb-release
ok "System updated"

# ── Step 2: Install Docker ────────────────────────────────────────────────
info "[2/5] Installing Docker..."
if command -v docker &>/dev/null; then
    ok "Docker already installed"
else
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker
    ok "Docker installed"
fi

# ── Step 3: Install Nginx (+ Certbot if domain) ───────────────────────────
info "[3/5] Installing Nginx..."
if command -v nginx &>/dev/null; then
    ok "Nginx already installed"
else
    apt-get install -y nginx
    ok "Nginx installed"
fi

if [[ "$HAS_DOMAIN" == true ]]; then
    if ! command -v certbot &>/dev/null; then
        apt-get install -y python3-certbot-nginx
    fi
    ok "Certbot installed"
fi

# ── Step 4: Configure Nginx ───────────────────────────────────────────────
info "[4/5] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default

if [[ "$HAS_DOMAIN" == true ]]; then
    # ── DOMAIN MODE: pre-TLS config for ACME challenge ────────────────────
    mkdir -p /var/www/certbot

    cat > /etc/nginx/sites-available/coopdata <<NGINX_PRE_TLS
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINX_PRE_TLS

    ln -sf /etc/nginx/sites-available/coopdata /etc/nginx/sites-enabled/coopdata
    nginx -t && systemctl reload nginx
    ok "Nginx configured (pre-TLS for ACME challenge)"

    # ── Obtain TLS certificate ───────────────────────────────────────────
    info "[5/5] Obtaining TLS certificate from Let's Encrypt..."
    CERT_EXISTS=$(certbot certificates 2>/dev/null | grep -c "$DOMAIN" || echo "0")
    if [[ "$CERT_EXISTS" -gt 0 ]]; then
        ok "Certificate already exists for $DOMAIN"
    else
        certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            -d "demo.$DOMAIN"
        ok "TLS certificate obtained for $DOMAIN and demo.$DOMAIN"
    fi

    # ── Final Nginx config with TLS ──────────────────────────────────────
    write_nginx_tls() {
        cat > /etc/nginx/sites-available/coopdata <<NGINX_TLS
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass         http://127.0.0.1:5174;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    location /swagger-ui/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    location /auth/ {
        proxy_pass         http://127.0.0.1:8180/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   X-Forwarded-Host \$host;
        proxy_http_version 1.1;
        proxy_buffer_size          128k;
        proxy_buffers              4 256k;
        proxy_busy_buffers_size    256k;
        proxy_request_buffering    off;
    }

    location /resources/ {
        proxy_pass         http://127.0.0.1:8180/resources/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /realms/ {
        proxy_pass         http://127.0.0.1:8180/realms/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /admin/ {
        proxy_pass         http://127.0.0.1:8180/admin/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /js/ {
        proxy_pass         http://127.0.0.1:8180/js/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }
}

# ── DEMO / STAGING SUBDOMAIN (demo.$DOMAIN) ──────────────────────────────
server {
    listen 80;
    server_name demo.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name demo.$DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass         http://127.0.0.1:5175;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:3005;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /auth/ {
        proxy_pass         http://127.0.0.1:8185/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }
}
NGINX_TLS
    }

    if [[ -f nginx-host.conf ]]; then
        cp nginx-host.conf /etc/nginx/sites-available/coopdata
        sed -i "s/__DOMAIN__/$DOMAIN/g" /etc/nginx/sites-available/coopdata
    else
        write_nginx_tls
    fi

    ln -sf /etc/nginx/sites-available/coopdata /etc/nginx/sites-enabled/coopdata
    nginx -t && systemctl reload nginx
    ok "Nginx configured (TLS + reverse proxy)"

    # ── Auto-renewal cron ────────────────────────────────────────────────
    echo "0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" \
        > /etc/cron.d/certbot-renew
    chmod 644 /etc/cron.d/certbot-renew
    ok "Certbot auto-renewal cron installed"

else
    # ── SELF-SIGNED HTTPS MODE ────────────────────────────────────────────
    info "Generating self-signed TLS certificate for $DOMAIN..."

    CERT_DIR="/etc/nginx/ssl"
    mkdir -p "$CERT_DIR"

    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout "$CERT_DIR/coopdata-selfsigned.key" \
        -out "$CERT_DIR/coopdata-selfsigned.crt" \
        -subj "/C=US/ST=State/L=City/O=CoopData/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,IP:$PUBLIC_IP" 2>/dev/null

    chmod 600 "$CERT_DIR/coopdata-selfsigned.key"
    ok "Self-signed certificate generated (valid 365 days)"

    cat > /etc/nginx/sites-available/coopdata <<NGINX_SELFSIGNED
server {
    listen 80 default_server;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name $DOMAIN;

    ssl_certificate     $CERT_DIR/coopdata-selfsigned.crt;
    ssl_certificate_key $CERT_DIR/coopdata-selfsigned.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass         http://127.0.0.1:5174;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    location /swagger-ui/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    location /auth/ {
        proxy_pass         http://127.0.0.1:8180/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   X-Forwarded-Host \$host;
        proxy_http_version 1.1;
        proxy_buffer_size          128k;
        proxy_buffers              4 256k;
        proxy_busy_buffers_size    256k;
        proxy_request_buffering    off;
    }

    location /resources/ {
        proxy_pass         http://127.0.0.1:8180/resources/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /realms/ {
        proxy_pass         http://127.0.0.1:8180/realms/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /admin/ {
        proxy_pass         http://127.0.0.1:8180/admin/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }

    location /js/ {
        proxy_pass         http://127.0.0.1:8180/js/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
    }
}
NGINX_SELFSIGNED

    ln -sf /etc/nginx/sites-available/coopdata /etc/nginx/sites-enabled/coopdata
    nginx -t && systemctl reload nginx
    ok "Nginx configured (self-signed HTTPS + reverse proxy)"
fi

# ── Patch Keycloak realm JSON ─────────────────────────────────────────────
info "Patching Keycloak realm JSON for ${PROTOCOL}://${DOMAIN}..."
REALM_FILE="keycloak/realm-coopdata.json"
if [[ -f "$REALM_FILE" ]]; then
    cp "$REALM_FILE" "${REALM_FILE}.bak"
    sed -i "s|http://localhost:5173|${PROTOCOL}://${DOMAIN}|g" "$REALM_FILE"
    sed -i "s|http://localhost:5174|${PROTOCOL}://${DOMAIN}|g" "$REALM_FILE"
    ok "Realm JSON patched: localhost → ${DOMAIN}"
else
    warn "Realm JSON not found at $REALM_FILE — skipping patch"
fi

# ── Set up .env ───────────────────────────────────────────────────────────
info "Setting up .env file..."
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env

        sed -i "s|coopdata.example.com|$DOMAIN|g" .env
        sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=${PROTOCOL}://${DOMAIN}|g" .env
        sed -i "s|JWT_ISSUER=.*|JWT_ISSUER=${PROTOCOL}://${DOMAIN}/realms/coop-data|g" .env
        sed -i "s|JWT_ISSUER_ALIASES=.*|JWT_ISSUER_ALIASES=${PROTOCOL}://${DOMAIN}/realms/coop-data,http://keycloak:8180/realms/coop-data|g" .env
        sed -i "s|DOMAIN_NAME=.*|DOMAIN_NAME=${DOMAIN}|g" .env
        sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=|g" .env
        sed -i "s|VITE_KEYCLOAK_URL=.*|VITE_KEYCLOAK_URL=|g" .env
        sed -i "s|ENVIRONMENT=.*|ENVIRONMENT=production|g" .env

        warn "Created .env from .env.example"
        warn "Domain set to: ${PROTOCOL}://${DOMAIN}"
        warn "You MUST edit .env and set strong passwords before deploying!"
    fi
else
    ok ".env already exists — keeping it"
fi

# ── Set up .env.demo ──────────────────────────────────────────────────────
info "Setting up .env.demo file..."
if [[ ! -f .env.demo ]] && [[ -f .env.demo.example ]]; then
    cp .env.demo.example .env.demo
    sed -i "s|coopdata.dgrvcoop360.com|$DOMAIN|g" .env.demo
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=${PROTOCOL}://demo.${DOMAIN}|g" .env.demo
    sed -i "s|JWT_ISSUER=.*|JWT_ISSUER=${PROTOCOL}://demo.${DOMAIN}/auth/realms/coop-data|g" .env.demo
    sed -i "s|JWT_ISSUER_ALIASES=.*|JWT_ISSUER_ALIASES=${PROTOCOL}://demo.${DOMAIN}/auth/realms/coop-data,http://demo-keycloak:8180/realms/coop-data|g" .env.demo
    sed -i "s|DOMAIN_NAME=.*|DOMAIN_NAME=${DOMAIN}|g" .env.demo
    chmod 600 .env.demo 2>/dev/null || true
    ok "Created .env.demo from .env.demo.example"
else
    ok ".env.demo already exists — keeping it"
fi

chmod 600 .env .env.demo 2>/dev/null || true
chown -R ubuntu:ubuntu "$SCRIPT_DIR" 2>/dev/null || true

# ── Step 5: Configure Docker log rotation ────────────────────────────────────
info "Configuring Docker daemon log rotation..."
DAEMON_JSON="/etc/docker/daemon.json"
if [[ -f "$DAEMON_JSON" ]] && grep -q '"log-driver"' "$DAEMON_JSON" 2>/dev/null; then
    ok "Docker log rotation already configured in ${DAEMON_JSON}"
else
    # Merge into existing daemon.json if present, otherwise create fresh
    if [[ -f "$DAEMON_JSON" ]]; then
        cp "$DAEMON_JSON" "${DAEMON_JSON}.bak"
        python3 -c "
import json, sys
with open('${DAEMON_JSON}') as f:
    d = json.load(f)
d.update({'log-driver': 'json-file', 'log-opts': {'max-size': '10m', 'max-file': '3'}})
print(json.dumps(d, indent=2))
" > "${DAEMON_JSON}.new" && mv "${DAEMON_JSON}.new" "${DAEMON_JSON}"
    else
        cat > "$DAEMON_JSON" << 'DAEMON_EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DAEMON_EOF
    fi
    systemctl reload docker 2>/dev/null || systemctl restart docker
    ok "Docker log rotation configured (10MB × 3 files per container)"
fi

# ── Step 6: Install docker-rollout (zero-downtime deployments) ───────────────
info "Installing docker-rollout CLI plugin..."
ROLLOUT_DIR="/home/ubuntu/.docker/cli-plugins"
ROLLOUT_PATH="${ROLLOUT_DIR}/docker-rollout"
ROLLOUT_URL="https://raw.githubusercontent.com/wowu/docker-rollout/main/docker-rollout"

mkdir -p "$ROLLOUT_DIR"
chown ubuntu:ubuntu "$ROLLOUT_DIR"

if [[ -x "$ROLLOUT_PATH" ]]; then
    ok "docker-rollout already installed"
else
    if curl -fsSL "$ROLLOUT_URL" -o "$ROLLOUT_PATH" 2>/dev/null; then
        chmod +x "$ROLLOUT_PATH"
        chown ubuntu:ubuntu "$ROLLOUT_PATH"
        ok "docker-rollout installed at ${ROLLOUT_PATH}"
    else
        warn "Could not download docker-rollout (no internet?). Run later:"
        warn "  ./scripts/install-docker-rollout.sh"
    fi
fi

# ── Step 7: Install nightly backup cron job ───────────────────────────────────
info "Setting up nightly production backup cron job (DB + Keycloak + MinIO)..."
BACKUP_SCRIPT="${SCRIPT_DIR}/scripts/backup-production.sh"

if [[ -f "$BACKUP_SCRIPT" ]]; then
    chmod +x "$BACKUP_SCRIPT"
    chmod +x "${SCRIPT_DIR}/scripts/backup-postgres.sh" 2>/dev/null || true
    CRON_JOB="0 2 * * * ubuntu ${BACKUP_SCRIPT} >> /var/log/coopdata-backup.log 2>&1"
    CRON_FILE="/etc/cron.d/coopdata-backup"

    # Write cron file only if not already present
    if [[ ! -f "$CRON_FILE" ]] || ! grep -qF "$BACKUP_SCRIPT" "$CRON_FILE"; then
        echo "$CRON_JOB" > "$CRON_FILE"
        chmod 644 "$CRON_FILE"
        ok "Backup cron installed: daily at 02:00 → ${CRON_FILE}"
    else
        ok "Backup cron already configured at ${CRON_FILE}"
    fi

    # Create log file with correct permissions
    touch /var/log/coopdata-backup.log
    chown ubuntu:ubuntu /var/log/coopdata-backup.log
    chmod 640 /var/log/coopdata-backup.log
    ok "Backup log: /var/log/coopdata-backup.log"
else
    warn "Backup script not found at ${BACKUP_SCRIPT} — skipping cron setup"
fi

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          EC2 Setup Complete!                           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ "$HAS_DOMAIN" == true ]]; then
    echo -e "  ${GREEN}►${NC} Mode:      ${CYAN}Domain (HTTPS)${NC}"
    echo -e "  ${GREEN}►${NC} Domain:    ${CYAN}$DOMAIN${NC}"
    echo -e "  ${GREEN}►${NC} SSL:       ${CYAN}Let's Encrypt (auto-renewal)${NC}"
    echo -e "  ${GREEN}►${NC} URL:       ${CYAN}https://$DOMAIN${NC}"
else
    echo -e "  ${GREEN}►${NC} Mode:      ${CYAN}Self-signed HTTPS${NC}"
    echo -e "  ${GREEN}►${NC} Hostname:  ${CYAN}$DOMAIN${NC}"
    echo -e "  ${GREEN}►${NC} URL:       ${CYAN}https://$DOMAIN${NC}"
    echo -e "  ${YELLOW}►${NC} Note:      ${YELLOW}Browser will warn about cert — click 'Advanced → Proceed'.${NC}"
fi

echo -e "  ${GREEN}►${NC} Nginx:          ${CYAN}Reverse proxy configured${NC}"
echo -e "  ${GREEN}►${NC} Docker:         ${CYAN}Installed + log rotation (10MB×3)${NC}"
echo -e "  ${GREEN}►${NC} docker-rollout: ${CYAN}Zero-downtime deployments enabled${NC}"
echo -e "  ${GREEN}►${NC} Backups:        ${CYAN}Nightly cron at 02:00 → /var/log/coopdata-backup.log${NC}"
echo -e "  ${GREEN}►${NC} Recovery:       ${CYAN}Disaster recovery script ready (./scripts/restore-production.sh)${NC}"
echo ""
echo -e "  ${YELLOW}NEXT STEPS:${NC}"
echo -e "    1. Edit .env:                  ${CYAN}nano .env${NC}"
echo -e "    2. Set strong passwords:       ${CYAN}openssl rand -base64 32${NC}"
echo -e "    3. Configure backup target:    ${CYAN}Set BACKUP_S3_BUCKET + AWS credentials in .env${NC}"
echo -e "    4. Start CoopData:             ${CYAN}./start-prod.sh${NC}"
echo -e "    5. Future updates (zero-down): ${CYAN}./scripts/deploy.sh${NC}"
echo -e "    6. Disaster recovery restore:  ${CYAN}./scripts/restore-production.sh${NC}"
echo ""