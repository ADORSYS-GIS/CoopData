# Observability & Monitoring — Implementation Plan

> **Ticket**: [#70](https://github.com/ADORSYS-GIS/CoopData/issues/70) — Implement Grafana and Prometheus for Monitoring
> **Status**: Planning
> **Branch**: `feat/observability` (to be created)
> **Date**: 2026-08-12

---

## 1. Problem Statement

CoopData currently has **zero observability**. The backend emits `tracing` logs to stdout but exposes no metrics, has no dashboard, and no alerting. You cannot see request latency, error rates, DB pool health, or Redis cache performance in production.

### Current State (Audited)

| What | Status |
|------|--------|
| Structured logs via `tracing` | ✅ exists |
| Request logging middleware (`method`, `uri`, `status`, `duration_ms`) | ✅ exists |
| `GET /api/v1/health` health endpoint | ✅ exists |
| Redis cache (`CacheService`) | ✅ exists |
| `/metrics` Prometheus endpoint | ❌ none |
| Prometheus in Docker Compose | ❌ none |
| Grafana | ❌ none |
| Alerting | ❌ none |
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

## 3. Phased Implementation

### Phase 1: Foundation (Backend Metrics + Docker Infrastructure)

**Goal**: Get HTTP metrics flowing from the backend to Grafana with zero manual config.

#### 1.1 Backend — Add `/metrics` endpoint

**Dependencies to add** (`backend/Cargo.toml`):

```toml
axum-prometheus = "0.10"    # Auto HTTP metrics middleware
metrics = "0.24"            # Metrics facade (counter!, histogram!, gauge!)
metrics-exporter-prometheus = "0.18"  # Prometheus exporter
```

**Files to modify**:

| File | Change |
|------|--------|
| `backend/Cargo.toml` | Add 3 new dependencies |
| `backend/src/api/routes/api.rs` | Create `PrometheusMetricLayer::pair()` → attach layer globally + add `/metrics` route (no auth middleware) |

**How it works**:

```rust
// In api.rs — create_app() function
use axum_prometheus::PrometheusMetricLayer;

let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();

let app = Router::new()
    // ... existing routes ...
    .route("/metrics", get(move || async move { metric_handle.render() }))
    .layer(prometheus_layer)  // Auto-tracks ALL HTTP requests
    // ... other layers ...
```

**Result**: `GET /metrics` returns Prometheus text format with:
- `http_requests_total` — Counter with labels: `method`, `uri`, `status`
- `http_request_duration_seconds` — Histogram with labels: `method`, `uri`, `status`
- `http_requests_in_flight` — Gauge

#### 1.2 Docker Compose — Add Monitoring Services

**Files to modify**: `docker-compose.yml`, `docker-compose.ghcr.yaml`

**5 new services**:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `prometheus` | `prom/prometheus:v2.53.0` | `127.0.0.1:9090:9090` | Time-series DB, scrapes every 15s |
| `grafana` | `grafana/grafana:11.1.0` | `127.0.0.1:3001:3000` | Dashboards + alerting |
| `postgres-exporter` | `prometheuscommunity/postgres-exporter` | Internal | PG connection stats |
| `redis-exporter` | `oliver006/redis_exporter` | Internal | Cache hit rates, memory |
| `node-exporter` | `prom/node-exporter` | Internal | Host CPU, RAM, disk I/O |

**New volumes**: `prometheus_data`, `grafana_data`

**New env var**: `GRAFANA_ADMIN_PASSWORD`

#### 1.3 Nginx — Expose Grafana

**File to modify**: `nginx-host.conf`

```nginx
# ── Grafana (Observability Dashboard) ─────────────────────────────
location /grafana/ {
    proxy_pass         http://127.0.0.1:3001/;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
}
```

#### 1.4 Grafana — Auto-provision Datasource

**New files**:

```
monitoring/
└── grafana/
    └── provisioning/
        └── datasources/
            └── prometheus.yml
```

```yaml
# monitoring/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**End of Phase 1**: `docker compose up` starts the full stack. Grafana at `/grafana/` shows the Prometheus datasource. HTTP request metrics auto-flow.

---

### Phase 2: Custom Business Metrics

**Goal**: Instrument the 4 key subsystems with domain-specific metrics.

| Metric | Type | Location | Labels |
|--------|------|----------|--------|
| `coopdata_cache_hits_total` | Counter | `cache.rs` → `get()` on hit | `entity` |
| `coopdata_cache_misses_total` | Counter | `cache.rs` → `get()` on miss | `entity` |
| `coopdata_keycloak_requests_total` | Counter | `keycloak.rs` → all API calls | `operation` |
| `coopdata_keycloak_errors_total` | Counter | `keycloak.rs` → on error | `operation` |
| `coopdata_ai_extraction_duration_seconds` | Histogram | `extraction_pipeline.rs` | `status` |
| `coopdata_submissions_processed_total` | Counter | `submission_workflow.rs` | `status` |
| `coopdata_db_query_duration_seconds` | Histogram | Key repositories (optional) | `operation`, `entity` |

**Files to modify**: `cache.rs`, `keycloak.rs`, `extraction_pipeline.rs`, `submission_workflow.rs`

**Example instrumentation** (cache.rs):

```rust
use metrics::{counter, histogram};

pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, redis::RedisError> {
    let start = std::time::Instant::now();
    let result = /* ... existing logic ... */;
    let elapsed = start.elapsed().as_secs_f64();

    match &result {
        Ok(Some(_)) => counter!("coopdata_cache_hits_total", "entity" => key.split(':').next().unwrap_or("unknown")).increment(1),
        Ok(None) => counter!("coopdata_cache_misses_total", "entity" => key.split(':').next().unwrap_or("unknown")).increment(1),
        Err(_) => {}
    }

    histogram!("coopdata_db_query_duration_seconds", "operation" => "cache_get").record(elapsed);
    result
}
```

---

### Phase 3: Grafana Dashboards (Provisioned as Code)

**Goal**: 3 auto-provisioned dashboards for different audiences.

| Dashboard | File | Audience | Key Panels |
|-----------|------|----------|------------|
| Backend Overview | `coopdata-backend.json` | Backend Engineers | Request rate, error rate %, latency p99/p90/p50, cache hit ratio, Keycloak API latency |
| Infrastructure | `infrastructure.json` | DevOps / SysAdmins | PG active/idle connections, Redis memory vs max, host CPU/RAM/disk, MinIO storage |
| Business Metrics | `business-metrics.json` | Product / Ministry | Submissions by status, AI extraction success rate, active sessions |

**New files**:

```
monitoring/
└── grafana/
    ├── provisioning/
    │   └── dashboards/
    │       └── dashboards.yml
    └── dashboards/
        ├── coopdata-backend.json
        ├── infrastructure.json
        └── business-metrics.json
```

**Dashboards provisioning config**:

```yaml
# monitoring/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: CoopData
    orgId: 1
    folder: ""
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

---

### Phase 4: Alerting Rules

**Goal**: 6+ alert rules evaluated by Prometheus, routed via Grafana to Slack/Email.

**File**: `monitoring/alerts.yml`

| Alert Name | Condition | Severity | Channel |
|------------|-----------|----------|---------|
| `BackendDown` | `up{job="backend"} == 0` for >1m | Critical | Slack + Email |
| `PostgresDown` | `up{job="postgres"} == 0` for >1m | Critical | Slack + Email |
| `HighErrorRate` | 5xx HTTP responses > 1% of total traffic over 5m | Critical | Slack + Email |
| `HighLatency` | p99 API latency > 2.0s over 5m | Warning | Slack |
| `DiskSpaceLow` | EC2 root volume free space < 20% | Warning | Slack |
| `HighMemoryUsage` | EC2 host RAM utilization > 85% | Warning | Slack |

**Prometheus rules config**:

```yaml
# monitoring/alerts.yml
groups:
  - name: coopdata_alerts
    rules:
      - alert: BackendDown
        expr: up{job="backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CoopData backend is down"
          description: "Backend has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate"
          description: "More than 1% of requests are returning 5xx errors."

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency (p99 > 2s)"
          description: "99th percentile response time exceeds 2 seconds."
```

---

## 4. Complete New File Structure

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

---

## 5. Acceptance Criteria

- [ ] `GET /metrics` returns valid Prometheus text format
- [ ] `/metrics` is NOT accessible through nginx (internal only)
- [ ] `docker compose up` starts full stack including monitoring with zero manual steps
- [ ] Grafana at `https://<domain>/grafana/` with auto-provisioned dashboards
- [ ] Admin password via `GRAFANA_ADMIN_PASSWORD` env var (not hardcoded)
- [ ] 30-day data retention in named Docker volumes
- [ ] All 6 alert rules configured and testable
- [ ] Backend auto-tracks HTTP request counts and latency for ALL endpoints
- [ ] Cache hit/miss metrics flow from `CacheService`
- [ ] Keycloak API call metrics flow from `KeycloakService`

---

## 6. Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAFANA_ADMIN_PASSWORD` | `admin` (dev only) | Grafana admin password |
| `PROMETHEUS_RETENTION_DAYS` | `30` | Prometheus data retention |

---

## 7. Implementation Checklist

### Phase 1
- [ ] Add `axum-prometheus`, `metrics`, `metrics-exporter-prometheus` to `backend/Cargo.toml`
- [ ] Wire `PrometheusMetricLayer` into `api.rs` router
- [ ] Add `/metrics` route (no auth, internal only)
- [ ] Create `monitoring/prometheus.yml` scrape config
- [ ] Create `monitoring/grafana/provisioning/datasources/prometheus.yml`
- [ ] Add 5 services to `docker-compose.yml`
- [ ] Add 5 services to `docker-compose.ghcr.yaml`
- [ ] Add `location /grafana/` to `nginx-host.conf`
- [ ] Add `GRAFANA_ADMIN_PASSWORD` to `.env.example`
- [ ] Test: `docker compose up` → Grafana accessible at `/grafana/`

### Phase 2
- [ ] Instrument `cache.rs` with hit/miss counters
- [ ] Instrument `keycloak.rs` with request/error counters
- [ ] Instrument `extraction_pipeline.rs` with duration histogram
- [ ] Instrument `submission_workflow.rs` with submission counter
- [ ] Test: Metrics appear in Grafana explore view

### Phase 3
- [ ] Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- [ ] Create `coopdata-backend.json` dashboard
- [ ] Create `infrastructure.json` dashboard
- [ ] Create `business-metrics.json` dashboard
- [ ] Test: All 3 dashboards render in Grafana

### Phase 4
- [ ] Create `monitoring/alerts.yml` with 6 rules
- [ ] Wire Prometheus to load rules file
- [ ] Configure Grafana alert routing (Slack/Email)
- [ ] Test: Alerts fire correctly in Grafana

---

## 8. Dependency Versions

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

## 9. Security Considerations

1. **Prometheus is internal-only** — bound to `127.0.0.1:9090`, not exposed through nginx
2. **Grafana admin password** — via env var, never hardcoded in docker-compose
3. **Node Exporter** — mounts host `/proc` and `/sys` as read-only
4. **No sensitive data in metrics** — metric labels use entity names, not IDs or PII
5. **Network isolation** — all monitoring services communicate within Docker network only
