CoopData — AWS EC2 Deployment Guide
This guide provisions a single EC2 instance running all CoopData services via Docker Compose, fronted by Nginx as a reverse proxy with TLS certificates managed by Certbot (Let's Encrypt). Terraform handles all AWS infrastructure. The internal Docker network isolates services; only Nginx is exposed to the internet.

Architecture Overview
Internet
    │
    ▼
[Route 53] → coopdata.example.com
    │
    ▼
[EC2 Security Group]
  ┌───────────────────────────────────────────────────────┐
  │  EC2 Instance (Ubuntu 24.04)                          │
  │                                                       │
  │  [Nginx :443 / :80]  ← TLS via Let's Encrypt         │
  │       │                                               │
  │       ├── /             → frontend:80  (React SPA)    │
  │       ├── /api/         → backend:3000 (Rust/Axum)    │
  │       └── /auth/        → keycloak:8180               │
  │                                                       │
  │  [Docker internal network: coopdata_net]              │
  │  ┌─────────┐  ┌──────────┐  ┌──────────┐             │
  │  │frontend │  │ backend  │  │keycloak  │             │
  │  │  :80    │  │  :3000   │  │  :8180   │             │
  │  └─────────┘  └────┬─────┘  └──────────┘             │
  │                    │                                   │
  │             ┌──────┼──────┐                           │
  │             ▼      ▼      ▼                           │
  │         postgres  redis  minio                        │
  │          :5432   :6379   :9000                        │
  │                                                       │
  └───────────────────────────────────────────────────────┘
Key security rules:

PostgreSQL, Redis, MinIO, and Keycloak internal ports are NOT exposed to the host.
Only ports 22 (SSH), 80 (HTTP→redirect), and 443 (HTTPS) are open in the Security Group.
All inter-service traffic flows on the private Docker network coopdata_net.
Prerequisites
Tool	Version	Install
Terraform	≥ 1.7	brew install terraform / tfenv
AWS CLI	≥ 2.x	brew install awscli
An AWS account	—	IAM user with EC2, Route53, and VPC permissions
A registered domain	—	Managed in Route 53 or any DNS provider
Configure AWS credentials:

aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: us-east-1
# Default output format: json
Repository Layout for Infra
Create the following structure alongside your existing code:

infra/
├── main.tf          ← Entry point: provider, backend, locals
├── variables.tf     ← All input variables
├── outputs.tf       ← Useful outputs (IP, DNS)
├── vpc.tf           ← VPC, subnets, internet gateway
├── security.tf      ← Security groups
├── ec2.tf           ← Instance, EIP, key pair
├── dns.tf           ← Route 53 A record
├── userdata.sh      ← Bootstrap script (Docker, Nginx, Certbot)
└── terraform.tfvars ← Your actual values (gitignored)
Terraform Files
infra/variables.tf
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"  # 2 vCPU, 4 GB RAM — minimum for the full stack
}

variable "key_pair_name" {
  description = "Name of an existing EC2 Key Pair for SSH access"
  type        = string
}

variable "public_key_path" {
  description = "Path to the SSH public key to upload"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "domain_name" {
  description = "Root domain (e.g. example.com)"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for this app (e.g. coopdata)"
  type        = string
  default     = "coopdata"
}

variable "route53_zone_id" {
  description = "Route 53 Hosted Zone ID for the domain"
  type        = string
}

variable "certbot_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 24.04 LTS AMI (us-east-1 default)"
  type        = string
  default     = "ami-0c7217cdde317cfec"  # Ubuntu 24.04 LTS us-east-1 (verify current)
}

variable "volume_size_gb" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 30
}
infra/main.tf
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Uncomment to store state remotely in S3 (recommended for teams)
  # backend "s3" {
  #   bucket         = "coopdata-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "coopdata-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
}

