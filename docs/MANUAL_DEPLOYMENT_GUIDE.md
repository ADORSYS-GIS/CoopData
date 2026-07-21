# CoopData — Manual Deployment Guide (Step by Step)

> This guide assumes **no domain name**. We use the EC2 public IP address directly.
> When you get a domain later, re-run `setup-ec2.sh` and choose the domain option.

---

## Phase 1 — Create the EC2 Instance

### Step 1.1 — Log into AWS

1. Go to https://console.aws.amazon.com
2. Sign in with your AWS account
3. Make sure you're in the right region (top right, e.g. **eu-central-1** Frankfurt or **us-east-1** N. Virginia)

### Step 1.2 — Launch Instance

1. Top search bar → type **EC2** → click **EC2**
2. Click **Launch instance** (orange button)

### Step 1.3 — Name and Tags

1. **Name**: `coopdata-prod`
2. Under **Tags** — it auto-creates a Name tag. No other tags needed.

### Step 1.4 — Application and OS Image

1. **Application**: leave as default (Amazon Linux or Ubuntu)
2. **OS**: select **Ubuntu** → **Ubuntu 24.04 LTS** (the free tier eligible one)
   - Look for the one that says "64-bit (x86)" and "Free tier eligible" badge
   - Example AMI: `ami-0c10142cd0f7cacbb` (changes over time — just pick Ubuntu 24.04 LTS)

### Step 1.5 — Instance Type

1. Select **t3.medium** (2 vCPU, 4 GB RAM)
   - This is the minimum for CoopData (PostgreSQL + Keycloak + Rust + React + Redis + MinIO)
   - If cost is a concern for testing: **t3.small** (2 GB RAM) may work but Keycloak may be slow
   - Do NOT use `t2.micro` — only 1 GB RAM, Keycloak will crash

### Step 1.6 — Key Pair (SSH Access)

1. **Key pair name** dropdown:
   - If you have an existing key pair → select it
   - If not → click **Create new key pair**:
     - Name: `coopdata-key`
     - Type: **ED25519**
     - Click **Create key pair**
     - **IMPORTANT**: Your browser downloads a `.pem` file. **Save it somewhere safe** — you cannot download it again.

2. Note where you saved it (e.g., `~/Downloads/coopdata-key.pem`)

### Step 1.7 — Network Settings (Security Group)

This is critical — controls what ports are open.

1. Under **Network settings** → **Firewall (security groups)**:
   - Select **Create security group**

2. **Inbound security group rules** — you need exactly these 3 rules:

   | Type      | Port | Source         | Why                    |
   |-----------|------|----------------|------------------------|
   | SSH       | 22   | My IP          | SSH access (your IP only, NOT 0.0.0.0/0) |
   | HTTP      | 80   | 0.0.0.0/0      | Web traffic            |

   **How to add them:**
   - SSH rule is auto-added. Change "Source" from `Anywhere` to **My IP**
     (AWS detects your current public IP automatically)
   - Click **Add security group rule**:
     - Type: **HTTP**
     - Source: **Anywhere (0.0.0.0/0)**
   - Do NOT add HTTPS (443) yet — we don't have a domain, so no SSL needed

3. Leave **Outbound rules** as default (all traffic allowed)

### Step 1.8 — Storage

1. **Root volume**:
   - Size: change from 8 to **30 GB** (migrations + MinIO uploads + database)
   - Volume type: **gp3** (faster than gp2, same price)
   - Delete on termination: ✅ check it

2. Click **Advanced** (expand) just to verify:
   - Encrypted: leave as default (or enable if you prefer)

### Step 1.9 — Launch

1. On the right panel, review your settings:
   - Ubuntu 24.04 LTS
   - t3.medium
   - 30 GB gp3
   - Key pair selected
   - Security group: SSH (your IP) + HTTP (all)

2. Click **Launch instance** (orange button, bottom right)

3. Wait 30 seconds, then click **View all instances**

---

## Phase 2 — Get the Public IP

### Step 2.1 — Find Your Instance

1. In EC2 Dashboard → **Instances**
2. Find `coopdata-prod` in the list
3. Click on it to see details

### Step 2.2 — Copy Public IP

1. In the details panel (right side or bottom), find:
   - **Public IPv4 address**: e.g., `3.71.123.45`
2. **Write this down** — this is what you'll send to the client as the link
3. **⚠️ Note**: Without an Elastic IP, this address **changes if you stop/restart the instance**. For production, allocate an Elastic IP (Step 2.3). For quick testing, skip.

### Step 2.3 — (Optional) Allocate Elastic IP

An Elastic IP ensures the public IP never changes even if you stop/start the instance.

