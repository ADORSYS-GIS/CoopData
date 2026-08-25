# CoopData Enterprise Production Deployment & Operations Specification

> 📖 **MASTER SPECIFICATIONS**:
> - 🚀 **Release Strategy & SemVer Guide**: [`RELEASE_STRATEGY_GUIDE.md`](file:///home/ariel/Desktop/CoopData/docs/RELEASE_STRATEGY_GUIDE.md)
> - 🛡️ **Backup & Disaster Recovery Guide**: [`BACKUP_AND_RECOVERY_GUIDE.md`](file:///home/ariel/Desktop/CoopData/docs/BACKUP_AND_RECOVERY_GUIDE.md)

---

## 🏗️ 1. Architecture & Port Exposure Matrix

CoopData runs as a single-host, self-healing Docker Compose stack behind an Nginx reverse proxy on Ubuntu 24.04 LTS.

```
                  INTERNET / USERS
                          │
                          ▼
            [Port 80 (HTTP) / 443 (HTTPS)]
                          │
            ┌─────────────┴─────────────┐
            │  Nginx Host Proxy (TLS)   │
            └─────────────┬─────────────┘
                          │
  ┌───────────────────────┼────────────────────────┐
  │ Docker Private Network (coopdata_net)          │
  │                                                │
  │  ├── /                → frontend:80 (React)   │
  │  ├── /api/v1          → backend:3000 (Rust)   │
  │  ├── /auth/, /realms/ → keycloak:8180 (IAM)   │
  │  ├── /minio/          → minio:9000 (S3)       │
  │  └── /grafana/        → grafana:3000 (Metrics) │
  │                                                │
  │ Internal Dependencies:                          │
  │  postgres:5432 · redis:6379 · gotenberg:3000   │
  │  prometheus:9090 · autoheal (docker.sock)     │
  └────────────────────────────────────────────────┘
```

### Security & Port Isolation Table
| Service | Container Port | Exposed to Host / Internet | Purpose |
|---|---|---|---|
| **Nginx Host Proxy** | `80`, `443` | **Public (0.0.0.0)** | TLS termination & reverse proxy routing |
| **Frontend SPA** | `80` | `127.0.0.1:5174` | Static Nginx hosting React bundle |
| **Backend API** | `3000` | `127.0.0.1:3000` | Axum Rust REST API & Swagger UI |
| **Keycloak IAM** | `8180` | `127.0.0.1:8180` | OpenID Connect / OAuth2 server |
| **MinIO S3** | `9000`, `9001` | `127.0.0.1:9100`, `9101` | S3-compatible file storage API & console |
| **PostgreSQL** | `5432` | **Internal Only** | Primary DB (`coopdata` + `keycloak` DBs) |
| **Redis** | `6379` | **Internal Only** | Cache layer & session store |
| **Gotenberg** | `3000` | `127.0.0.1:8081` | Chromium PDF conversion engine |
| **Prometheus** | `9090` | `127.0.0.1:9090` | Time-series metrics engine |
| **Grafana** | `3000` | `127.0.0.1:3001` | Observability & alert dashboards |

---

## 📋 2. Phase 1 — Server & Prerequisites Provisioning

### Host System Requirements
- **OS**: Ubuntu 24.04 LTS (recommended) or 22.04 LTS
- **CPU / RAM**: Minimum 4 vCPUs / 8GB RAM (16GB RAM recommended for production)
- **Disk**: Minimum 40GB gp3 SSD storage
- **AWS EC2 Security Group Inbound Rules**:
  - `SSH` (Port 22): Restrict to administrative IP range
  - `HTTP` (Port 80): `0.0.0.0/0` (Auto-redirects to HTTPS)
  - `HTTPS` (Port 443): `0.0.0.0/0` (TLS user traffic)

---

## 🚀 3. Phase 2 — Initial Host Setup (`setup-ec2.sh`)

On a fresh server instance, execute the automated host setup script:

```bash
git clone https://github.com/ADORSYS-GIS/CoopData.git /opt/coopdata
cd /opt/coopdata
sudo ./setup-ec2.sh
```

### What `setup-ec2.sh` Performs Automatically:
1. **System & Tool Installation**: Installs Docker Engine, Docker Compose V2, Nginx, Certbot, and Python tools.
2. **TLS Certificate Provisioning**: Obtains Let's Encrypt TLS certificates (or generates self-signed certs if domain is pending).
3. **Nginx Reverse Proxy Config**: Writes `/etc/nginx/sites-available/coopdata` routing `/`, `/api/v1`, `/auth`, `/realms`, and `/grafana`.
4. **Docker Daemon Log Rotation**: Configures `/etc/docker/daemon.json` (`json-file`, 10MB $\times$ 3 log retention per container).
5. **Zero-Downtime CLI Plugin**: Installs `docker-rollout` plugin at `~/.docker/cli-plugins/docker-rollout`.
6. **Nightly Offsite Backup Cron**: Registers `/etc/cron.d/coopdata-backup` running [`scripts/backup-production.sh`](file:///home/ariel/Desktop/CoopData/scripts/backup-production.sh) daily at 02:00 AM.
7. **Environment Template**: Generates local `.env` file pre-filled with host domain parameters.

---

## ⚙️ 4. Phase 3 — Environment Configuration (`.env`)

Edit `/opt/coopdata/.env` to configure production secrets:

```bash
nano /opt/coopdata/.env
```

### Critical Production Variables to Configure:
```env
# ── Passwords (generate using: openssl rand -base64 32)
POSTGRES_PASSWORD=generate-strong-password-here
KEYCLOAK_ADMIN_PASSWORD=generate-strong-password-here
KEYCLOAK_CLIENT_SECRET=generate-strong-password-here
S3_ACCESS_KEY=generate-minio-access-key
S3_SECRET_KEY=generate-minio-secret-key

# ── Domain Settings
DOMAIN_NAME=coopdata.example.com
FRONTEND_URL=https://coopdata.example.com
JWT_ISSUER=https://coopdata.example.com/realms/coop-data
JWT_ISSUER_ALIASES=https://coopdata.example.com/realms/coop-data,http://keycloak:8180/realms/coop-data
JWT_AUDIENCE=coopdata-frontend
ENVIRONMENT=production

# ── Offsite Backup Target (AWS S3 or Hetzner S3)
BACKUP_S3_BUCKET=coopdata-production-backups
BACKUP_S3_PREFIX=postgres
BACKUP_S3_ENDPOINT=                # Blank for AWS S3, set for Hetzner/MinIO
BACKUP_RETENTION_DAYS=30
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

---

## 🏁 5. Phase 4 — Stack Bootstrapping (`./start-prod.sh`)

Boot the stack for the first time:

```bash
./start-prod.sh
```

### Startup Sequence & Dependency Graph:
1. `postgres` (Waits for `pg_isready` healthy check)
2. `redis` & `minio` (Waits for healthchecks)
3. `keycloak` (Waits for HTTP `/health/ready` check)
4. `keycloak-provision` (One-shot task: creates DGRV Super Admin, Ministry Admin users, and configures SMTP settings)
5. `backend` (Rust Axum API) & `frontend` (React Nginx SPA)
6. `prometheus`, `grafana`, and `autoheal` monitoring watchdog

### Operational Endpoints:
- **Frontend SPA Application**: `https://coopdata.example.com`
- **Backend API**: `https://coopdata.example.com/api/v1`
- **Swagger Open API UI**: `https://coopdata.example.com/swagger-ui/`
- **Keycloak IAM Admin Console**: `https://coopdata.example.com/auth/admin`
- **Health Check Endpoint**: `https://coopdata.example.com/api/v1/health`

---

## 🤖 6. Phase 5 — CI/CD & Automated Semantic Releases

### 📝 Commit Convention Rules
Developers use Conventional Commit prefixes. Google's `release-please` action ([`.github/workflows/release-please.yml`](file:///home/ariel/Desktop/CoopData/.github/workflows/release-please.yml)) inspects commit prefixes on `main` to calculate SemVer tags:

| Commit Prefix | Release Type | Version Bump | Example Commit |
|---|---|---|---|
| `fix:` | **Patch** | `v1.0.0` $\rightarrow$ `v1.0.1` | `fix: resolve token expiration retry on keycloak` |
| `feat:` | **Minor** | `v1.0.0` $\rightarrow$ `v1.1.0` | `feat: add peer benchmarking export to excel` |
| `feat!:` / `BREAKING CHANGE:` | **Major** | `v1.0.0` $\rightarrow$ `v2.0.0` | `feat!: overhaul database schema for non-financial indicators` |

### 🔄 CI/CD Pipeline Stages ([`.github/workflows/docker.yml`](file:///home/ariel/Desktop/CoopData/.github/workflows/docker.yml))
1. **`build-scan` Job**: Compiles frontend/backend Docker images and runs Trivy security vulnerability scanner.
2. **`publish` Job**: Pushes tagged images to GitHub Container Registry:
   - `ghcr.io/adorsys-gis/coopdata-backend:v1.1.0`
   - `ghcr.io/adorsys-gis/coopdata-backend:v1.1`
   - `ghcr.io/adorsys-gis/coopdata-backend:v1`
   - `ghcr.io/adorsys-gis/coopdata-backend:latest`
3. **`deploy` Job**: Connects to EC2 server over SSH (`PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`) and triggers zero-downtime deployment script `./scripts/deploy.sh`.

---

## 🔄 7. Phase 6 — Zero-Downtime Deployment & Version Targeting (`scripts/deploy.sh`)

### Deploying Updates or Targeting Specific Versions

#### Mode 1: Fully Automated Day-to-Day Releases (Zero Typing)
1. Developers write Conventional Commits (`feat:`, `fix:`).
2. When the **Release PR** created by `release-please` is merged into `main`, GitHub Actions **automatically** builds the images, publishes tags (`:v1.1.0`, `:latest`), and triggers `./scripts/deploy.sh` on the server over SSH.
3. **Zero manual typing or SSH required.**

#### Mode 2: Manual Version Override or Rollback via GitHub Actions UI
If you want to forcefully deploy or rollback to a **specific past release version** (e.g. `v1.0.5`):
1. Go to **GitHub Repository $\rightarrow$ Actions tab $\rightarrow$ Docker Build, Scan & Publish**.
2. Click **Run workflow** dropdown on the right.
3. Enter `v1.0.5` in the **target_tag** input box.
4. Click **Run workflow**.

> GitHub Actions connects to the EC2 server over SSH and executes `./scripts/deploy.sh v1.0.5`, performing a zero-downtime rolling update directly to `v1.0.5`.

#### Mode 3: Manual Version Target on Server Terminal
```bash
# Deploy specific release version v1.0.5 on server:
./scripts/deploy.sh v1.0.5

# Deploy specific version for backend only:
./scripts/deploy.sh backend v1.0.5
```

### Under-the-Hood Deployment Execution:
1. Pulls specified container images from GHCR (`backend:${TAG}`, `frontend:${TAG}`).
2. Runs `docker rollout backend` & `docker rollout frontend`:
   - Spins up new container instance `v2` alongside active instance `v1`.
   - Polls `v2` health check endpoint (`http://localhost:3000/api/v1/health`).
   - If `v2` fails to boot, **aborts rollout and keeps `v1` running** (zero user impact).
   - When `v2` turns `healthy`, Nginx shifts live HTTP traffic to `v2`.
   - Gracefully stops and removes `v1`.
3. Verifies post-deploy API health.
4. **Client Downtime**: **0 Seconds** (< 1 sec connection drop window).

---

## 🛡️ 8. Phase 7 — Self-Healing, Resource Hardening & Monitoring

### Auto-Healing Watchdog (`willfarrell/autoheal`)
- Monitored services: `postgres`, `redis`, `minio`, `keycloak`, `backend`, `frontend`, `gotenberg`.
- Periodically runs HTTP `/health` checks every 5 seconds.
- If a container enters an `unhealthy` state, `autoheal` automatically issues a restart command via `/var/run/docker.sock` in **< 30 seconds**.

### Cgroup Resource Caps (`docker-compose.ghcr.yaml`)
| Service | CPU Limit | Memory Limit | Memory Reservation |
|---|---|---|---|
| `postgres` | 2.00 CPUs | 2048 MB | 512 MB |
| `backend` | 1.50 CPUs | 1024 MB | 256 MB |
| `keycloak` | 1.50 CPUs | 1536 MB | 512 MB |
| `gotenberg` | 1.00 CPUs | 1536 MB | 256 MB |
| `minio` | 1.00 CPUs | 1024 MB | 256 MB |
| `frontend` | 0.50 CPUs | 256 MB | 64 MB |
| `redis` | 0.50 CPUs | 512 MB | 64 MB |

---

## 🚑 9. Phase 8 — Backups & Disaster Recovery

### Nightly 3-Layer Offsite Backup
Executes automatically every night at 02:00 AM UTC via `/etc/cron.d/coopdata-backup`:
```bash
# Manual on-demand backup test:
./scripts/backup-production.sh
```
- **Layer 1**: App PostgreSQL DB (`coopdata`)
- **Layer 2**: Keycloak IAM DB (`keycloak`) & Realm/Theme configuration files
- **Layer 3**: MinIO S3 Object Storage Data (`/data` uploaded PDFs, spreadsheets, images)
- **Retention**: Auto-prunes offsite S3 backups older than 30 days.

### Disaster Recovery Restore
In case of total server loss, provision fresh server and execute:
```bash
./scripts/restore-production.sh
```
1. Downloads offsite artifacts from S3.
2. Restores PostgreSQL databases.
3. Restores Keycloak configs & MinIO storage files.
4. Restarts container connection pools and verifies API health.

---

## ⏱️ 10. Service Level Agreements (SLAs) & Incident Scenarios

| Metric | Target SLA | How it is Achieved | Client Impact |
|---|---|---|---|
| **Deployment Downtime** | **0 Seconds** (< 1 sec drop window) | `docker-rollout` boots version `v2` alongside `v1`, verifies health, and cuts traffic over in Nginx before stopping `v1`. | Zero interruption for users working in the app during deployments. |
| **Self-Healing Recovery Time (RTO - Auto)** | **< 30 Seconds** | `willfarrell/autoheal` watchdog checks HTTP `/health` every 5s and automatically restarts crashed/frozen containers. | Minor pause for < 30s if a single service freezes; recovers without manual admin intervention. |
| **Disaster Recovery Time (RTO - Full Server Loss)** | **< 15 Minutes** | Provision fresh EC2 host $\rightarrow$ run `sudo ./setup-ec2.sh` $\rightarrow$ run `./scripts/restore-production.sh <date>`. | In the event of catastrophic server hardware destruction, full platform restored in under 15 minutes. |
| **Data Loss Window (RPO - Recovery Point)** | **< 24 Hours** *(or < 1 hr with EBS snapshots)* | Nightly automated offsite backups (`backup-production.sh`) at 02:00 AM to AWS S3 / Hetzner S3. | Maximum potential data loss limited to transactions made since 02:00 AM backup. |

---

### 🔍 Detailed SLA Explanations & Real-World Incident Examples

#### 1. Deployment Downtime (Target: 0 Seconds / < 1s Drop Window)
- **What It Means**: The duration of time the web application or API is unreachable to end users while a new software update or version is deployed to production.
- **Real-World Incident Example**:
  > *Scenario*: A developer merges a pull request with a new peer-benchmarking dashboard feature at 2:00 PM on a Tuesday while 100 ministry and cooperative managers are actively submitting financial reports.
  > *Execution*: `docker-rollout` boots container `v2` alongside `v1`, verifies health in the background, and Nginx smoothly shifts active HTTP requests to `v2`.
  > *Result*: **Zero user interruption.** Users experience zero page reloads, zero dropped submissions, and zero error screens during deployment.

#### 2. Self-Healing Recovery Time (RTO - Auto) (Target: < 30 Seconds)
- **What It Means**: Automatic Recovery Time Objective (RTO) measures how long it takes for a frozen, unresponsive, or crashed container process to be detected and restored back to healthy operation without human sysadmin intervention.
- **Real-World Incident Example**:
  > *Scenario*: An unexpected memory leak or unhandled thread lock in the Keycloak IAM service causes the authentication container to stop responding to login requests at 11:15 AM.
  > *Execution*: The `willfarrell/autoheal` companion container detects 3 consecutive failed health checks against `http://localhost:8180/health/ready` (checked every 5s). At 11:15:20 AM, `autoheal` automatically issues a force restart to `coopdata-keycloak`.
  > *Result*: Keycloak restarts and becomes fully operational by 11:15:28 AM (**28 seconds total recovery time**), without any DevOps engineer needing to log in or run manual commands.

#### 3. Disaster Recovery Time (RTO - Full Server Loss) (Target: < 15 Minutes)
- **What It Means**: Disaster Recovery RTO measures the total duration required to rebuild the entire application infrastructure from scratch on a brand-new physical or virtual server following catastrophic host destruction.
- **Real-World Incident Example**:
  > *Scenario*: The underlying AWS EC2 physical hypervisor hosting the production server experiences a catastrophic hardware crash and irrecoverable disk failure at 3:00 AM.
  > *Execution*: The DevOps engineer launches a fresh Ubuntu EC2 instance, SSHs in, clones the repository, runs `sudo ./setup-ec2.sh` (5 minutes), and executes `./scripts/restore-production.sh 2026-08-25` (8 minutes).
  > *Result*: All 14 Docker containers, PostgreSQL databases (`coopdata` + `keycloak`), Keycloak realm configs, and MinIO uploaded file storage are completely restored from offsite S3 and verified healthy within **13 minutes total duration**.

#### 4. Data Loss Window (RPO - Recovery Point Objective) (Target: < 24 Hours)
- **What It Means**: RPO measures the maximum acceptable age of data that can be permanently lost in the event of a catastrophic disaster before the most recent backup point.
- **Real-World Incident Example**:
  > *Scenario*: A physical server disaster strikes at 1:00 PM on Wednesday. The disaster recovery script restores the offsite S3 backup generated by the automated nightly cron job at 02:00 AM on Wednesday morning.
  > *Result*: All database entries, non-financial ledger submissions, and uploaded PDF files created up to 02:00 AM Wednesday are 100% intact. Only transactions created between 02:00 AM Wednesday and 1:00 PM Wednesday (11 hours of data) need to be re-submitted.
  > *(Note: Enabling automated hourly AWS EBS volume snapshots reduces this data loss window to < 1 hour).*