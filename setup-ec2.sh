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
#   2. No domain    → HTTP only via EC2 public IP
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

# ── Detect public IP ──────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
fi
ok "Detected EC2 public IP: $PUBLIC_IP"

# ── Ask: domain or no domain? ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Do you have a domain name configured?${NC}"
echo -e "  ${CYAN}1)${NC} Yes — I have a domain pointing to this EC2 (HTTPS with Let's Encrypt)"
echo -e "  ${CYAN}2)${NC} No  — Use the EC2 public IP address directly (HTTP only, no SSL)"
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
    DOMAIN="$PUBLIC_IP"
    PROTOCOL="http"
    warn "Using IP address mode: http://$PUBLIC_IP"
    warn "Note: HTTPS is not available without a domain. Browser may show 'Not Secure' warning."
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
            -d "$DOMAIN"
        ok "TLS certificate obtained"
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
    # ── NO-DOMAIN MODE: HTTP only ────────────────────────────────────────
    cat > /etc/nginx/sites-available/coopdata <<NGINX_HTTP
server {
    listen 80 default_server;
    server_name _;

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
}
NGINX_HTTP

    ln -sf /etc/nginx/sites-available/coopdata /etc/nginx/sites-enabled/coopdata
    nginx -t && systemctl reload nginx
    ok "Nginx configured (HTTP + reverse proxy)"
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
        sed -i "s|JWT_ISSUER=.*|JWT_ISSUER=${PROTOCOL}://${DOMAIN}/auth/realms/coop-data|g" .env
        sed -i "s|JWT_ISSUER_ALIASES=.*|JWT_ISSUER_ALIASES=http://keycloak:8180/realms/coop-data|g" .env
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

chmod 600 .env 2>/dev/null || true
chown -R ubuntu:ubuntu "$SCRIPT_DIR" 2>/dev/null || true

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
    echo -e "  ${GREEN}►${NC} Mode:      ${CYAN}IP Address (HTTP)${NC}"
    echo -e "  ${GREEN}►${NC} Public IP: ${CYAN}$PUBLIC_IP${NC}"
    echo -e "  ${GREEN}►${NC} URL:       ${CYAN}http://$PUBLIC_IP${NC}"
    echo -e "  ${YELLOW}►${NC} Note:      ${YELLOW}No SSL. Browser will show 'Not Secure'.${NC}"
fi

echo -e "  ${GREEN}►${NC} Nginx:     ${CYAN}Reverse proxy configured${NC}"
echo -e "  ${GREEN}►${NC} Docker:    ${CYAN}Installed${NC}"
echo ""
echo -e "  ${YELLOW}NEXT STEPS:${NC}"
echo -e "    1. Edit .env:                ${CYAN}nano .env${NC}"
echo -e "    2. Set strong passwords      ${CYAN}(openssl rand -base64 32)${NC}"
echo -e "    3. Start CoopData:           ${CYAN}./start-prod.sh${NC}"
echo ""