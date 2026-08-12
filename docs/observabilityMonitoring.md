

# Observability & Monitoring Architecture

> **Ticket**: [#70](https://github.com/ADORSYS-GIS/CoopData/issues/70) — Implement Grafana and Prometheus for Monitoring
> **Status**: Design Phase
> **Scope**: Add full-stack observability (Metrics, Dashboards, Alerts) to the CoopData platform in production (EC2/Docker).

---

## 1. Executive Summary & Problem Statement

Currently, CoopData operates as a "black box" in production. While structured `tracing` logs exist, they are written to stdout without centralized aggregation, alerting, or visual dashboards. 

This architecture introduces an industry-standard monitoring stack to provide real-time visibility into three core layers:
1. **Application Health**: API latency, error rates, cache efficiency.
2. **Infrastructure Health**: EC2 server capacity, PostgreSQL connections, Redis memory.
3. **Business Metrics**: Submission throughput, AI extraction success rates.

By moving from a reactive to a proactive observability model, the team can identify and resolve bottlenecks or failures *before* they impact the cooperatives and ministry users.

---

## 2. Component Architecture (Docker Compose)

The entire stack will be deployed alongside the existing application inside the isolated Docker network on the EC2 host. No host-level installation is required.

### 2.1 Core Components

| Service | Image | Purpose | Network Access |
|---|---|---|---|
| **Prometheus** | `prom/prometheus:v2.53.0` | Time-series database. Scrapes metrics from the backend and exporters every 15s. Retains data for 30 days via Docker volumes. | Internal Only (`9090`) |
| **Grafana** | `grafana/grafana:11.1.0` | Visualization UI and Alerting Engine. Connects to Prometheus to render dashboards. | Exposed via Nginx (`/grafana/`) |

### 2.2 Exporters (The Translators)

Since infrastructure components do not natively expose Prometheus metrics, we will deploy lightweight "exporter" containers:

| Exporter | Image | Target | Metrics Extracted |
|---|---|---|---|
| **Postgres Exporter** | `prometheuscommunity/postgres-exporter` | `postgres` container | Active/Idle connections, transaction rollbacks, index hit rates, lock contention. |
| **Redis Exporter** | `oliver006/redis_exporter` | `redis` container | Memory fragmentation, cache hits/misses, connected clients, evicted keys. |
| **Node Exporter** | `prom/node-exporter` | EC2 Host Machine | CPU load, RAM utilization, Disk I/O, Network bandwidth, File descriptor limits. (Requires mounting host `/proc` and `/sys`). |
| *(None)* | Built-in to MinIO | `minio` container | MinIO natively exposes `/minio/v2/metrics/cluster`, requiring only a scrape config. |

---

## 3. Application-Level Metrics (Rust Backend)

We will instrument the Rust backend using `axum-prometheus`, `metrics`, and `metrics-exporter-prometheus` to expose an internal-only `/metrics` endpoint.

### 3.1 HTTP Traffic (Auto-instrumented)

**Which endpoints do we monitor?**
**ALL of them.** We do not manually select endpoints. Instead, we attach the `axum-prometheus` middleware globally to the root Axum router. Any request that comes into the API—whether it's `/api/v1/auth/login`, `/api/v1/analytics/basic-benchmark`, or a missing route returning `404`—is automatically tracked.

**How it works:**
The middleware intercepts every incoming request and records:
- `http_requests_total` (Counter)
  - Labels: `method` (GET, POST), `uri` (the exact endpoint path), `status` (200, 400, 500)
- `http_requests_duration_seconds` (Histogram)
  - Captures exact latencies (p50, p90, and p99). Labels: `method`, `uri`, `status`.

**Why this approach?**
1. **Zero Maintenance**: When developers add new endpoints in the future, they are monitored instantly without writing extra code.
2. **Abuse Detection**: By tracking all URIs (including 404s), we can spot brute-force attacks or broken frontend links immediately.

### 3.2 Database & Cache (Custom Instrumentation)
- `coopdata_db_query_duration_seconds` (Histogram)
  - Labels: `operation` (find, insert, update), `entity` (cooperative, submission, federation).
- `coopdata_cache_hits_total` & `coopdata_cache_misses_total` (Counter)
  - Tracked inside `CacheService`. Labels: `entity`.

### 3.3 External Services & Business Logic
- `coopdata_keycloak_requests_total` & `coopdata_keycloak_errors_total` (Counter)
  - Tracked inside `KeycloakService`. Labels: `operation` (create_user, assign_role).
- `coopdata_ai_extraction_duration_seconds` (Histogram)
  - Labels: `model`, `status` (success, failure).
- `coopdata_submissions_processed_total` (Counter)
  - Labels: `status` (approved, rejected, pending).

---

## 4. Grafana Dashboards (Provisioned as Code)

To avoid manual configuration in production, all dashboards will be defined as JSON and auto-provisioned via volume mounts in `monitoring/grafana/dashboards/`.

### 4.1 Backend Overview Dashboard
- **Target Audience**: Backend Engineers
- **Key Panels**:
  - Global API Request Rate (Req/s)
  - 5xx and 4xx Error Rates (%)
  - API Latency Heatmap & p99/p90 distribution
  - Cache Hit Ratio (%)
  - Keycloak API Availability & Latency

### 4.2 Infrastructure & Database Dashboard
- **Target Audience**: DevOps / SysAdmins
- **Key Panels**:
  - EC2 Host: CPU Usage, Available Memory, Disk Space (%)
  - PostgreSQL: Active vs Idle Connections, Query Throughput, Cache Hit Ratio
  - Redis: Memory Usage vs Max, Connected Clients
  - MinIO: Total Storage Used, Object Count

### 4.3 Business & Pipeline Dashboard
- **Target Audience**: Product Owners / Ministry Admins
- **Key Panels**:
  - Total Submissions Processed (Grouped by status)
  - Active Users / Active Sessions (Derived from Keycloak metrics)
  - AI Document Extraction Success vs Failure Rate

---

## 5. Alerting Strategy

Alerts will be evaluated by Grafana and routed to the engineering team via Slack/Email. The alerting rules will be defined in `monitoring/alerts.yml`.

| Alert Name | Condition (PromQL translation) | Severity | Channel |
|---|---|---|---|
| **BackendDown** | `up{job="backend"} == 0` for > 1m | Critical | Slack + Email |
| **PostgresDown** | `up{job="postgres"} == 0` for > 1m | Critical | Slack + Email |
| **HighErrorRate** | 5xx HTTP responses > 1% of total traffic over 5m | Critical | Slack + Email |
| **HighLatency** | p99 API latency > 2.0s over 5m | Warning | Slack |
| **DiskSpaceLow** | EC2 root volume free space < 20% | Warning | Slack |
| **HighMemoryUsage** | EC2 host RAM utilization > 85% | Warning | Slack |
| **AIPipelineFailing** | AI Extraction error rate > 10% over 10m | Warning | Slack |

---

## 6. Implementation Checklist & Migration Path

1. **Rust Instrumentation**
   - [ ] Add metric dependencies to `Cargo.toml`.
   - [ ] Expose `/metrics` securely in the Axum router.
   - [ ] Wrap critical code paths (DB repos, Keycloak calls, Cache, AI) with metric macros.
2. **Infrastructure Configuration**
   - [ ] Create `monitoring/prometheus.yml` scrape configuration.
   - [ ] Create `monitoring/alerts.yml` rule definitions.
   - [ ] Export Grafana dashboards to `monitoring/grafana/dashboards/`.
3. **Docker Compose Integration**
   - [ ] Add the 5 new services to `docker-compose.yml`.
   - [ ] Setup volume mounts for data persistence (`prometheus_data`, `grafana_data`).
   - [ ] Update `nginx-host.conf` to expose Grafana securely at `/grafana/`.
4. **Deployment**
   - [ ] Merge to `develop`, pull on EC2, and run `docker compose up -d`.
   - [ ] Verify metrics flow and Grafana accessibility via admin credentials.