locals {
  app_name   = "coopdata"
  fqdn       = "${var.subdomain}.${var.domain_name}"
  common_tags = {
    Project     = local.app_name
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
infra/vpc.tf
# Use the default VPC to keep things simple for a single-instance deployment.
# For multi-AZ or private subnets, replace with a custom VPC.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
infra/security.tf
resource "aws_security_group" "coopdata" {
  name        = "${local.app_name}-sg"
  description = "CoopData EC2 security group"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  # SSH — restrict to your IP in production
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # CHANGE: restrict to your IP, e.g. ["203.0.113.0/32"]
  }

  # HTTP — Nginx redirects this to HTTPS
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS — main entry point
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound allowed (pull images, reach S3, send email, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
infra/ec2.tf
resource "aws_key_pair" "coopdata" {
  key_name   = var.key_pair_name
  public_key = file(var.public_key_path)
  tags       = local.common_tags
}

resource "aws_instance" "coopdata" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.coopdata.key_name
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.coopdata.id]

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.volume_size_gb
    delete_on_termination = true
    encrypted             = true
  }

  # The userdata script runs once on first boot
  user_data = templatefile("${path.module}/userdata.sh", {
    fqdn           = local.fqdn
    certbot_email  = var.certbot_email
  })

  tags = merge(local.common_tags, {
    Name = "${local.app_name}-production"
  })

  lifecycle {
    # Prevent accidental replacement of the running instance
    prevent_destroy = true
  }
}

# Elastic IP — ensures the public IP never changes across stop/start
resource "aws_eip" "coopdata" {
  instance = aws_instance.coopdata.id
  domain   = "vpc"
  tags     = local.common_tags
}
infra/dns.tf
# Points coopdata.example.com → the Elastic IP
resource "aws_route53_record" "coopdata_a" {
  zone_id = var.route53_zone_id
  name    = local.fqdn
  type    = "A"
  ttl     = 300
  records = [aws_eip.coopdata.public_ip]
}

# Optional: www redirect (if subdomain is "coopdata", this adds www.coopdata.example.com)
resource "aws_route53_record" "coopdata_www" {
  zone_id = var.route53_zone_id
  name    = "www.${local.fqdn}"
  type    = "CNAME"
  ttl     = 300
  records = [local.fqdn]
}
infra/outputs.tf
output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.coopdata.id
}

output "elastic_ip" {
  description = "Public Elastic IP"
  value       = aws_eip.coopdata.public_ip
}

output "fqdn" {
  description = "Full domain name"
  value       = local.fqdn
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/id_rsa ubuntu@${aws_eip.coopdata.public_ip}"
}

output "app_url" {
  description = "Application URL"
  value       = "https://${local.fqdn}"
}

output "keycloak_url" {
  description = "Keycloak admin console"
  value       = "https://${local.fqdn}/auth"
}
infra/terraform.tfvars
Never commit this file. Add infra/terraform.tfvars to .gitignore.

aws_region      = "us-east-1"
instance_type   = "t3.medium"
key_pair_name   = "coopdata-prod-key"
public_key_path = "~/.ssh/id_rsa.pub"
domain_name     = "example.com"
subdomain       = "coopdata"
route53_zone_id = "Z1234567890ABCDEF"
certbot_email   = "ops@example.com"
volume_size_gb  = 30
Bootstrap Script (userdata.sh)
This script runs automatically on first boot. It installs Docker, Docker Compose, Nginx, and Certbot, then writes the Nginx config and obtains a TLS certificate.

infra/userdata.sh
#!/bin/bash
set -euo pipefail
exec > /var/log/coopdata-userdata.log 2>&1

FQDN="${fqdn}"
CERTBOT_EMAIL="${certbot_email}"
APP_DIR="/opt/coopdata"

echo "==> [1/6] System update"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git unzip ca-certificates gnupg lsb-release

echo "==> [2/6] Install Docker"
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

echo "==> [3/6] Install Nginx and Certbot"
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> [4/6] Write Nginx HTTP config (pre-TLS, required for certbot challenge)"
cat > /etc/nginx/sites-available/coopdata <<'NGINX_PRE_TLS'
server {
    listen 80;
    server_name FQDN_PLACEHOLDER;

    # Required for Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX_PRE_TLS

sed -i "s/FQDN_PLACEHOLDER/$FQDN/g" /etc/nginx/sites-available/coopdata
ln -sf /etc/nginx/sites-available/coopdata /etc/nginx/sites-enabled/coopdata
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot
nginx -t && systemctl reload nginx

echo "==> [5/6] Obtain TLS certificate"
certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$FQDN"

echo "==> [6/6] Write final Nginx HTTPS config"
cat > /etc/nginx/sites-available/coopdata <<NGINX_TLS
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name $FQDN;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $FQDN;

    ssl_certificate     /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;

    # Strong TLS settings
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       10m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    # ── Frontend (React SPA) ─────────────────────────────────────────────────
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

    # ── Backend API ──────────────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        # Upload timeout — large file extraction jobs can take time
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    # ── Swagger UI (optional — remove in prod if you want to hide docs) ──────
    location /swagger-ui/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    # ── Keycloak ─────────────────────────────────────────────────────────────
    location /auth/ {
        proxy_pass         http://127.0.0.1:8180/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_buffer_size          128k;
        proxy_buffers              4 256k;
        proxy_busy_buffers_size    256k;
    }
}
NGINX_TLS

