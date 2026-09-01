# CoopData — Master Release Strategy & CI/CD Deployment Guide

This document defines the complete software release lifecycle, Conventional Commit standards, automated Semantic Versioning (SemVer), GitHub Actions continuous deployment, zero-downtime rolling deployment architecture, and client SLA guarantees.

---

## 🏗️ 1. End-to-End Release Lifecycle

```mermaid
flowchart TD
    subgraph 1. Local Development
        Dev["Developer writes code using Conventional Commits\n(fix: ..., feat: ..., feat!:)"]
        Push["Push feature branch & Open PR to 'main'"]
        Dev --> Push
    end

    subgraph 2. CI Automated Validation
        PR["PR Triggers CI (.github/workflows/docker.yml)"]
        Scan["• Compiles Frontend & Rust Backend\n• Runs Trivy Security Scanner\n• Blocks PR if critical vulnerabilities found"]
        PR --> Scan
    end

    subgraph 3. Automated Release Management
        MergeMain["Merge PR into 'main'"]
        ReleasePlease["Release-Please Action (.github/workflows/release-please.yml)"]
        BumpVer["Calculates SemVer:\n• fix: -> v1.0.1 (Patch)\n• feat: -> v1.1.0 (Minor)\n• feat!: -> v2.0.0 (Major)"]
        ReleasePR["Creates Release PR with updated CHANGELOG.md"]
        MergeRelease["Merge Release PR -> Creates Git Tag (v1.1.0) & GitHub Release"]
        
        MergeMain --> ReleasePlease
        ReleasePlease --> BumpVer
        BumpVer --> ReleasePR
        ReleasePR --> MergeRelease
    end

    subgraph 4. Image Build & GHCR Registry
        BuildGHCR["Publish Job Triggers"]
        Publish["Publishes tagged Docker images:\n• ghcr.io/.../coopdata-backend:v1.1.0\n• ghcr.io/.../coopdata-backend:v1.1\n• ghcr.io/.../coopdata-backend:v1\n• ghcr.io/.../coopdata-backend:latest"]
        BuildGHCR --> Publish
    end

    subgraph 5. Zero-Downtime Deployment
        CD["Deploy Job connects via SSH to Production EC2"]
        DeployScript["Runs ./scripts/deploy.sh"]
        Rollout["docker rollout backend & frontend:\n1. Boots v2 alongside v1\n2. Verifies GET /api/v1/health -> 200 OK\n3. Switches Nginx traffic to v2\n4. Gracefully terminates v1"]
        
        CD --> DeployScript
        DeployScript --> Rollout
    end

    Push --> PR
    Scan -- "PR Approved" --> MergeMain
    Publish --> CD
    Rollout --> Done["✅ Live Production Site Updated (0s Client Downtime)"]
```

---

## 📝 2. Conventional Commit Message Standards

Developers must prefix commit messages using standard Conventional Commits. Google's `release-please` action uses these prefixes to automatically calculate the next SemVer version:

| Prefix | Release Type | Example Commit Message | Version Bump Example |
|---|---|---|---|
| **`fix:`** | **Patch Release** (Bug fix) | `fix: resolve JWT token expiration handling` | `v1.0.0` $\rightarrow$ `v1.0.1` |
| **`feat:`** | **Minor Release** (New feature) | `feat: add basic benchmarking dashboard widget` | `v1.0.0` $\rightarrow$ `v1.1.0` |
| **`feat!:`** or **`BREAKING CHANGE:`** | **Major Release** (Breaking change) | `feat!: overhaul database schema for non-financial indicators` | `v1.0.0` $\rightarrow$ `v2.0.0` |
| **`chore:`**, **`docs:`**, **`refactor:`** | **No Release** (Internal update) | `docs: update deployment architecture guide` | Version unchanged |

---

## 🏷️ 3. Semantic Versioning & GHCR Tagging

When a release is created (e.g. `v1.2.3`), `docker/metadata-action@v5` in GitHub Actions generates 4 multi-tier tags in GitHub Container Registry:

