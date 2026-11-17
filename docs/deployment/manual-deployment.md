# CoopData — Manual Deployment Guide (Step by Step)

> **Note:** this walkthrough installs CoopData on a Linux server provided by the client (any provider or on-premises, as long as it runs Ubuntu and you have SSH access). For what runs in production and how to operate it, read [`production-runbook.md`](production-runbook.md) first.

> The steps work with a public IP address alone (HTTP). When a domain name points to the server, re-run `setup-ec2.sh` and choose the domain option to get HTTPS. The script name is historical: it works on any Ubuntu server.

---

## Phase 1 — Prepare the server

Ask the client (or their hosting provider) for a server with the following. Nothing else is needed from a cloud account.

| Item | Requirement |
| --- | --- |
| Operating system | Ubuntu 24.04 LTS, 64-bit |
| CPU and memory | At least 2 vCPU and 4 GB RAM for a small installation. Keycloak is slow or crashes below 4 GB. See [`docker-compose-specs.md`](docker-compose-specs.md) for larger sizing |
| Disk | At least 30 GB free (database, uploaded files, container images). More if uploads grow |
| Access | An SSH account with `sudo` rights, preferably with a key rather than a password |
| Network | A fixed public IP address. Inbound **22** (SSH, restricted to known addresses if possible), **80** (HTTP) and, once a domain exists, **443** (HTTPS). All outbound traffic allowed (image pulls, email, AI provider) |
| Domain (optional) | A DNS `A` record pointing to the server's IP, needed for HTTPS |

If the server has a firewall (provider panel or `ufw`), open only those ports. Do not open the database, Redis, MinIO or Keycloak ports: they stay on the Docker network.

## Phase 2 — Note the server address

1. Write down the server's public IP address (or the domain name). This is the address users will open.
2. Check that the address does not change when the server is restarted. If the provider can change it, ask for a fixed IP.
3. Confirm that you can reach the server over SSH (see Phase 4).

---

## Phase 3 — Push Code (Trigger CI Build)

You must push to `main` so GitHub Actions builds and pushes images to GHCR.

```bash
# On YOUR local machine (not the server):
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

## Phase 4 — Connect to the server

### Step 4.1 — Prepare SSH access

Use the account and key the client gave you. If you received a private key file, protect it:

```bash
# On YOUR local machine:
chmod 400 ~/.ssh/<your-key-file>
```

### Step 4.2 — Connect

```bash
ssh -i ~/.ssh/<your-key-file> <user>@<server-ip>
# Replace with the SSH user and the server address you were given.
# If the client gave you a password instead of a key, drop the -i option.
```

If you see:
```
Are you sure you want to continue connecting (yes/no)?
```
Type `yes` and press Enter.

You should now see:
```
<user>@<server-name>:~$
```

---

## Phase 5 — Clone the Repository

### Step 5.1 — Generate Deploy Key

The repo is private, so the server needs a deploy key to clone it.

```bash
# On the server:
ssh-keygen -t ed25519 -f ~/.ssh/coopdata_deploy_key -N "" -C "coopdata-server"
cat ~/.ssh/coopdata_deploy_key.pub
```

Copy the output (starts with `ssh-ed25519 ...`).

### Step 5.2 — Add Deploy Key to GitHub

1. Go to https://github.com/ADORSYS-GIS/CoopData/settings/keys
2. Click **Add deploy key**
3. Title: `coopdata-server`
4. Key: paste the public key from Step 5.1
5. **Allow write access**: no (leave unchecked — read only)
6. Click **Add key**

### Step 5.3 — Configure SSH for GitHub

```bash
# On the server:
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
sudo chown "$USER":"$USER" coopdata
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
  1) Yes — I have a domain pointing to this server (HTTPS with Let's Encrypt)
  2) No  — Use the server public IP address directly (HTTP only, no SSL)

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
║          Server Setup Complete!                        ║
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
   - `quay.io/keycloak/keycloak:26.4.6`
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
7. Back on the server:
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
# On the server:
cd /opt/coopdata
git pull
docker compose -f docker-compose.ghcr.yaml pull
docker compose -f docker-compose.ghcr.yaml up -d --force-recreate
```

If there are new migrations or Keycloak realm changes:
```bash
docker compose -f docker-compose.ghcr.yaml down
docker volume rm coopdata_postgres_data # ONLY if you want to reset the database
docker compose -f docker-compose.ghcr.yaml up -d
```

---

## Phase 12 — Later: Add a Domain (Optional)

When you get a domain name (e.g., `coopdata.example.com`):

1. Point the DNS A record to the server IP address
2. Open **HTTPS (443)** from anywhere in the server firewall (provider panel or `ufw`)
3. On the server:
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