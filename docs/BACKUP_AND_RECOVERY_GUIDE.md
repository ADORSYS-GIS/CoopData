# CoopData — Master Backup & Disaster Recovery Guide

This document defines the enterprise-grade backup architecture, offsite S3 integration, automated scheduling, disaster recovery restoration procedures, and Recovery Time / Point Objectives (RTO/RPO) for the CoopData platform.

---

## 🎯 1. Backup Architecture Overview

CoopData implements a **3-Layer Comprehensive Offsite Backup System** ([`scripts/backup-production.sh`](file:///home/ariel/Desktop/CoopData/scripts/backup-production.sh)) to guarantee zero data loss across all stateful components:

```mermaid
flowchart TD
    Cron["Cron Job (02:00 AM Daily)\n/etc/cron.d/coopdata-backup"] --> Script["scripts/backup-production.sh"]
    
    subgraph Layer 1: App Database
        L1["CoopData PostgreSQL ('coopdata')"]
        L1_Dump["pg_dump -> coopdata_db_YYYY-MM-DD.dump.gz"]
    end

    subgraph Layer 2: Keycloak IAM
        L2_DB["Keycloak PostgreSQL ('keycloak')"]
        L2_Cfg["Realm & Theme Files ('./keycloak')"]
        L2_Dump["pg_dump -> keycloak_db_YYYY-MM-DD.dump.gz\ntar -> keycloak_config_YYYY-MM-DD.tar.gz"]
    end

    subgraph Layer 3: Object Storage
        L3["MinIO S3 Persistent Files (/data)"]
        L3_Dump["tar -> minio_data_YYYY-MM-DD.tar.gz"]
    end

    Script --> Layer 1: App Database
    Script --> Layer 2: Keycloak IAM
    Script --> Layer 3: Object Storage

    L1_Dump --> Offsite["Offsite S3 Cloud Storage\n(AWS S3 / Hetzner S3 / MinIO)"]
    L2_Dump --> Offsite
    L3_Dump --> Offsite

    Offsite --> Prune["30-Day Automated Retention Pruning\n(Deletes offsite backups > 30 days)"]
```

---

## ⚙️ 2. Offsite Provider Configuration (`.env`)

Backups are encrypted over HTTPS (TLS) and stored in offsite cloud object storage using the `STANDARD_IA` (Infrequent Access) storage class to optimize storage costs.

### AWS S3 (Default Production Choice)
```env
BACKUP_S3_BUCKET=coopdata-production-backups
BACKUP_S3_PREFIX=postgres
BACKUP_S3_ENDPOINT=                # Leave blank for AWS S3
BACKUP_RETENTION_DAYS=30
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-east-1
```

### Hetzner Object Storage / MinIO / DigitalOcean / Wasabi
```env
BACKUP_S3_BUCKET=coopdata-backups
BACKUP_S3_ENDPOINT=https://fsn1.your-objectstorage.com
BACKUP_RETENTION_DAYS=30
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=eu-central-1
```

---

## ⏰ 3. Automated Scheduling & Logging

- **Cron Schedule**: Daily at 02:00 AM UTC (`/etc/cron.d/coopdata-backup`).
- **Cron Definition**:
  ```cron
  0 2 * * * ubuntu /path/to/coopdata/scripts/backup-production.sh >> /var/log/coopdata-backup.log 2>&1
  ```
- **Log Location**: `/var/log/coopdata-backup.log`
- **Follow Live Logs**:
  ```bash
  tail -f /var/log/coopdata-backup.log
  ```

---

## 🚀 4. Manual On-Demand Backup Execution

To trigger a manual backup outside of the automated schedule:
```bash
./scripts/backup-production.sh
```
*(Or run `./scripts/backup-postgres.sh`, which acts as a wrapper forwarding to `backup-production.sh`)*

---

## 🚑 5. Disaster Recovery & Restore Procedure

In the event of a catastrophic server hardware failure or host deletion, use [`scripts/restore-production.sh`](file:///home/ariel/Desktop/CoopData/scripts/restore-production.sh) for single-command recovery.

### Method A: Interactive Date Selection (Recommended)
```bash
./scripts/restore-production.sh
```
1. Queries offsite S3 storage and displays available backup dates.
2. Prompts you to select a backup date.
3. Prompts for `RESTORE` safety confirmation.
4. Downloads artifacts, terminates active DB connections, recreates `coopdata` and `keycloak` databases, restores MinIO uploaded files, and restarts services.

### Method B: Target Date Command
```bash
./scripts/restore-production.sh 2026-08-25
```

### Method C: Unattended / Scripted Restore
```bash
./scripts/restore-production.sh 2026-08-25 --force
```

---

## 📊 6. Service Level Agreements (SLAs) & Incident Scenarios

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