nginx -t && systemctl reload nginx

# Auto-renew certs (runs twice daily, no-op when not near expiry)
echo "0 0,12 * * * root certbot renew --quiet --nginx" \
  > /etc/cron.d/certbot-renew

echo "==> Bootstrap complete. Deploy the app to $APP_DIR and run docker compose up -d"
Production Docker Compose Changes
Before deploying, update docker-compose.yml so that internal service ports are no longer published to the host. Only the services that Nginx talks to need host-side port bindings.

# docker-compose.prod.yml  (overrides the base docker-compose.yml)
services:
  postgres:
    ports: []           # Never expose DB to host

  redis:
    ports: []           # Never expose cache to host

  adminer:
    ports: []           # Disable in production

  mailhog:
    profiles: ["dev"]   # Only starts with --profile dev

  keycloak:
    ports:
      - "127.0.0.1:8180:8180"   # Localhost only — Nginx proxies externally
    environment:
      KC_HOSTNAME: "https://coopdata.example.com/auth"
      KC_HOSTNAME_STRICT: "true"
      KC_HTTP_ENABLED: "true"
      KC_PROXY: "edge"           # Keycloak trusts the X-Forwarded-Proto header

  backend:
    ports:
      - "127.0.0.1:3000:3000"   # Localhost only
    environment:
      ENVIRONMENT: production
      FRONTEND_URL: "https://coopdata.example.com"
      JWT_ISSUER: "https://coopdata.example.com/auth/realms/coop-data"
      JWT_ISSUER_ALIASES: "http://keycloak:8180/realms/coop-data"

  frontend:
    ports:
      - "127.0.0.1:5174:80"     # Localhost only
    build:
      args:
        VITE_API_BASE_URL: "https://coopdata.example.com/api/v1"
        VITE_KEYCLOAK_URL: "https://coopdata.example.com/auth"
        VITE_KEYCLOAK_REALM: "coop-data"
        VITE_KEYCLOAK_CLIENT_ID: "coopdata-frontend"

  minio:
    ports:
      - "127.0.0.1:9100:9000"   # Localhost only — no console in prod
All services automatically share the default Docker Compose network. No manual network definition is needed unless you want to isolate services further.

Deploying the Application
Step 1 — Provision infrastructure
cd infra
terraform init
terraform plan -out=tfplan
terraform apply tfplan
Note the outputs — you'll need elastic_ip and ssh_command.

Step 2 — SSH into the instance
# Wait ~3 minutes for userdata to complete, then:
ssh -i ~/.ssh/id_rsa ubuntu@<ELASTIC_IP>

# Watch bootstrap progress
tail -f /var/log/coopdata-userdata.log
Step 3 — Deploy the application
# On the EC2 instance:
sudo mkdir -p /opt/coopdata
sudo chown ubuntu:ubuntu /opt/coopdata

# Clone your repo (or use rsync/scp)
git clone https://github.com/your-org/coopdata.git /opt/coopdata
cd /opt/coopdata

# Create the production .env
cp .env.example .env
nano .env   # Fill in all secrets — see the Environment Variables section below
Step 4 — Build and start services
cd /opt/coopdata

# Build images and start everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify all containers are healthy
docker compose ps

# Check logs
docker compose logs -f --tail=100
Step 5 — Verify
# Health check
curl -sf https://coopdata.example.com/api/v1/health

# TLS cert details
openssl s_client -connect coopdata.example.com:443 -servername coopdata.example.com < /dev/null
Environment Variables Reference (Production)
These must be set in /opt/coopdata/.env on the server.

