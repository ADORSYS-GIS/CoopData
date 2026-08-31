# CoopData — Deployment Specifications (Docker Compose)

> **Purpose:** The hardware, storage, and cost required to deploy the CoopData platform
> using **Docker Compose** on a single server, designed to support up to **5,000 users**,
> including the **AI module**.
>
> **Why Docker Compose:** for a known maximum of 5,000 users, a single-server deployment is
> **simpler, cheaper, and easier to operate** than a Kubernetes cluster. The database and
> backups are handled by managed services to reduce operational workload.
>
> **Services included:** Web application (Frontend), API (Backend), PostgreSQL (database),
> Redis (cache), MinIO/S3 (file storage), Keycloak (login/security), Gotenberg (PDF/reports),
> and the **AI module** (vision-language model).

---

## 1. Sizing Basis

The specifications are based on a **5,000-user** target, with **~750 users active at peak**
(15% of registered — the industry norm). This drives the compute, memory, and storage below.

> **Note:** a single server is a **single point of failure** and has **no automatic scaling**.
> This is acceptable for a known 5,000-user ceiling, and is mitigated with managed database
> backups and a documented recovery procedure.

---

## 2. Deployment Options

Two options are available, depending on the client's preference.

### Option A — AWS (EC2 + managed services)

The platform runs on a single **EC2** server using Docker Compose. The **database (RDS)**,
**file storage (S3)**, and **backups (AWS Backup)** are managed services, so you do not have
to operate them yourself.

| Resource | Spec | Why |
| :--- | :--- | :--- |
| **EC2 instance** | `m6i.2xlarge` (8 vCPU / 32 GB) | Runs the app, login, cache, and PDF services |
| **RDS** (database) | `db.m6i.large` (2 vCPU / 8 GB) | Managed PostgreSQL — automatic backups & failover |
| **S3** (file storage) | 500 GB | Managed storage for uploads/files |
| **AWS Backup** | Daily, 30-day retention | Managed automatic backups |
| **OS** | Ubuntu 24.04 LTS | Supported operating system |

> **Why managed services:** RDS handles database backups, patching, and failover
> automatically; S3 provides durable file storage; AWS Backup automates snapshots. This
> **reduces operational workload** significantly.

#### Monthly cost (AWS)

| Item | Est. monthly |
| :--- | :-: |
| **EC2** (`m6i.2xlarge`) | ~$280 |
| **RDS** (`db.m6i.large`) | ~$180 |
| **S3** (storage + transfer) | ~$20 |
| **AWS Backup** | ~$25 |
| **Data transfer** | ~$20 |
| **Total** | **~$525** |

### Option B — Hetzner (dedicated server)

The platform runs on a **dedicated bare-metal server** using Docker Compose. Hetzner is
significantly cheaper, but you **run the database yourself** (no managed RDS equivalent).

| Resource | Spec | Why |
| :--- | :--- | :--- |
| **Dedicated server** | 16 cores / 64 GB RAM / 1 TB SSD | Runs all services at full capacity |
| **Object Storage** | 500 GB | S3-compatible storage for uploads/files |
| **OS** | Ubuntu 24.04 LTS | Supported operating system |
| **Network** | 1 Gbps | Handles user traffic |

> **Note:** Hetzner has **no managed database** — you run PostgreSQL yourself on the server
> and manage backups manually. This is the main tradeoff for the lower cost.

#### Monthly cost (Hetzner)

| Item | Est. monthly |
| :--- | :-: |
| **Dedicated server** (16 cores / 64 GB / 1 TB) | ~$110–165 |
| **Object Storage** | ~$10 |
| **Total** | **~$120–175** |

---

## 3. Resource Requirements per Service

The table below shows the resources each service needs at the **5,000-user maximum**.

| Service | Replicas | CPU | Memory | Storage |
| :--- | :-: | :-: | :-: | :-: |
| **Backend** (API) | 1 | 2 cores | 2 GB | — |
| **Frontend** (Web) | 1 | 0.5 core | 512 MB | — |
| **Keycloak** (Login/security) | 1 | 2 cores | 4 GB | — |
| **PostgreSQL** (Database) | 1 | — (RDS) | — (RDS) | **100 GB** |
| **Redis** (Cache) | 1 | 0.5 core | 512 MB | 10 GB |
| **MinIO/S3** (File storage) | 1 | — (S3) | — (S3) | **500 GB** |
| **Gotenberg** (PDF/reports) | 1 | 1 core | 1 GB | — |

**Key justifications:**
- **Keycloak** (login/security) is the largest memory consumer (4 GB).
- **PostgreSQL** (database) is the main data store — **100 GB** for 5,000 users.
- **MinIO/S3** (file storage) holds uploaded files — **500 GB** for 5,000 users.
- **Backend** (API) is efficient — 150 req/s is light for a single instance.

---

## 4. Storage & Backup

| Item | Size | Notes |
| :--- | :--- | :--- |
| Database (PostgreSQL) | 100 GB | Main data store |
| File storage (MinIO/S3) | 500 GB | Uploads and attachments |
| Cache (Redis) | 10 GB | Temporary, no backup needed |
| **Backups** | Daily | Retained 30 days, with an off-site copy |

> **On AWS:** backups are automatic via RDS + AWS Backup.
> **On Hetzner:** backups are manual (snapshots + your own scripts).

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

### 5.3 Recommended Server (Hetzner)

To avoid high hourly and egress fees from hyperscalers (AWS/GCP/Azure), a **dedicated
bare-metal GPU server** is recommended.

| Spec | Proposed: Hetzner GEX44 |
| :--- | :--- |
| **GPU** | NVIDIA RTX 4000 SFF Ada (20 GB VRAM) |
| **CPU / RAM** | 10 cores (Intel i5-13500) / 64 GB DDR5 |
| **Storage** | 2 × 512 GB NVMe SSD |
| **Network** | 1 Gbit/s (unlimited transfer) |
| **Pricing** | Fixed ~€184–234 / month (no hidden egress fees) |

**Why Hetzner:**
1. **~70% cost savings** — an equivalent AWS instance (`g6.xlarge`, 24 GB VRAM) costs
   ~$580–730/month; Hetzner is a flat ~$200–250/month with no per-GB transfer charges.
2. **Dedicated performance** — 100% of the GPU/CPU/RAM dedicated to your workload.
3. **Predictable budgeting** — fixed monthly billing, no surprise charges.

### 5.4 Client Action Items

| # | Item | Status |
| :- | :--- | :--- |
| 1 | **Hetzner account access** — create account and provision a GEX44 server | Required |
| 2 | **API key & networking** — domain/IP whitelist for the API endpoint | Required |
| 3 | **Sample dataset** — 5–10 test prompts and images to benchmark | Optional |

---

## 6. Cost Summary

| Option | Est. monthly |
| :--- | :-: |
| **AWS** — app (EC2 + RDS + S3 + Backup) | ~$525 |
| **Hetzner** — app (dedicated server) | ~$120–175 |
| **AI module** (Hetzner GPU server) | ~$200–250 |

> Costs are indicative and vary by region; exact quotes are available on request. The AI
> module is billed separately at a fixed monthly rate.