1. Left sidebar → **Network & Security** → **Elastic IPs**
2. Click **Allocate Elastic IP address** → **Allocate**
3. Select the new Elastic IP → **Actions** → **Associate Elastic IP address**
4. Select your `coopdata-prod` instance → **Associate**
5. Note the new Elastic IP (e.g., `3.125.67.89`)
6. Use this IP instead of the auto-assigned one

---

## Phase 3 — Push Code (Trigger CI Build)

You must push to `main` so GitHub Actions builds and pushes images to GHCR.

```bash
# On YOUR local machine (not EC2):
cd /path/to/CoopData
git add -A
git commit -m "feat(deployment): production deployment setup"
git push origin main
```

**What happens:**
- GitHub Actions builds `ghcr.io/adorsys-gis/coopdata-backend:latest`
- GitHub Actions builds `ghcr.io/adorsys-gis/coopdata-frontend:latest`
- Takes ~5-10 minutes
- Go to GitHub → **Actions** tab to watch the build. Wait for the green checkmark.

---

## Phase 4 — SSH into EC2

### Step 4.1 — Prepare SSH Key

```bash
# On YOUR local machine:
# Move the .pem file to your .ssh directory
cp ~/Downloads/coopdata-key.pem ~/.ssh/
chmod 400 ~/.ssh/coopdata-key.pem
```

### Step 4.2 — Connect

```bash
ssh -i ~/.ssh/coopdata-key.pem ubuntu@3.71.123.45
# Replace with your actual public IP
```

If you see:
```
Are you sure you want to continue connecting (yes/no)?
```
Type `yes` and press Enter.

You should now see:
```
ubuntu@ip-172-31-xx-xx:~$
```

---

## Phase 5 — Clone the Repository

### Step 5.1 — Generate Deploy Key

The repo is private, so EC2 needs a deploy key to clone it.

```bash
# On EC2:
ssh-keygen -t ed25519 -f ~/.ssh/coopdata_deploy_key -N "" -C "coopdata-ec2"
cat ~/.ssh/coopdata_deploy_key.pub
```

Copy the output (starts with `ssh-ed25519 ...`).

### Step 5.2 — Add Deploy Key to GitHub

1. Go to https://github.com/ADORSYS-GIS/CoopData/settings/keys
2. Click **Add deploy key**
3. Title: `coopdata-ec2`
4. Key: paste the public key from Step 5.1
5. **Allow write access**: ❌ (leave unchecked — read only)
6. Click **Add key**

### Step 5.3 — Configure SSH for GitHub

```bash
# On EC2:
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/coopdata_deploy_key
  StrictHostKeyChecking accept-new
EOF
chmod 600 ~/.ssh/config

# Test:
ssh -T git@github.com
# Should say: "Hi CoopData! You've successfully authenticated..."
```

### Step 5.4 — Clone

```bash
cd /opt
sudo mkdir -p coopdata
sudo chown ubuntu:ubuntu coopdata
git clone git@github.com:ADORSYS-GIS/CoopData.git /opt/coopdata
cd /opt/coopdata
```

Verify key files exist:
```bash
ls docker-compose.ghcr.yaml setup-ec2.sh start-prod.sh .env.example
# Should show all 4 files
```

---

## Phase 6 — Run Setup Script

This installs Docker, Nginx, and configures the reverse proxy.

```bash
cd /opt/coopdata
sudo ./setup-ec2.sh
```

### What the script will ask you:

```
Do you have a domain name configured?
  1) Yes — I have a domain pointing to this EC2 (HTTPS with Let's Encrypt)
  2) No  — Use the EC2 public IP address directly (HTTP only, no SSL)

Enter choice [1-2]:
```

**Press `2`** (no domain → IP mode)

The script then:
1. Updates Ubuntu
2. Installs Docker
3. Installs Nginx
4. Configures Nginx as reverse proxy on port 80 (HTTP only)
5. Creates `.env` from `.env.example` with your IP pre-filled

Expected output:
```
╔══════════════════════════════════════════════════════╗
║          EC2 Setup Complete!                           ║
╚══════════════════════════════════════════════════════╝

  ► Mode:      IP Address (HTTP)
  ► Public IP: 3.71.123.45
  ► URL:       http://3.71.123.45
  ► Note:      No SSL. Browser will show 'Not Secure'.
  ► Nginx:     Reverse proxy configured
  ► Docker:    Installed

  NEXT STEPS:
    1. Edit .env:                nano .env
    2. Set strong passwords      (openssl rand -base64 32)
    3. Start CoopData:           ./start-prod.sh
```

---

## Phase 7 — Configure .env

```bash
cd /opt/coopdata
nano .env
```

### What to change:

#### 7.1 — Generate Strong Passwords

Open a second SSH session (or just note these) and generate secrets:
```bash
openssl rand -base64 32
```
Run this 5 times and copy each result.

#### 7.2 — Edit the .env file

