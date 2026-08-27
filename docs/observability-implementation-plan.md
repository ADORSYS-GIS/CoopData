# Observability & Monitoring — Implementation Plan

> **Ticket**: [#70](https://github.com/ADORSYS-GIS/CoopData/issues/70) — Implement Grafana and Prometheus for Monitoring
> **Status**: Phases 1-3 Complete, Phase 4 Partial (alert rules loaded, notifications not configured)
> **Branch**: `feat/observability`
> **Date**: 2026-08-12 (created), 2026-08-13 (updated)

---

## 1. Problem Statement

CoopData currently operates as a "black box" in production. While structured `tracing` logs exist, they are written to stdout without centralized aggregation, alerting, or visual dashboards.

This architecture introduces an industry-standard monitoring stack to provide real-time visibility into three core layers:
1. **Application Health**: API latency, error rates, cache efficiency.
2. **Infrastructure Health**: EC2 server capacity, PostgreSQL connections, Redis memory.
3. **Business Metrics**: Submission throughput, AI extraction success rates.

By moving from a reactive to a proactive observability model, the team can identify and resolve bottlenecks or failures *before* they impact the cooperatives and ministry users.

### Current State (Audited)

| What | Status |
|------|--------|
| Structured logs via `tracing` | ✅ exists |
| Request logging middleware (`method`, `uri`, `status`, `duration_ms`) | ✅ exists |
| `GET /api/v1/health` health endpoint | ✅ exists |
| Redis cache (`CacheService`) | ✅ exists |
| `/metrics` Prometheus endpoint | ✅ implemented |
| Prometheus in Docker Compose | ✅ implemented |
| Grafana with 3 dashboards | ✅ implemented |
| Alert rules (7 rules) | ✅ loaded |
| Alert notifications (Slack/Email) | ⏳ not configured yet |
| Log aggregation | ❌ logs go to stdout only |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                          │
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ Backend   │───►│ Prometheus   │───►│ Grafana              │  │
│  │ /metrics  │    │ (scrape 15s) │    │ /grafana/ (via nginx)│  │
│  └──────────┘    └──────────────┘    └──────────────────────┘  │
│       │                  ▲                                       │
│       │          ┌───────┼───────────┬────────────┐            │
│       │          │       │           │            │            │
│       │   ┌──────┴──┐ ┌──┴───────┐ ┌─┴──────────┐│            │
│       │   │ Postgres │ │  Redis   │ │   Node     ││            │
│       │   │ Exporter │ │ Exporter │ │  Exporter  ││            │
│       │   └─────────┘ └──────────┘ └────────────┘│            │
│       │                                           │            │
│  ┌────┴──────────────────────────────────────────┐│            │
│  │  Application Metrics (axum-prometheus)        ││            │
│  │  - http_requests_total                        ││            │
│  │  - http_request_duration_seconds              ││            │
│  │  - coopdata_cache_hits/misses                 ││            │
│  │  - coopdata_keycloak_requests                 ││            │
│  │  - coopdata_ai_extraction_duration            ││            │
│  │  - coopdata_submissions_processed             ││            │
│  └───────────────────────────────────────────────┘│            │
└─────────────────────────────────────────────────────────────────┘
```

### Network Security

- **Prometheus**: Bound to `127.0.0.1:9090` — internal only, not exposed through nginx
- **Grafana**: Bound to `127.0.0.1:3001` — exposed via nginx at `https://<domain>/grafana/`
- **Exporters**: Internal only, scraped by Prometheus within the Docker network
- **Backend `/metrics`**: Not authenticated (internal network only), not routed through nginx

---

## 3. What We Monitor — Complete Metrics Reference

### Layer 1: Infrastructure Metrics (Auto-collected by exporters)

These metrics are collected automatically by lightweight exporter containers. No application code changes needed.

| What We Monitor | How It's Collected | What It Tells You | Normal Range | Alert Threshold |
|----------------|-------------------|-------------------|--------------|-----------------|
| **EC2 Host CPU** | Node Exporter reads `/proc/stat` | Server processing load | <70% | >85% for 5m |
| **EC2 Host RAM** | Node Exporter reads `/proc/meminfo` | Available memory for apps | <70% used | >85% for 5m |
| **EC2 Disk Space** | Node Exporter reads `/proc/diskstats` | Storage remaining on root volume | >30% free | <20% free for 5m |
| **PostgreSQL Connections** | Postgres Exporter queries `pg_stat_activity` | Active database connections | 5-20 active | >80% of max |
| **PostgreSQL Cache Hit** | Postgres Exporter queries `pg_statio_user_tables` | How often queries hit cache vs disk | >99% | <95% |
| **Redis Memory** | Redis Exporter queries `INFO memory` | RAM usage by cache | <70% of max | >85% of max |
| **Redis Cache Hits** | Redis Exporter queries `INFO stats` | Cache effectiveness | >80% hit rate | <50% hit rate |

### Layer 2: Backend HTTP Metrics (Auto-instrumented by axum-prometheus)

Every API request that hits the backend is automatically tracked. The `PrometheusMetricLayer` middleware wraps the entire Axum router — zero code changes needed per endpoint.

| Metric | Type | What It Measures | Labels | How to Read in Grafana |
|--------|------|-----------------|--------|----------------------|
| `http_requests_total` | Counter | Total count of API requests | `method`, `uri`, `status` | **Request Rate panel**: Shows requests/second. Spikes = traffic surge. Drop to 0 = backend down. |
| `http_request_duration_seconds` | Histogram | How long each request took | `method`, `uri`, `status` | **Latency panel**: p50 = median speed, p90 = 90% of requests, p99 = slowest 1%. p99 > 2s = problem. |
| `http_requests_in_flight` | Gauge | Requests being processed right now | `method` | **In-Flight panel**: Shows current concurrent load. Spike = traffic burst or slow endpoint. |

**How to interpret the Request Rate panel:**
```
Panel: "Request Rate (req/s)"
  Y-axis: requests per second
  X-axis: time (last 6 hours)
  Lines: GET (blue), POST (green), PUT (yellow), DELETE (red)
  
  What it tells you: "At 2:00 PM, we were handling 15 requests/second"
  What's normal: varies by usage, but sudden spikes = traffic surge
  What's bad: sudden drop to 0 = backend might be down
```

**How to interpret the Error Rate panel:**
```
Panel: "Error Rate (%)"
  Y-axis: percentage (0-100%)
  Lines: 4xx (yellow), 5xx (red)
  
  What it tells you: "0.5% of requests returned errors"
  What's normal: <1% for 5xx, <5% for 4xx
  What's bad: 5xx >1% for 5 minutes = something is broken
```

**How to interpret the Latency panel:**
```
Panel: "Request Latency"
  Y-axis: seconds
  Lines: p50 (median), p90, p99
  
  What it tells you: "50% of requests complete in 0.1s, 99% in 0.8s"
  What's normal: p99 < 1 second
  What's bad: p99 > 2 seconds = something is slow
```

### Layer 3: Custom Business Metrics (Manually instrumented)

These metrics are added by writing code in specific service files using the `metrics` crate facade (`counter!`, `histogram!`, `gauge!` macros).

| Metric | Type | Where Code Was Added | What It Tracks | Labels |
|--------|------|---------------------|----------------|--------|
| `coopdata_cache_hits_total` | Counter | `cache.rs` → `get()` on hit | How often Redis cache is used successfully | `entity` (e.g., "cooperative", "submission") |
| `coopdata_cache_misses_total` | Counter | `cache.rs` → `get()` on miss | How often we have to go to the database | `entity` |
| `coopdata_cache_sets_total` | Counter | `cache.rs` → `set()` | How often we write to cache | `entity` |
| `coopdata_keycloak_requests_total` | Counter | `keycloak.rs` → all API calls | How many calls to Keycloak auth server | `operation` (e.g., "create_user", "get_admin_token") |
| `coopdata_keycloak_errors_total` | Counter | `keycloak.rs` → `check_response!` on fail | How many Keycloak calls fail | `operation` |
| `coopdata_ai_extraction_duration_seconds` | Histogram | `extraction_pipeline.rs` → start/end timing | How long AI document extraction takes | `status` ("success" or "failure") |
| `coopdata_submissions_processed_total` | Counter | `submission_workflow.rs` → `submit()` | How many submissions are created | `status` ("submitted") |
| `coopdata_submission_transitions_total` | Counter | `submission_workflow.rs` → `transition()` | How many status changes happen | `status` (target status) |

**How to interpret cache metrics:**
```
Panel: "Cache Hit Rate"
  Formula: coopdata_cache_hits_total / (hits + misses)
  
  What it tells you: "85% of data lookups are served from Redis cache"
  What's normal: >80% hit rate
  What's bad: <50% = Redis is not effective, maybe too small or data is too unique
  
  If hit rate drops suddenly:
    → Redis might have been restarted (cache is empty)
    → New entity types are being queried that aren't cached
    → Cache TTL might be too short
```

**How to interpret Keycloak metrics:**
```
Panel: "Keycloak API Requests by Operation"
  Shows: rate of calls grouped by operation type
  
  What it tells you: "We're making 5 create_user calls per minute"
  What's normal: varies by user activity
  What's bad: spikes in errors = Keycloak server issues
  
Panel: "Keycloak Error Rate"
  Shows: coopdata_keycloak_errors_total / coopdata_keycloak_requests_total
  
  What it tells you: "2% of Keycloak calls are failing"
  What's normal: <1%
  What's bad: >5% = Keycloak might be down or misconfigured
```

**How to interpret AI extraction metrics:**
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

---

## 4. Grafana Dashboards — What Each Shows

### Dashboard 1: "CoopData Backend Overview" (for Backend Engineers)

**What it answers:** "Is the API healthy and performing well?"

```
Row 1: [Request Rate] [Error Rate] [In-Flight Requests]
Row 2: [Latency p50/p90/p99] [Backend Uptime]
Row 3: [Cache Hit Rate] [Cache Operations (hits/misses/sets)]
Row 4: [Keycloak API Requests] [Keycloak Error Rate]
Row 5: [AI Extraction Duration] [Top Endpoints by Traffic]
```

**How to interpret:**
- If **Error Rate** spikes → check backend logs for exceptions
- If **Latency p99** spikes → check if database queries are slow
- If **Cache Hit Rate** drops → Redis might be full or restarted
- If **Keycloak Errors** spike → auth server might be down

### Dashboard 2: "CoopData Infrastructure" (for DevOps)

**What it answers:** "Is the server and database healthy?"

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

### Dashboard 3: "CoopData Business Metrics" (for Product/Ministry)

**What it answers:** "Are cooperatives using the system and is data flowing?"

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

## 5. Alerting Rules — How Alerts Flow

### The Complete Alert Pipeline

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

### Step-by-Step: What Happens When Something Goes Wrong

**Example: Backend crashes**

1. **Metric stops flowing** — Prometheus scrapes `http://backend:3000/metrics` every 15 seconds. If it gets no response for 2 consecutive scrapes (30s), the target is marked `DOWN`.

2. **Prometheus evaluates rules** — Every 15s (`evaluation_interval: 15s`), Prometheus runs all 7 rules in `monitoring/alerts.yml`. It checks:
   ```
   up{job="backend"} == 0
   ```
   This is `1` (up) or `0` (down). When the backend stops responding, `up{job="backend"}` becomes `0`.

3. **Alert fires** — The rule has `for: 1m`, meaning the condition must be true for **1 full minute** before the alert transitions from `pending` → `firing`. This prevents flapping from brief network blips.

4. **Prometheus sends to Grafana** — Prometheus exposes its alert state via its API. Grafana's **Unified Alerting** system queries Prometheus rules and sees the alert is `firing`.

5. **Grafana routes the alert** — This is where **notifications are not yet configured**. Grafana knows the alert fired, but has no notification channel configured. Right now it shows as a red dot in the Grafana Alerting UI, but nobody gets notified.

### The 7 Alert Rules

| # | Alert | What It Monitors | When It Fires | Severity |
|---|-------|-----------------|---------------|----------|
| 1 | **BackendDown** | `up{job="backend"}` | Backend unreachable >1m | 🔴 Critical |
| 2 | **PostgresDown** | `up{job="postgres"}` | PG exporter unreachable >1m | 🔴 Critical |
| 3 | **HighErrorRate** | 5xx responses / total requests | >1% errors for 5m | 🔴 Critical |
| 4 | **HighLatency** | p99 response time | >2.0 seconds for 5m | 🟡 Warning |
| 5 | **DiskSpaceLow** | EC2 root disk free % | <20% free for 5m | 🟡 Warning |
| 6 | **HighMemoryUsage** | EC2 RAM utilization | >85% for 5m | 🟡 Warning |
| 7 | **AIPipelineFailing** | AI extraction failure rate | >10% failures for 10m | 🟡 Warning |

### Where Each Alert's Metrics Come From

```
Alert: BackendDown
  └─ Metric: up{job="backend"}
  └─ Source: Prometheus self-check (did /metrics respond?)

Alert: HighErrorRate
  └─ Metric: http_requests_total{status=~"5.."}  /  http_requests_total
  └─ Source: axum-prometheus middleware (auto-instrumented in api.rs)

Alert: HighLatency
  └─ Metric: histogram_quantile(0.99, http_request_duration_seconds_bucket)
  └─ Source: axum-prometheus middleware (auto-instrumented in api.rs)

Alert: DiskSpaceLow
  └─ Metric: node_filesystem_avail_bytes / node_filesystem_size_bytes
  └─ Source: node-exporter (mounted on host /proc, /sys)

Alert: HighMemoryUsage
  └─ Metric: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes
  └─ Source: node-exporter (host metrics)

Alert: AIPipelineFailing
  └─ Metric: coopdata_ai_extraction_duration_seconds_count{status="failure"}
  └─ Source: Custom metric in extraction_pipeline.rs

Alert: PostgresDown
  └─ Metric: up{job="postgres"}
  └─ Source: Prometheus self-check (did postgres-exporter respond?)
```

### What's Missing: Notification Channels

| Component | Status | What's Needed |
|-----------|--------|---------------|
| **Contact Point** | ❌ Not configured | Slack webhook URL or SMTP config |
| **Notification Policy** | ❌ Not configured | Route `critical` → Slack+Email, `warning` → Slack |
| **Silence Rules** | ❌ Not configured | Suppress alerts during maintenance windows |

When ready to add notifications:
1. Create a Slack Incoming Webhook → get a URL
2. In Grafana → Alerting → Contact Points → New → Slack → paste the webhook URL
3. In Grafana → Alerting → Notification Policies → set Default Contact Point to your Slack channel

---

## 6. What We Do NOT Monitor (Known Gaps)

| Gap | Why | Priority |
|-----|-----|----------|
| **Frontend errors** | No JS error tracking (Sentry, etc.) | Medium |
| **Frontend performance** | No Core Web Vitals, page load times | Medium |
| **User login/logout events** | Keycloak doesn't expose these as metrics | Low |
| **Database query duration** | We added the metric name but didn't instrument repos yet | High |
| **Log aggregation** | Logs go to stdout only, no centralized logging | Medium |

The **database query duration** gap is the most impactful — right now we can see if the API is slow, but we can't tell if it's because of a slow SQL query vs slow Keycloak call vs slow Redis call.

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
- [x] Add `GRAFANA_ADMIN_PASSWORD` to `.env.example`

### Phase 2: Custom Business Metrics ✅ Complete

- [x] Instrument `cache.rs` with hit/miss/set counters
- [x] Instrument `keycloak.rs` with request/error counters
- [x] Instrument `extraction_pipeline.rs` with duration histogram
- [x] Instrument `submission_workflow.rs` with submission counter

### Phase 3: Grafana Dashboards ✅ Complete

- [x] Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- [x] Create `coopdata-backend.json` dashboard (12 panels)
- [x] Create `infrastructure.json` dashboard (9 panels)
- [x] Create `business-metrics.json` dashboard (12 panels)

### Phase 4: Alerting Rules ⚠️ Partial

- [x] Create `monitoring/alerts.yml` with 7 rules
- [x] Wire Prometheus to load rules file
- [ ] Configure Grafana alert routing (Slack/Email) — **not yet**

### Phase 5: Database Query Metrics ⏳ Not Started

- [ ] Instrument repository layer with `coopdata_db_query_duration_seconds`
- [ ] Add DB query panels to Grafana dashboards

---

## 8. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAFANA_ADMIN_PASSWORD` | `admin` (dev only) | Grafana admin password |
| `PROMETHEUS_RETENTION_DAYS` | `30` | Prometheus data retention |

---

## 9. Dependency Versions

| Crate | Version | Purpose |
|-------|---------|---------|
| `axum-prometheus` | `0.10` | Auto HTTP metrics middleware for Axum |
| `metrics` | `0.24` | Metrics facade (counter!, histogram!, gauge!) |
| `metrics-exporter-prometheus` | `0.18` | Prometheus-compatible exporter |

| Docker Image | Version | Purpose |
|--------------|---------|---------|
| `prom/prometheus` | `v2.53.0` | Time-series database |
| `grafana/grafana` | `11.1.0` | Dashboards + alerting |
| `prometheuscommunity/postgres-exporter` | Latest stable | PostgreSQL metrics |
| `oliver006/redis_exporter` | Latest stable | Redis metrics |
| `prom/node-exporter` | Latest stable | Host metrics |

---

## 10. Security Considerations

1. **Prometheus is internal-only** — bound to `127.0.0.1:9090`, not exposed through nginx
2. **Grafana admin password** — via env var, never hardcoded in docker-compose
3. **Node Exporter** — mounts host `/proc` and `/sys` as read-only
4. **No sensitive data in metrics** — metric labels use entity names, not IDs or PII
5. **Network isolation** — all monitoring services communicate within Docker network only

---

## 11. Complete File Structure

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
        └── api/
            └── routes/
                └── api.rs          # Updated with /metrics endpoint
```