1. **`ghcr.io/adorsys-gis/coopdata-backend:v1.2.3`** (Exact release version)
2. **`ghcr.io/adorsys-gis/coopdata-backend:v1.2`** (Minor release tracking)
3. **`ghcr.io/adorsys-gis/coopdata-backend:v1`** (Major release tracking)
4. **`ghcr.io/adorsys-gis/coopdata-backend:latest`** (Active production image)

---

## 🚀 4. Zero-Downtime Rolling Deployment (`docker-rollout`)

Traditional `docker compose up -d` kills the running container before starting the new one, resulting in a 5–15 second outage window for active users.

CoopData uses `docker-rollout` (executed via [`scripts/deploy.sh`](../scripts/deploy.sh)) to achieve **zero-downtime updates**:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as GitHub Actions CD
    participant Script as ./scripts/deploy.sh
    participant GHCR as Container Registry
    participant Host as Docker Engine
    participant Proxy as Nginx Host Proxy
    participant User as Active Client Session

    Dev->>Script: SSH trigger ./scripts/deploy.sh
    Script->>GHCR: Pull ghcr.io/...:latest images
    Script->>Host: docker rollout backend
    Host->>Host: Spin up backend:v2 alongside backend:v1
    
    loop Healthcheck Gate
        Host->>Host: GET http://localhost:3000/api/v1/health
    end
    
    Host-->>Script: backend:v2 is HEALTHY
    Proxy->>Host: Route active user traffic to backend:v2
    Host->>Host: Gracefully stop & remove backend:v1
    Script-->>Dev: Deployment complete (< 1s drop window)
    User->>Proxy: User sessions continue without disconnection!
```

---

## 🎯 5. Deploying a Specific Release Version or Executing a Rollback

There is a clear distinction between standard routine releases and manual version override / rollback deployments:

### Mode 1: Fully Automated Day-to-Day Release (Zero Typing)
- **How it works**: Developers write Conventional Commits (`feat:`, `fix:`) and merge PRs into `main`.
- **User Action**: Zero typing required. Just click **"Merge Release PR"** in GitHub.
- **System Action**: `release-please` creates tag `v1.1.0`, GitHub Actions builds images, and automatically deploys `v1.1.0` to the production server over SSH with 0 seconds downtime.

### Mode 2: Manual Version Override / Rollback via GitHub Actions UI
If you want to forcefully deploy a **specific past release** (e.g. rollback from `v1.2.0` to `v1.0.5`):
1. Go to **GitHub Repository $\rightarrow$ Actions tab $\rightarrow$ Docker Build, Scan & Publish**.
2. Click **Run workflow** dropdown on the right side.
3. Type the target release tag in the input box (e.g. `v1.0.5`).
4. Click **Run workflow**.

> GitHub Actions will build/verify `v1.0.5`, connect via SSH to your server, and execute a zero-downtime rollout directly to `v1.0.5`!

### Mode 3: Manual Version Override via Production Server CLI
On the production server terminal:
```bash
# Deploy specific release version v1.0.5
./scripts/deploy.sh v1.0.5

# Deploy specific version for backend only
./scripts/deploy.sh backend v1.0.5
```

### Mode 4: Persistent Version Pinning via `.env`
Edit `/opt/coopdata/.env` on the server to pin to a fixed release version:
```env
BACKEND_IMAGE_TAG=v1.0.5
FRONTEND_IMAGE_TAG=v1.0.5
```
Then run `./scripts/deploy.sh`.

---

## 🔐 6. Required GitHub Repository Secrets

To enable GitHub Actions SSH zero-downtime deployment, configure these 3 secrets in **GitHub Repository $\rightarrow$ Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**:

| Secret Name | Description | Example |
|---|---|---|
| `PROD_HOST` | Production EC2 Host IP or Domain | `coopdata.dgrvcoop360.com` or `54.x.x.x` |
| `PROD_USER` | Server SSH User | `ubuntu` |
| `PROD_SSH_KEY` | Private OpenSSH Key for Server | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PROD_PATH` *(Optional)* | Repo path on server | `/home/ubuntu/CoopData` |

---

## ⏱️ 6. Service Level Agreements (SLAs) & Incident Scenarios

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