Update these lines with your generated secrets:

```bash
# ── Database ──────────────────────────────────────────
POSTGRES_PASSWORD=PasteFirstGeneratedSecretHere
DATABASE_URL=postgresql://coopdata:PasteFirstGeneratedSecretHere@postgres:5432/coopdata

# ── Keycloak Admin ────────────────────────────────────
KEYCLOAK_ADMIN_PASSWORD=PasteSecondGeneratedSecretHere

# ── Keycloak Client Secret ───────────────────────────
# Leave as "change-me-in-production" for now.
# After starting, get the real secret from Keycloak console.
KEYCLOAK_CLIENT_SECRET=change-me-in-production

# ── Storage ──────────────────────────────────────────
S3_ACCESS_KEY=PasteThirdGeneratedSecretHere
S3_SECRET_KEY=PasteFourthGeneratedSecretHere

# ── Admin Users ──────────────────────────────────────
COOPDATA_DGRV_ADMIN_PASSWORD=PasteFifthGeneratedSecretHere
COOPDATA_MINISTRY_ADMIN_PASSWORD=AnotherStrongPassword
```

#### 7.3 — Verify URL settings (auto-filled by setup script)

The script already filled these in. Verify they look like:
```bash
DOMAIN_NAME=3.71.123.45
FRONTEND_URL=http://3.71.123.45
JWT_ISSUER=http://3.71.123.45/auth/realms/coop-data
JWT_ISSUER_ALIASES=http://keycloak:8180/realms/coop-data
ENVIRONMENT=production
```

#### 7.4 — Save and exit

In nano:
- `Ctrl+O` → press Enter to save
- `Ctrl+X` to exit

#### 7.5 — Set file permissions

```bash
chmod 600 .env
```

---

## Phase 8 — Start the Application

```bash
cd /opt/coopdata
./start-prod.sh
```

### What happens:

1. Checks Docker is installed
2. Validates `.env`
3. **Pulls all images** from GHCR + Docker Hub:
   - `postgres:16-alpine`
   - `redis:7-alpine`
   - `minio/minio:latest`
   - `quay.io/keycloak/keycloak:26.3.1`
   - `ghcr.io/adorsys-gis/coopdata-backend:latest`
   - `ghcr.io/adorsys-gis/coopdata-frontend:latest`
4. Starts all containers
5. Waits for health checks (60-180 seconds)
6. Runs Keycloak provisioning (creates admin users)
7. Prints final URLs

### Expected output:

```
╔═════════════════════════════════════════════════════════════════════════╗
║              CoopData Production is Running!                            ║
╚═════════════════════════════════════════════════════════════════════════╝

  ►  Frontend App:     http://3.71.123.45
  ►  Backend API:      http://3.71.123.45/api/v1
  ►  Swagger UI:        http://3.71.123.45/swagger-ui/
  ►  Keycloak Console:  http://3.71.123.45/auth/admin
  ►  Health Check:      http://3.71.123.45/api/v1/health

  Useful commands:
    docker compose -f docker-compose.ghcr.yaml logs -f          Follow all logs
    docker compose -f docker-compose.ghcr.yaml logs -f backend  Follow backend logs
    docker compose -f docker-compose.ghcr.yaml ps               Check service status
    docker compose -f docker-compose.ghcr.yaml down             Stop (keep data)
    docker compose -f docker-compose.ghcr.yaml down -v          Stop + DELETE data
```

### If it fails:

```bash
# Check which services are running
docker compose -f docker-compose.ghcr.yaml ps

# Check logs for a failing service
docker compose -f docker-compose.ghcr.yaml logs backend
docker compose -f docker-compose.ghcr.yaml logs keycloak
docker compose -f docker-compose.ghcr.yaml logs postgres

# Common fixes:
# 1. Backend can't connect to database → check POSTGRES_PASSWORD in .env
# 2. Keycloak won't start → check KC_DB_PASSWORD matches POSTGRES_PASSWORD
# 3. Frontend won't load → check Nginx: sudo nginx -t && sudo systemctl reload nginx

# Restart everything:
docker compose -f docker-compose.ghcr.yaml down
./start-prod.sh
```

---

## Phase 9 — Verify

### Step 9.1 — From your local machine

```bash
# Test backend health
curl http://3.71.123.45/api/v1/health
# Should return: {"status":"ok"}

# Test frontend (should return HTML)
curl -I http://3.71.123.45
# Should return: HTTP/1.1 200 OK
```

### Step 9.2 — In your browser

1. Open: `http://3.71.123.45`
   - You'll see the CoopData login page
   - Browser shows "Not Secure" — this is normal without SSL

2. Open: `http://3.71.123.45/auth/admin`
   - Keycloak admin console
   - Login: `admin` / `<KEYCLOAK_ADMIN_PASSWORD from .env>`

