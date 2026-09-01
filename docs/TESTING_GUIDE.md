# Load Testing Guide — CoopData API

> **Ticket:** [#92](https://github.com/ADORSYS-GIS/CoopData/issues/92) — Implement k6 Load & Stress Testing Suite

> **For comprehensive results with diagrams, see [load-testing-report.md](./load-testing-report.md)**

## Overview

This guide covers how to run k6 load, stress, spike, and smoke tests against the CoopData API.
Tests validate system performance, SLA compliance, and behavior under concurrent load.

## Prerequisites

### 1. Install k6

```bash
# Linux (binary download)
curl -sL https://github.com/grafana/k6/releases/download/v0.56.0/k6-v0.56.0-linux-amd64.tar.gz | tar -xz
sudo mv k6-v0.56.0-linux-amd64/k6 /usr/local/bin/k6

# macOS
brew install k6

# Verify
k6 version
```

### 2. Start the Docker Compose Stack

```bash
cd /path/to/CoopData

# Start all services (backend, keycloak, postgres, redis, etc.)
docker compose up -d

# Wait for Keycloak to be healthy (check with:)
docker compose logs -f keycloak-provision
# Wait for "Provisioning complete!" message
```

### 3. Verify Backend is Running

```bash
curl http://localhost:3000/api/v1/health
# Should return: {"status":"ok","version":"..."}
```

## Test Scenarios

| Scenario | Script | VUs | Duration | Purpose |
|----------|--------|-----|----------|---------|
| Smoke Test | `smoke-test.js` | 5 | 1 min | Verify all endpoints are alive |
| Load Test | `load-test.js` | 50 | 5 min | SLA validation under normal peak |
| Stress Test | `stress-test.js` | 0→300 | 3 min | Find breaking point |
| Spike Test | `spike-test.js` | 50→500 | 4 min | Test sudden traffic bursts |

## Running Tests

### Smoke Test (start here)

```bash
k6 run tests/load/k6/smoke-test.js
```

Expected: All endpoints return 2xx/4xx responses. If this fails, fix the issue before running heavier tests.

### Load Test (SLA gate)

```bash
k6 run tests/load/k6/load-test.js
```

**SLA thresholds (auto pass/fail):**
- Error rate < 1%
- p95 latency < 500ms
- p99 latency < 1500ms

### Stress Test (exploratory)

```bash
k6 run tests/load/k6/stress-test.js
```

No thresholds — this test finds the system's breaking point. Review the metrics output to see where latency spikes and errors climb.

### Spike Test (sudden burst)

```bash
k6 run tests/load/k6/spike-test.js
```

Tests how the system handles sudden traffic spikes (e.g., batch notification sent, deadline reminder).

### Save Results to File

```bash
# JSON output for report generation
k6 run --out json=results/load-test.json tests/load/k6/load-test.js
k6 run --out json=results/stress-test.json tests/load/k6/stress-test.js
```

## Environment Targeting

Tests default to `localhost`. To target production (EC2):

```bash
# Production (requires .env with K6_CLIENT_SECRET)
set -a && source .env && set +a

# Production requires --insecure-skip-tls-verify (self-signed cert)
k6 run --insecure-skip-tls-verify tests/load/k6/smoke-test.js
k6 run --insecure-skip-tls-verify tests/load/k6/load-test.js
k6 run --insecure-skip-tls-verify tests/load/k6/stress-test.js
k6 run --insecure-skip-tls-verify tests/load/k6/spike-test.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `K6_TARGET_ENV` | `localhost` | Environment: `localhost` or `production` |
| `K6_CLIENT_SECRET` | (from .env) | Keycloak client secret for `coopdata-backend` |
| `K6_BASE_URL` | (per env) | Override backend API base URL |
| `K6_KEYCLOAK_URL` | (per env) | Override Keycloak server URL |
| `K6_REALM` | `coop-data` | Keycloak realm name |
| `K6_CLIENT_ID` | `coopdata-backend` | Keycloak client ID |

> **Note:** Production EC2 uses a self-signed TLS certificate. All production k6 runs require `--insecure-skip-tls-verify` flag.

## Understanding the Output

### Terminal Summary

After each test, k6 prints a summary:

```
http_req_duration.........: avg=120ms  min=8ms   med=95ms  max=800ms  p(90)=250ms  p(95)=320ms  p(99)=650ms
http_req_failed...........: 0.30%      ✓ 75       ✗ 24925
```

Key metrics:
- **`http_req_duration`** — total time per request (connect + TLS + send + wait + receive)
- **`http_req_failed`** — percentage of requests that returned non-2xx
- **`p(95)`** — 95th percentile latency (95% of requests are faster than this)
- **`p(99)`** — 99th percentile latency

### Threshold Pass/Fail

```
✓ http_req_failed...........: rate<0.01       ✓ PASS
✓ http_req_duration.........: p(95)<500       ✓ PASS
```

Or:

```
✗ http_req_failed...........: rate<0.01       ✗ FAIL (2.5%)
✗ http_req_duration.........: p(95)<500       ✗ FAIL (750ms)
```

Exit code: `0` = all passed, `1` = at least one failed.

## File Structure

```
tests/load/k6/
├── helpers/
│   ├── config.js          # Environment configuration
│   ├── auth.js            # Keycloak client_credentials token fetch
│   └── endpoints.js       # Full API endpoint catalog (36 endpoints)
├── smoke-test.js          # Scenario 1: 5 VUs, 1 min
├── load-test.js           # Scenario 2: 50 VUs, 5 min (SLA gate)
├── stress-test.js         # Scenario 3: 0→300 VUs, 3 min
└── spike-test.js          # Scenario 4: 50→500 VUs, 4 min
```

## Troubleshooting

### "Keycloak token fetch failed"

- Ensure Keycloak is running: `docker compose ps keycloak`
- Check Keycloak health: `curl http://localhost:8180/health/ready`
- Verify client secret matches `.env`: `KEYCLOAK_CLIENT_SECRET`

### "connection refused"

- Backend not running: `docker compose ps backend`
- Check backend logs: `docker compose logs backend`

### High error rate in load test

- Check backend logs for errors: `docker compose logs -f backend`
- Monitor resource usage: `docker stats`
- Check PostgreSQL connections: `docker compose exec postgres psql -U coopdata -c "SELECT count(*) FROM pg_stat_activity;"`

### Stress test shows connection refused at high VUs

This is expected — the system has a finite capacity. Note at what VU count errors start climbing. This is the **breaking point**. The cgroup limits and auto-healing should recover the system after the test completes.
