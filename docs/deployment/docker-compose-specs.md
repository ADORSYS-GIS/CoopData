# CoopData — Deployment Specifications (Docker Compose)

> **Purpose:** The hardware, storage, and cost required to deploy the CoopData platform
> using **Docker Compose** on a single server, designed to support up to **5,000 users**,
> including the **AI module**.
>
> **Why Docker Compose:** for a known maximum of 5,000 users, a single-server deployment is
> **simpler, cheaper, and easier to operate** than a Kubernetes cluster. The database and
> backups run on the same server and are covered by the nightly backup script.
>
> **Services included:** Web application (Frontend), API (Backend), PostgreSQL (database),
> Redis (cache), MinIO (file storage), Keycloak (login/security), Gotenberg (PDF/reports),
> and the **AI module** (vision-language model).

---

## 1. Sizing Basis

The specifications are based on a **5,000-user** target, with **~750 users active at peak**
(15% of registered — the industry norm). This drives the compute, memory, and storage below.

> **Note:** a single server is a **single point of failure** and has **no automatic scaling**.
> This is acceptable for a known 5,000-user ceiling, and is mitigated with nightly off-site
> backups and a documented recovery procedure.

---

## 2. Deployment Target

CoopData runs on a **single server provided by the client**, using Docker Compose. The server can be a dedicated machine or a virtual machine, in the client's data centre or at a hosting provider. No cloud-specific service is required: the database (PostgreSQL), the file storage (MinIO) and the cache (Redis) all run in containers on the same server.

| Resource | Spec | Why |
| :--- | :--- | :--- |
| **Server** | 16 cores / 64 GB RAM / 1 TB SSD (5,000-user target). 4 vCPU / 8 GB RAM / 40 GB disk is enough for a pilot | Runs all services |
| **File storage** | 500 GB on the server disk (MinIO volume) | Uploaded documents |
| **OS** | Ubuntu 24.04 LTS | Supported operating system |
| **Network** | Fixed public IP, ports 22 (restricted), 80 and 443 open | User traffic and administration |

> **Note:** because the database runs on the same server, backups are the client's safety net. The nightly script [`backup-production.sh`](../../scripts/backup-production.sh) copies the databases and files to an off-site S3-compatible bucket, and the client should also keep server-level snapshots if the host offers them. See [`../BACKUP_AND_RECOVERY_GUIDE.md`](../BACKUP_AND_RECOVERY_GUIDE.md).

---

## 3. Resource Requirements per Service

The table below shows the resources each service needs at the **5,000-user maximum**.

| Service | Replicas | CPU | Memory | Storage |
| :--- | :-: | :-: | :-: | :-: |
| **Backend** (API) | 1 | 2 cores | 2 GB | — |
| **Frontend** (Web) | 1 | 0.5 core | 512 MB | — |
| **Keycloak** (Login/security) | 1 | 2 cores | 4 GB | — |
| **PostgreSQL** (Database) | 1 | 2 cores | 4 GB | **100 GB** |
| **Redis** (Cache) | 1 | 0.5 core | 512 MB | 10 GB |
| **MinIO** (File storage) | 1 | 1 core | 1 GB | **500 GB** |
| **Gotenberg** (PDF/reports) | 1 | 1 core | 1 GB | — |

**Key justifications:**
- **Keycloak** (login/security) is the largest memory consumer (4 GB).
- **PostgreSQL** (database) is the main data store — **100 GB** for 5,000 users.
- **MinIO** (file storage) holds uploaded files — **500 GB** for 5,000 users.
- **Backend** (API) is efficient — 150 req/s is light for a single instance.

---

## 4. Storage & Backup

| Item | Size | Notes |
| :--- | :--- | :--- |
| Database (PostgreSQL) | 100 GB | Main data store |
| File storage (MinIO) | 500 GB | Uploads and attachments |
| Cache (Redis) | 10 GB | Temporary, no backup needed |
| **Backups** | Daily | Retained 30 days, with an off-site copy |

> Backups are produced by `backup-production.sh` (nightly, copied off-site) and checked by the restore drill in the backup guide.

---

## 5. AI Module — Hardware Specification

The AI module runs on a **separate dedicated GPU server**. It provides vision-language
processing of documents, receipts, and images.

### 5.1 Model Selection

**Recommended model:** Qwen2.5-VL-7B-Instruct

| Reason | Explanation |
| :--- | :--- |
| **Quality-to-speed ratio** | 7-billion parameters delivers strong intelligence with low latency (<2s initial response) |
| **Native vision** | Accepts images and documents for OCR, parsing, and visual reasoning |
| **High concurrency** | Runs efficiently on a single GPU, maximizing throughput per dollar |
| **Modern architecture** | Outperforms previous 13B/30B models on structured-data extraction |

### 5.2 Memory (VRAM) Requirements

| Resource | Required VRAM | Justification |
| :--- | :-: | :--- |
| Model weights (BF16/INT8) | ~8–14 GB | To load the model into GPU memory |
| Vision encoder overhead | ~2–3 GB | Processes visual tokens from images |
| KV cache pool (concurrency) | ~4–6 GB | Holds active sessions for parallel users |
| Overhead & thermal headroom | Safety margin | Prevents out-of-memory and throttling |

> **Note on vLLM:** the inference engine pre-allocates up to 90% of GPU VRAM for the KV cache,
> allowing many parallel prompts without memory fragmentation.

### 5.3 Recommended Server

To avoid high hourly and egress fees from hyperscale clouds, a **dedicated
bare-metal GPU server** is recommended.

| Spec | Example: dedicated GPU server (GEX44 class) |
| :--- | :--- |
| **GPU** | NVIDIA RTX 4000 SFF Ada (20 GB VRAM) |
| **CPU / RAM** | 10 cores (Intel i5-13500) / 64 GB DDR5 |
| **Storage** | 2 × 512 GB NVMe SSD |
| **Network** | 1 Gbit/s (unlimited transfer) |
| **Pricing** | Fixed ~€184–234 / month (no hidden egress fees) |

**Why a dedicated server:**
1. **Lower cost** — a flat monthly price with no per-GB transfer charges.
2. **Dedicated performance** — 100% of the GPU/CPU/RAM dedicated to your workload.
3. **Predictable budgeting** — fixed monthly billing, no surprise charges.

### 5.4 Client Action Items

| # | Item | Status |
| :- | :--- | :--- |
| 1 | **GPU server** — provision a server with a GPU comparable to the one above | Required |
| 2 | **API key & networking** — domain/IP whitelist for the API endpoint | Required |
| 3 | **Sample dataset** — 5–10 test prompts and images to benchmark | Optional |

---

## 6. Cost

The application itself needs no paid cloud service: the client pays for the server it provides. The AI module (section 5) is billed separately at a fixed monthly rate. Exact quotes are available on request.