# ── Database ────────────────────────────────────────────────────────────────
POSTGRES_USER=coopdata
POSTGRES_PASSWORD=changeme-postgres-password
POSTGRES_DB=coopdata
DATABASE_URL=postgresql://coopdata:changeme-postgres-password@postgres:5432/coopdata

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Keycloak ─────────────────────────────────────────────────────────────────
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=changeme-keycloak-admin-password
KEYCLOAK_URL=http://keycloak:8180                          # internal Docker URL
KEYCLOAK_REALM=coop-data
KEYCLOAK_CLIENT_ID=coopdata-backend
KEYCLOAK_CLIENT_SECRET=changeme-keycloak-client-secret

# ── Backend ───────────────────────────────────────────────────────────────────
HOST=0.0.0.0
PORT=3000
JWT_ISSUER=https://coopdata.example.com/auth/realms/coop-data
JWT_ISSUER_ALIASES=http://keycloak:8180/realms/coop-data
JWT_AUDIENCE=coopdata-frontend
FRONTEND_URL=https://coopdata.example.com
ENVIRONMENT=production

# ── Storage (MinIO / S3) ──────────────────────────────────────────────────────
STORAGE_TYPE=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=coopdata-uploads
S3_ACCESS_KEY=changeme-minio-access-key
S3_SECRET_KEY=changeme-minio-secret-key
S3_REGION=us-east-1

# ── SMTP ──────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_AUTH=true
SMTP_USER=changeme-email@gmail.com
SMTP_PASSWORD=changeme-app-password
SMTP_FROM=changeme-email@gmail.com
SMTP_FROM_DISPLAY=CoopData

# ── Frontend (build args — baked into the image) ──────────────────────────────
VITE_API_BASE_URL=https://coopdata.example.com/api/v1
VITE_KEYCLOAK_URL=https://coopdata.example.com/auth
VITE_KEYCLOAK_REALM=coop-data
VITE_KEYCLOAK_CLIENT_ID=coopdata-frontend
Generate strong secrets:

openssl rand -base64 32   # for passwords
openssl rand -hex 32      # for keys
Keycloak Production Configuration
After the stack is up, log into Keycloak at https://coopdata.example.com/auth/admin and apply these settings:

Realm settings → General

Frontend URL: https://coopdata.example.com/auth
Realm settings → Email

Fill in your SMTP settings (these match your .env SMTP_* vars)
Clients → coopdata-frontend

Valid Redirect URIs: https://coopdata.example.com/*
Valid Post Logout Redirect URIs: https://coopdata.example.com/*
Web Origins: https://coopdata.example.com
Clients → coopdata-backend

Regenerate the client secret and update KEYCLOAK_CLIENT_SECRET in .env
Restart the backend: docker compose restart backend
Certificate Renewal
Certbot auto-renews via cron (installed by userdata.sh). To manually test renewal:

sudo certbot renew --dry-run
Useful Operations
# Update the app (pull new code, rebuild, restart)
cd /opt/coopdata
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# View logs for a specific service
docker compose logs -f backend

# Run a database migration manually
docker compose exec backend /app/coop-data-backend migrate

# Access the database
docker compose exec postgres psql -U coopdata -d coopdata

# Check Nginx config
sudo nginx -t
sudo systemctl reload nginx

# View the bootstrap log
cat /var/log/coopdata-userdata.log
Instance Sizing Guide
Load	Instance	RAM	Notes
Dev / staging	t3.small	2 GB	May need swap for Keycloak build
Small prod (< 100 users)	t3.medium	4 GB	Minimum recommended
Medium prod (100–500 users)	t3.large	8 GB	Comfortable headroom
Large prod (500+ users)	m6i.xlarge	16 GB	Consider splitting services
For larger deployments, consider:

Moving PostgreSQL to Amazon RDS (managed, automated backups)
Moving Redis to Amazon ElastiCache
Moving MinIO to Amazon S3
Running Keycloak on a separate instance
Putting an ALB in front for horizontal scaling
Security Checklist
[ ] SSH restricted to your IP in the Security Group (ingress port 22)
[ ] .env file has chmod 600 on the server
[ ] No default passwords (change-me-in-production) remain in .env
[ ] Adminer is disabled (ports: [] in docker-compose.prod.yml)
[ ] Swagger UI access is restricted or removed if not needed publicly
[ ] Certbot auto-renewal cron is active: crontab -l | grep certbot
[ ] EBS volume is encrypted (set in ec2.tf — encrypted = true)
[ ] Regular snapshots configured (add an AWS Backup plan via console or Terraform)