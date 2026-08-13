# Observability & Monitoring Architecture

> **Ticket**: [#70](https://github.com/ADORSYS-GIS/CoopData/issues/70) — Implement Grafana and Prometheus for Monitoring
> **Status**: Phases 1-3 Complete, Phase 4 Partial (rules loaded, notifications not configured)
> **Scope**: Add full-stack observability (Metrics, Dashboards, Alerts) to the CoopData platform in production (EC2/Docker).

---

## 1. Executive Summary & Problem Statement

CoopData currently operates as a "black box" in production. While structured `tracing` logs exist, they are written to stdout without centralized aggregation, alerting, or visual dashboards.

This architecture introduces an industry-standard monitoring stack to provide real-time visibility into three core layers:
1. **Application Health**: API latency, error rates, cache efficiency.
2. **Infrastructure Health**: EC2 server capacity, PostgreSQL connections, Redis memory.
3. **Business Metrics**: Submission throughput, AI extraction success rates.

By moving from a reactive to a proactive observability model, the team can identify and resolve bottlenecks or failures *before* they impact the cooperatives and ministry users.

### Current State

| What | Status |
|------|--------|
| Structured logs via `tracing` | ✅ exists |
| Request logging middleware | ✅ exists |
| `GET /api/v1/health` endpoint | ✅ exists |
| Redis cache (`CacheService`) | ✅ exists |
| `/metrics` Prometheus endpoint | ✅ implemented |
| Prometheus + Exporters | ✅ implemented |
| Grafana with 4 dashboards | ✅ implemented |
| Alert rules (7 rules) | ✅ loaded |
| Alert notifications (Slack/Email) | ⏳ not configured yet |
| Database query metrics | ✅ implemented |

---

## 2. Component Architecture (Docker Compose)

The entire stack is deployed alongside the existing application inside the isolated Docker network on the EC2 host. No host-level installation is required.

### 2.1 Core Components

| Service | Image | Purpose | Network Access |
|---|---|---|---|
| **Prometheus** | `prom/prometheus:v2.53.0` | Time-series database. Scrapes metrics from the backend and exporters every 15s. Retains data for 30 days via Docker volumes. | Internal Only (`127.0.0.1:9090`) |
| **Grafana** | `grafana/grafana:11.1.0` | Visualization UI and Alerting Engine. Connects to Prometheus to render dashboards. | Exposed via Nginx (`/grafana/`) |

### 2.2 Exporters (The Translators)

Since infrastructure components do not natively expose Prometheus metrics, we deploy lightweight "exporter" containers:

| Exporter | Image | Target | Metrics Extracted |
|---|---|---|---|
| **Postgres Exporter** | `prometheuscommunity/postgres-exporter` | `postgres` container | Active/Idle connections, transaction rollbacks, index hit rates, lock contention. |
| **Redis Exporter** | `oliver006/redis_exporter` | `redis` container | Memory fragmentation, cache hits/misses, connected clients, evicted keys. |
| **Node Exporter** | `prom/node-exporter` | EC2 Host Machine | CPU load, RAM utilization, Disk I/O, Network bandwidth, File descriptor limits. |
| *(None)* | Built-in to MinIO | `minio` container | MinIO natively exposes `/minio/v2/metrics/cluster`, requiring only a scrape config. |

### 2.3 Data Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Metric       │      │  Prometheus   │      │  Grafana     │      │  You         │
│  Sources      │─────►│  Rule Eval    │─────►│  Unified     │─────►│  (Slack/     │
│               │      │              │      │  Alerting    │      │   Email)     │
│  • Backend    │      │  Every 15s   │      │              │      │              │
│  • Postgres   │      │              │      │  Routes to   │      │  ⚠️ NOT SET  │
│  • Redis      │      │  Evaluates   │      │  channels    │      │  UP YET      │
│  • Node       │      │  7 rules     │      │              │      │              │
│  • MinIO      │      │              │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

---

## 3. Application-Level Metrics (Rust Backend)

We instrument the Rust backend using `axum-prometheus`, `metrics`, and `metrics-exporter-prometheus` to expose an internal-only `/metrics` endpoint.

### 3.1 HTTP Traffic (Auto-instrumented)

**Which endpoints do we monitor?**
**ALL of them.** We do not manually select endpoints. Instead, we attach the `axum-prometheus` middleware globally to the root Axum router. Any request that comes into the API—whether it's `/api/v1/auth/login`, `/api/v1/analytics/basic-benchmark`, or a missing route returning `404`—is automatically tracked.

**How it works:**
The middleware intercepts every incoming request and records:
- `http_requests_total` (Counter)
  - Labels: `method` (GET, POST), `uri` (the exact endpoint path), `status` (200, 400, 500)
- `http_request_duration_seconds` (Histogram)
  - Captures exact latencies (p50, p90, and p99). Labels: `method`, `uri`, `status`.
- `http_requests_in_flight` (Gauge)
  - Current number of requests being processed.

**How to read these metrics in Grafana:**

```
Panel: "Request Rate (req/s)"
  Y-axis: requests per second
  X-axis: time (last 6 hours)
  Lines: GET (blue), POST (green), PUT (yellow), DELETE (red)
  
  What it tells you: "At 2:00 PM, we were handling 15 requests/second"
  What's normal: varies by usage, but sudden spikes = traffic surge
  What's bad: sudden drop to 0 = backend might be down

Panel: "Error Rate (%)"
  Y-axis: percentage (0-100%)
  Lines: 4xx (yellow), 5xx (red)
  
  What it tells you: "0.5% of requests returned errors"
  What's normal: <1% for 5xx, <5% for 4xx
  What's bad: 5xx >1% for 5 minutes = something is broken

Panel: "Request Latency"
  Y-axis: seconds
  Lines: p50 (median), p90, p99
  
  What it tells you: "50% of requests complete in 0.1s, 99% in 0.8s"
  What's normal: p99 < 1 second
  What's bad: p99 > 2 seconds = something is slow
```

**Why this approach?**
1. **Zero Maintenance**: When developers add new endpoints in the future, they are monitored instantly without writing extra code.
2. **Abuse Detection**: By tracking all URIs (including 404s), we can spot brute-force attacks or broken frontend links immediately.

### 3.2 Database Query Metrics (Custom Instrumentation)

We added a `db_query()` helper function in `backend/src/repositories/mod.rs` that wraps any async database call with timing:

```rust
pub async fn db_query<F, T>(entity: &str, operation: &str, f: F) -> AppResult<T>
where
    F: Future<Output = AppResult<T>>,
{
    let start = Instant::now();
    let result = f.await;
    let elapsed = start.elapsed().as_secs_f64();

    histogram!("coopdata_db_query_duration_seconds",
        "entity" => entity.to_string(),
        "operation" => operation.to_string()
    ).record(elapsed);

    result
}
```

**Currently instrumented repositories:**
- `cooperative.rs` — 12 methods (find_by_id, find_by_name, create, update, delete, etc.)
- `submission.rs` — 12 methods (find_by_id, find_by_status, create, delete, etc.)
- `financial_statement.rs` — 10 methods (find_by_id, find_by_submission, create, etc.)

**Metric:** `coopdata_db_query_duration_seconds` (Histogram)
- Labels: `entity` (cooperative, submission, financial_statement), `operation` (find_by_id, create, etc.)

**How to read DB query metrics:**

```
Panel: "DB Query Duration by Entity (avg)"
  Y-axis: seconds
  Lines: cooperative (blue), submission (green), financial_statement (yellow)
  
  What it tells you: "Cooperative queries take 5ms, submissions take 12ms"
  What's normal: <50ms for most queries
  What's bad: >200ms = something is slow (missing index, N+1 query, etc.)

Panel: "DB Query Duration p95 by Entity"
  Y-axis: seconds
  Lines: p95 cooperative, p95 submission, p95 financial_statement
  
  What it tells you: "5% of submission queries take >100ms"
  What's normal: p95 < 100ms
  What's bad: p95 > 500ms = investigate specific queries

Panel: "DB Query Rate by Entity"
  Y-axis: queries/second
  Lines: cooperative, submission, financial_statement
  
  What it tells you: "We're making 20 cooperative queries/second"
  What's normal: varies by traffic
  What's bad: sudden spike = potential N+1 query bug
```

### 3.3 Cache Metrics (Custom Instrumentation)

Tracked inside `CacheService` (`backend/src/services/cache.rs`):

- `coopdata_cache_hits_total` (Counter) — Labels: `entity`
- `coopdata_cache_misses_total` (Counter) — Labels: `entity`
- `coopdata_cache_sets_total` (Counter) — Labels: `entity`

**How to read cache metrics:**

```
Panel: "Cache Hit Rate (%)"
  Formula: hits / (hits + misses) * 100
  
  What it tells you: "85% of data lookups are served from Redis cache"
  What's normal: >80% hit rate
  What's bad: <50% = Redis is not effective, maybe too small or data is too unique
  
  If hit rate drops suddenly:
    → Redis might have been restarted (cache is empty)
    → New entity types are being queried that aren't cached
    → Cache TTL might be too short
```

### 3.4 Keycloak Metrics (Custom Instrumentation)

Tracked inside `KeycloakService` (`backend/src/services/keycloak.rs`):

- `coopdata_keycloak_requests_total` (Counter) — Labels: `operation` (create_user, get_admin_token, etc.)
- `coopdata_keycloak_errors_total` (Counter) — Labels: `operation`

**How to read Keycloak metrics:**

```
Panel: "Keycloak API Requests by Operation"
  Shows: rate of calls grouped by operation type
  
  What it tells you: "We're making 5 create_user calls per minute"
  What's normal: varies by user activity
  What's bad: spikes in errors = Keycloak server issues

Panel: "Keycloak Error Rate"
  Formula: errors / total requests
  
  What it tells you: "2% of Keycloak calls are failing"
  What's normal: <1%
  What's bad: >5% = Keycloak might be down or misconfigured
```

### 3.5 AI Extraction Metrics (Custom Instrumentation)

Tracked inside `ExtractionPipeline` (`backend/src/services/extraction_pipeline.rs`):

- `coopdata_ai_extraction_duration_seconds` (Histogram) — Labels: `status` (success, failure)

**How to read AI extraction metrics:**

```
Panel: "AI Extraction Duration"
  Shows: average time for document processing
  
  What it tells you: "Average extraction takes 3.2 seconds"
  What's normal: <5 seconds for most documents
  What's bad: >10 seconds = AI model is slow or documents are complex

Panel: "AI Extraction Success/Failure"
  Shows: rate of successful vs failed extractions
  
  What it tells you: "95% of extractions succeed"
  What's normal: >90% success rate
  What's bad: <80% = AI pipeline has issues
```

### 3.6 Submission Metrics (Custom Instrumentation)

Tracked inside `SubmissionWorkflow` (`backend/src/services/submission_workflow.rs`):

- `coopdata_submissions_processed_total` (Counter) — Labels: `status` (submitted)
- `coopdata_submission_transitions_total` (Counter) — Labels: `status` (target status)

---

## 4. Complete Metrics Reference

### All Metrics Currently Collected

| Metric | Type | Labels | Source | Dashboard |
|--------|------|--------|--------|-----------|
| `http_requests_total` | Counter | `method`, `uri`, `status` | axum-prometheus (auto) | Backend Overview |
| `http_request_duration_seconds` | Histogram | `method`, `uri`, `status` | axum-prometheus (auto) | Backend Overview |
| `http_requests_in_flight` | Gauge | `method` | axum-prometheus (auto) | Backend Overview |
| `coopdata_db_query_duration_seconds` | Histogram | `entity`, `operation` | repositories/mod.rs | Backend Overview |
| `coopdata_cache_hits_total` | Counter | `entity` | cache.rs | Backend Overview |
| `coopdata_cache_misses_total` | Counter | `entity` | cache.rs | Backend Overview |
| `coopdata_cache_sets_total` | Counter | `entity` | cache.rs | Backend Overview |
| `coopdata_keycloak_requests_total` | Counter | `operation` | keycloak.rs | Backend Overview |
| `coopdata_keycloak_errors_total` | Counter | `operation` | keycloak.rs | Backend Overview |
| `coopdata_ai_extraction_duration_seconds` | Histogram | `status` | extraction_pipeline.rs | Backend Overview |
| `coopdata_submissions_processed_total` | Counter | `status` | submission_workflow.rs | Business Metrics |
| `coopdata_submission_transitions_total` | Counter | `status` | submission_workflow.rs | Business Metrics |
| `up` | Gauge | `job` | Prometheus self-check | Infrastructure |
| `node_*` | Various | — | node-exporter | Infrastructure |
| `pg_*` | Various | — | postgres-exporter | Infrastructure |
| `redis_*` | Various | — | redis-exporter | Infrastructure |

### What We Do NOT Monitor (Known Gaps)

| Gap | Why | Priority |
|-----|-----|----------|
| **Frontend errors** | No JS error tracking (Sentry, etc.) | Medium |
| **Frontend performance** | No Core Web Vitals, page load times | Medium |
| **User login/logout events** | Keycloak doesn't expose these as metrics | Low |
| **Log aggregation** | Logs go to stdout only, no centralized logging | Medium |

---

## 5. Grafana Dashboards (Provisioned as Code)

All dashboards are defined as JSON and auto-provisioned via volume mounts in `monitoring/grafana/dashboards/`.

### 5.1 Backend Overview Dashboard (15 panels)

**Target Audience**: Backend Engineers
**What it answers**: "Is the API healthy and performing well?"

```
Row 1: [Request Rate] [Error Rate] [In-Flight Requests]
Row 2: [Latency p50/p90/p99] [Backend Uptime]
Row 3: [Cache Hit Rate] [Cache Operations (hits/misses/sets)]
Row 4: [Keycloak API Requests] [Keycloak Error Rate]
Row 5: [AI Extraction Duration] [DB Query Duration by Entity]
Row 6: [DB Query Duration p95] [DB Query Rate by Entity]
Row 7: [DB Query Duration by Operation] [Top Endpoints by Traffic]
```

**How to interpret:**
- If **Error Rate** spikes → check backend logs for exceptions
- If **Latency p99** spikes → check if database queries are slow
- If **Cache Hit Rate** drops → Redis might be full or restarted
- If **Keycloak Errors** spike → auth server might be down
- If **DB Query Duration** spikes → check for missing indexes or N+1 queries

### 5.2 Infrastructure Dashboard (9 panels)

**Target Audience**: DevOps / SysAdmins
**What it answers**: "Is the server and database healthy?"

```
Row 1: [CPU Usage] [Memory Usage] [Disk Usage]
Row 2: [PG Active Connections] [PG Cache Hit Ratio]
Row 3: [Redis Memory Usage] [Redis Connected Clients]
Row 4: [Service Uptime (all targets)]
```

**How to interpret:**
- If **CPU >85%** → server might need scaling
- If **Disk <20% free** → need to clean up or add storage
- If **PG Active Connections** spikes → connection pool might be exhausted
- If **Redis Memory** hits max → cache eviction will happen

### 5.3 Business Metrics Dashboard (12 panels)

**Target Audience**: Product Owners / Ministry Admins
**What it answers**: "Are cooperatives using the system and is data flowing?"

```
Row 1: [Total Requests] [Successful Requests] [Failed Requests]
Row 2: [API Availability %] [Submissions Processed]
Row 3: [Submission Transitions by Status] [AI Extraction Duration]
Row 4: [AI Extraction Success/Failure] [Keycloak Requests by Operation]
Row 5: [Cache Performance] [Top Endpoints by Latency]
```

**How to interpret:**
- If **Submissions Processed** is 0 → nobody is using the system
- If **AI Extraction Failures** spike → document processing pipeline is broken
- If **Submission Transitions** shows only "pending" → approvals are stuck

---

## 6. Alerting Strategy

### 6.1 How Alerts Flow

1. **Metric stops flowing** — Prometheus scrapes every 15s. If no response for 2 consecutive scrapes, target is `DOWN`.
2. **Prometheus evaluates rules** — Every 15s, checks all 7 rules in `monitoring/alerts.yml`.
3. **Alert fires** — Rule has `for: 1m` (or 5m/10m), preventing flapping from brief blips.
4. **Grafana sees the alert** — Unified Alerting queries Prometheus rules.
5. **Notification sent** — ⚠️ Not configured yet (needs Slack webhook or SMTP).

### 6.2 Alert Rules

| Alert Name | Condition (PromQL) | For | Severity | What It Monitors |
|---|---|---|---|---|
| **BackendDown** | `up{job="backend"} == 0` | 1m | 🔴 Critical | Backend unreachable |
| **PostgresDown** | `up{job="postgres"} == 0` | 1m | 🔴 Critical | PG exporter unreachable |
| **HighErrorRate** | 5xx/total > 1% | 5m | 🔴 Critical | API error rate |
| **HighLatency** | p99 > 2.0s | 5m | 🟡 Warning | API response time |
| **DiskSpaceLow** | free < 20% | 5m | 🟡 Warning | EC2 disk space |
| **HighMemoryUsage** | RAM > 85% | 5m | 🟡 Warning | EC2 memory |
| **AIPipelineFailing** | failure rate > 10% | 10m | 🟡 Warning | AI extraction pipeline |

### 6.3 Where Each Alert's Metrics Come From

```
BackendDown
  └─ Metric: up{job="backend"}
  └─ Source: Prometheus self-check (did /metrics respond?)

HighErrorRate
  └─ Metric: http_requests_total{status=~"5.."} / http_requests_total
  └─ Source: axum-prometheus middleware (auto-instrumented)

HighLatency
  └─ Metric: histogram_quantile(0.99, http_request_duration_seconds_bucket)
  └─ Source: axum-prometheus middleware (auto-instrumented)

DiskSpaceLow
  └─ Metric: node_filesystem_avail_bytes / node_filesystem_size_bytes
  └─ Source: node-exporter (host metrics)

HighMemoryUsage
  └─ Metric: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes
  └─ Source: node-exporter (host metrics)

AIPipelineFailing
  └─ Metric: coopdata_ai_extraction_duration_seconds_count{status="failure"}
  └─ Source: Custom metric in extraction_pipeline.rs

PostgresDown
  └─ Metric: up{job="postgres"}
  └─ Source: Prometheus self-check (did postgres-exporter respond?)
```

### 6.4 Adding Notifications (Future)

When ready to add Slack/Email notifications:
1. Create a Slack Incoming Webhook → get a URL
2. In Grafana → Alerting → Contact Points → New → Slack → paste the webhook URL
3. In Grafana → Alerting → Notification Policies → set Default Contact Point to your Slack channel

---

## 7. Implementation Status

### Phase 1: Foundation ✅ Complete
- [x] Add `axum-prometheus`, `metrics`, `metrics-exporter-prometheus` to `backend/Cargo.toml`
- [x] Wire `PrometheusMetricLayer` into `api.rs` router
- [x] Add `/metrics` route (no auth, internal only)
- [x] Create `monitoring/prometheus.yml` scrape config
- [x] Create `monitoring/grafana/provisioning/datasources/prometheus.yml`
- [x] Add 5 services to `docker-compose.yml`
- [x] Add 5 services to `docker-compose.ghcr.yaml`
- [x] Add `location /grafana/` to `nginx-host.conf`

### Phase 2: Custom Business Metrics ✅ Complete
- [x] Instrument `cache.rs` with hit/miss/set counters
- [x] Instrument `keycloak.rs` with request/error counters
- [x] Instrument `extraction_pipeline.rs` with duration histogram
- [x] Instrument `submission_workflow.rs` with submission counter

### Phase 3: Grafana Dashboards ✅ Complete
- [x] Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- [x] Create `coopdata-backend.json` dashboard (15 panels)
- [x] Create `infrastructure.json` dashboard (9 panels)
- [x] Create `business-metrics.json` dashboard (12 panels)

### Phase 4: Alerting Rules ⚠️ Partial
- [x] Create `monitoring/alerts.yml` with 7 rules
- [x] Wire Prometheus to load rules file
- [ ] Configure Grafana alert routing (Slack/Email)

### Phase 5: Database Query Metrics ✅ Complete
- [x] Add `db_query()` helper to `repositories/mod.rs`
- [x] Instrument `cooperative.rs` (12 methods)
- [x] Instrument `submission.rs` (12 methods)
- [x] Instrument `financial_statement.rs` (10 methods)
- [x] Add DB query panels to Grafana dashboards

---

## 8. File Structure

```
CoopData/
├── monitoring/
│   ├── prometheus.yml              # Prometheus scrape configuration
│   ├── alerts.yml                  # Alerting rules
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/
│       │   │   └── prometheus.yml  # Auto-connect to Prometheus
│       │   └── dashboards/
│       │       └── dashboards.yml  # Dashboard provider config
│       └── dashboards/
│           ├── coopdata-backend.json
│           ├── infrastructure.json
│           └── business-metrics.json
├── docker-compose.yml              # Updated with monitoring services
├── docker-compose.ghcr.yaml        # Updated with monitoring services
├── nginx-host.conf                 # Updated with /grafana/ location
├── .env.example                    # Updated with GRAFANA_ADMIN_PASSWORD
└── backend/
    ├── Cargo.toml                  # Updated with metrics dependencies
    └── src/
        ├── api/routes/api.rs       # Updated with /metrics endpoint
        └── repositories/mod.rs     # Updated with db_query() helper
```

---

## 9. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAFANA_ADMIN_PASSWORD` | `admin` (dev only) | Grafana admin password |
| `PROMETHEUS_RETENTION_DAYS` | `30` | Prometheus data retention |

---

## 10. Security Considerations

1. **Prometheus is internal-only** — bound to `127.0.0.1:9090`, not exposed through nginx
2. **Grafana admin password** — via env var, never hardcoded in docker-compose
3. **Node Exporter** — mounts host `/proc` and `/sys` as read-only
4. **No sensitive data in metrics** — metric labels use entity names, not IDs or PII
5. **Network isolation** — all monitoring services communicate within Docker network only

---

## 11. Architectural Changes & Notes

### 11.1 S3 Library Migration: `rust-s3` → `aws-sdk-s3`

> **Date**: 2026-08-13  
> **Impact**: Backend S3/MinIO integration  
> **Files Changed**: `backend/Cargo.toml`, `backend/src/services/object_storage.rs`, `backend/Dockerfile`, `backend/Dockerfile.dev`

#### What Changed

We replaced the community `rust-s3` crate (v0.37.2) with the official `aws-sdk-s3` crate (v1.141.0) for all S3/MinIO object storage operations.

#### Why It Changed

The `rust-s3` crate has a **known bug** ([issue #308](https://github.com/durch/rust-s3/issues/308)) where the `Authorization` header and `X-Amz-Date` header can contain **mismatching dates**. This violates the AWS SigV4 signing specification.

**Before the migration:**
- MinIO versions prior to 2025 were **lenient** about this mismatch — they accepted the request even with the incorrect date format
- Everything worked fine because MinIO was forgiving
- The bug was always there, just silently tolerated

**What broke it:**
- MinIO `RELEASE.2025-09-07` **tightened** its SigV4 credential parsing to strictly follow the AWS specification
- It now requires the date in the credential scope to be exactly `yyyyMMdd` format and match the `X-Amz-Date` header
- `rust-s3` was sending a format that MinIO now rejects → `AuthorizationQueryParametersError`

**Why pinning MinIO to older versions didn't work:**
- The bug is in `rust-s3`, not MinIO — MinIO is correct to enforce the spec
- Even older MinIO versions that tolerated it could break again at any time
- Pinning MinIO is a temporary workaround, not a fix

#### Why `aws-sdk-s3` Is the Correct Solution

| | `rust-s3` (removed) | `aws-sdk-s3` (current) |
|---|---|---|
| **Author** | Community (`durch`) | Amazon Web Services |
| **SigV4 Signing** | Buggy — date format mismatch | Correct — follows AWS spec exactly |
| **MinIO Compatibility** | Broken with modern MinIO | Works with all MinIO versions |
| **Maintenance** | Slow updates | Actively maintained by AWS |
| **Path Style** | Manual `.with_path_style()` | `.force_path_style(true)` in config builder |
| **Error Messages** | Generic | Detailed AWS error types |

#### Key Code Change

```rust
// BEFORE (rust-s3) — broken signing
delete
let region = s3::Region::Custom { region, endpoint };
let credentials = s3::creds::Credentials::new(...)?;
let bucket = s3::Bucket::new(&name, region, credentials)?.with_path_style();
bucket.put_object_with_content_type(key, bytes, ct).await?;

// AFTER (aws-sdk-s3) — correct signing
let s3_config = aws_sdk_s3::config::Builder::new()
    .region(aws_sdk_s3::config::Region::new(region))
    .endpoint_url(endpoint)
    .credentials_provider(aws_sdk_s3::config::Credentials::new(...))
    .force_path_style(true)
    .behavior_version_latest()
    .build();
let client = Client::from_conf(s3_config);
client.put_object().bucket(&bucket).key(key)
    .body(ByteStream::from(data.to_vec()))
    .content_type(ct)
    .send().await?;
```

#### Rust Version Requirement

`aws-sdk-s3` v1.141.0 requires `rustc >= 1.94.1`. The Dockerfiles were updated from `rust:1.88-bookworm` to `rust:1.94-bookworm`.

#### Lesson Learned

> **Never use `image: latest` for infrastructure services in production.**
> 
> The `docker-compose.yml` had `minio/minio:latest` which auto-upgraded MinIO to a version that exposed the `rust-s3` bug. Always pin exact versions:
> ```yaml
> # BAD — auto-upgrades, can break compatibility
> image: minio/minio:latest
> 
> # GOOD — predictable, tested version
> image: minio/minio:RELEASE.2025-09-07T16-13-09Z
> ```

---

### 11.2 Docker Compose Port Conflict Fix

> **Date**: 2026-08-13  
> **Impact**: Backend container startup  
> **Files Changed**: `docker-compose.override.yml`

#### What Changed

Fixed `docker-compose.override.yml` to use `127.0.0.1:3000:3000` instead of `3000:3000` for the backend port mapping.

#### Why It Changed

Docker Compose **appends** port mappings from override files instead of replacing them. This caused two simultaneous bindings:

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:3000:3000"   # ← binding 1

# docker-compose.override.yml (was)
ports:
  - "3000:3000"              # ← binding 2 (appended!)
```

Docker tried to bind port 3000 twice → `address already in use` error.

#### Lesson Learned

> When using `docker-compose.override.yml`, ensure port mappings **match exactly** to avoid duplicate bindings. Docker Compose merges lists by appending, not replacing.