3. Open: `http://3.71.123.45/swagger-ui/`
   - API documentation

### Step 9.3 — Fix Keycloak Client Secret

The Keycloak provisioning auto-created the `coopdata-backend` client with a random secret. You need to sync it:

1. Go to `http://3.71.123.45/auth/admin`
2. Login: `admin` / `<KEYCLOAK_ADMIN_PASSWORD>`
3. Top-left dropdown → select **coop-data** realm (not master)
4. Left menu → **Clients** → click **coopdata-backend**
5. Tab → **Credentials**
6. Copy the **Client secret** value
7. Back on EC2:
   ```bash
   cd /opt/coopdata
   nano .env
   # Update line: KEYCLOAK_CLIENT_SECRET=paste-copied-secret-here
   # Save: Ctrl+O, Enter, Ctrl+X
   docker compose -f docker-compose.ghcr.yaml restart backend
   ```
8. Wait 30 seconds, then verify:
   ```bash
   curl http://3.71.123.45/api/v1/health
   ```

### Step 9.4 — Test Login

1. Go to `http://3.71.123.45`
2. Click **Login** (or you'll be redirected to Keycloak login)
3. Login with:
   - Username: email from `COOPDATA_DGRV_ADMIN_EMAIL` in `.env`
   - Password: value of `COOPDATA_DGRV_ADMIN_PASSWORD` in `.env`
4. You should be redirected back to the CoopData dashboard

---

## Phase 10 — Share the Link with the Client

Send this to the client:

```
CoopData Application
─────────────────────

Application URL:  http://3.71.123.45
Admin Console:    http://3.71.123.45/auth/admin

Login Credentials:
  Admin:   admin / <keycloak-admin-password>
  DGRV:    <dgrv-admin-email> / <dgrv-admin-password>

API Health: http://3.71.123.45/api/v1/health
API Docs:   http://3.71.123.45/swagger-ui/
```

**Note**: Tell the client this is HTTP (no SSL). The browser will show "Not Secure". This is fine for demo/testing. When you get a domain, re-run setup to add HTTPS.

---

## Phase 11 — Updating the App

When you push new code to `main`:

```bash
# On EC2:
cd /opt/coopdata
git pull
docker compose -f docker-compose.ghcr.yaml pull
docker compose -f docker-compose.ghcr.yaml up -d --force-recreate
```

If there are new migrations or Keycloak realm changes:
```bash
docker compose -f docker-compose.ghcr.yaml down
docker volume rm coopdata_postgres_data  # ⚠️ ONLY if you want to reset the database
docker compose -f docker-compose.ghcr.yaml up -d
```

---

## Phase 12 — Later: Add a Domain (Optional)

When you get a domain name (e.g., `coopdata.example.com`):

1. Point DNS A record to your EC2 Elastic IP
2. Update AWS Security Group: add **HTTPS (443)** rule → `0.0.0.0/0`
3. On EC2:
   ```bash
   cd /opt/coopdata
   sudo ./setup-ec2.sh
   # Choose option 1 (domain mode)
   # Enter your domain + email
   ```
4. Update `.env`:
   ```bash
   nano .env
   # Change:
   DOMAIN_NAME=coopdata.example.com
   FRONTEND_URL=https://coopdata.example.com
   JWT_ISSUER=https://coopdata.example.com/auth/realms/coop-data
   ```
5. Restart:
   ```bash
   ./start-prod.sh
   ```
6. Now the link is: `https://coopdata.example.com` (with SSL)

---

## Quick Reference — All Commands

```bash
# ── Initial Setup ──
ssh -i ~/.ssh/coopdata-key.pem ubuntu@<IP>
git clone git@github.com:ADORSYS-GIS/CoopData.git /opt/coopdata
cd /opt/coopdata
sudo ./setup-ec2.sh           # installs Docker + Nginx
nano .env                     # set passwords
./start-prod.sh               # starts everything

# ── Daily Operations ──
docker compose -f docker-compose.ghcr.yaml ps           # check status
docker compose -f docker-compose.ghcr.yaml logs -f      # follow logs
docker compose -f docker-compose.ghcr.yaml restart backend  # restart backend

# ── Update ──
cd /opt/coopdata
git pull
docker compose -f docker-compose.ghcr.yaml pull
docker compose -f docker-compose.ghcr.yaml up -d --force-recreate

# ── Stop ──
docker compose -f docker-compose.ghcr.yaml down         # stop (keep data)
docker compose -f docker-compose.ghcr.yaml down -v        # stop + DELETE all data

# ── Database Access ──
docker compose -f docker-compose.ghcr.yaml exec postgres psql -U coopdata -d coopdata

# ── Test ──
curl http://<IP>/api/v1/health
```