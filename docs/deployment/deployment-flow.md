# CoopData Manual Deployment — Complete Flow

```
YOUR MACHINE          GITHUB CI              EC2 INSTANCE
─────────────         ──────────             ────────────
1. git push    ──▶   2. Builds images  ──▶  (images in GHCR)
                       Pushes to GHCR
                                              3. git clone
                                              4. sudo ./setup-ec2.sh
                                              5. nano .env
                                              6. ./start-prod.sh
                                                   ↓
                                              7. Services UP
                                              8. Share link
```

---

## PREREQUISITES

### EC2 Instance
- **Type**: t3.medium (2 vCPU, 4GB RAM) minimum
- **AMI**: Ubuntu 24.04 LTS
- **Storage**: 30GB gp3
- **Security Groups**:
  - Port 22 SSH → Your IP only
  - Port 80 HTTP → 0.0.0.0/0
  - Port 443 HTTPS → 0.0.0.0/0
- **Elastic IP**: Allocate and associate

### DNS
- Point your domain to the EC2 Elastic IP
- Wait for DNS propagation

### Repo Access (one-time)
- Add EC2 SSH public key as a **Deploy Key** in GitHub repo settings
  ```bash
  # On EC2:
  ssh-keygen -t ed25519 -f ~/.ssh/coopdata_deploy_key -N ""
  cat ~/.ssh/coopdata_deploy_key.pub
  # → Copy to GitHub: Repo Settings → Deploy keys → Add deploy key
  ```

---

## STEP 1 — Push Code (Builds Images via CI)

```bash
# On your machine:
git push origin main
```

GitHub Actions builds and pushes:
- `ghcr.io/adorsys-gis/coopdata-backend:latest`
- `ghcr.io/adorsys-gis/coopdata-frontend:latest`

Wait ~5-10 minutes for CI to finish.

---

## STEP 2 — Clone Repo on EC2

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2-IP>

# Clone using deploy key
git clone git@github.com:ADORSYS-GIS/CoopData.git /opt/coopdata
cd /opt/coopdata
```

---

## STEP 3 — Run Setup Script

```bash
sudo ./setup-ec2.sh
```

This installs Docker, Nginx, Certbot, obtains SSL certificate, and configures the reverse proxy.
It prompts for your domain name and email.

It also creates `.env` from `.env.example` with your domain pre-filled.

---

## STEP 4 — Edit .env

```bash
nano .env
```

Set strong passwords (generate with `openssl rand -base64 32`):

```
POSTGRES_PASSWORD=<strong>
KEYCLOAK_ADMIN_PASSWORD=<strong>
KEYCLOAK_CLIENT_SECRET=<from-keycloak-console>
S3_ACCESS_KEY=<strong>
S3_SECRET_KEY=<strong>
COOPDATA_DGRV_ADMIN_PASSWORD=<strong>
COOPDATA_MINISTRY_ADMIN_PASSWORD=<strong>
```

Verify domain values are correct:
```
DOMAIN_NAME=coopdata.example.com
FRONTEND_URL=https://coopdata.example.com
JWT_ISSUER=https://coopdata.example.com/auth/realms/coop-data
```

---

## STEP 5 — Start the App

```bash
./start-prod.sh
```

Pulls all images from GHCR, starts services, waits for health checks.

Output:
```
╔═══════════════════════════════════════════════════════════════╗
║              CoopData Production is Running!                  ║
╚═══════════════════════════════════════════════════════════════╝

  ►  Frontend App:     https://coopdata.example.com
  ►  Backend API:      https://coopdata.example.com/api/v1
  ►  Keycloak Console:  https://coopdata.example.com/auth/admin
  ►  Health Check:      https://coopdata.example.com/api/v1/health
```

---

## STEP 6 — Share the Link

```
Application:  https://coopdata.example.com
Admin:        https://coopdata.example.com/auth/admin
Credentials:  admin / <KEYCLOAK_ADMIN_PASSWORD>
```

---

## UPDATING THE APP

```bash
# On your machine:
git push origin main     # CI rebuilds + pushes new images

# On EC2:
cd /opt/coopdata
git pull                                           # gets new migrations/keycloak config
docker compose -f docker-compose.ghcr.yaml pull    # pulls new GHCR images
docker compose -f docker-compose.ghcr.yaml up -d   # restarts with new images
```

---

## KEYCLOAK POST-SETUP (if needed)

1. `https://coopdata.example.com/auth/admin`
2. Login: `admin` / `<KEYCLOAK_ADMIN_PASSWORD>`
3. Realm settings → Frontend URL: `https://coopdata.example.com/auth`
4. Clients → `coopdata-backend` → Credentials → Regenerate secret
5. Copy secret to `.env` → `KEYCLOAK_CLIENT_SECRET=<new>`
6. `docker compose -f docker-compose.ghcr.yaml restart backend`