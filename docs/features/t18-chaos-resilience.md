# T18: Chaos & Resilience Testing

> **Status:** ✅ Complete
> **Ticket:** T18
> **Labels:** testing, chaos, reliability, docker
> **Priority:** High
> **Implementation Date:** 2026-09-18

---

## Overview

T18 verifies that the CoopData platform can recover from infrastructure and
dependency failures — database (Postgres), Redis, and Keycloak — **during active
processing**, without data corruption and without manual intervention.

The ticket has two deliverables:

1. **Docker requirement** — `docker-compose.yml` must use appropriate restart
   policies (`restart: unless-stopped`) so services auto-recover.
2. **Failure scenarios** — verify the backend survives and reconnects after each
   dependency is stopped and restored.

---

## What Was Implemented

### 1. Docker restart policies (`docker-compose.yml`)

Added `restart: unless-stopped` to the **core services** that previously had no
restart policy:

| Service | Before | After |
| ------- | ------ | ----- |
| `postgres` | none | `unless-stopped` |
| `redis` | none | `unless-stopped` |
| `keycloak` | none | `unless-stopped` |
| `backend` | none | `unless-stopped` |
| `frontend` | none | `unless-stopped` |
| `minio` | none | `unless-stopped` |

`keycloak-provision` is intentionally left without a restart policy — it is a
one-shot provisioning job, not a long-running service.

### 2. Dependency-aware health endpoint (`backend/src/api/handlers/health.rs`)

`GET /api/v1/health` previously returned a static `{"status":"healthy"}`. It now
actively probes all three dependencies and reports a per-check breakdown:

- `database` — via `state.db.ping()`
- `redis` — via `state.cache.ping()` (new method)
- `keycloak` — via `state.keycloak.is_healthy()` (new method)

Response:
- **200** `{"status":"healthy","checks":{...}}` when all dependencies are up.
- **503** `{"status":"degraded","checks":{...}}` when any dependency is down.

This gives the chaos test (and operators) a reliable signal for "backend
recovered" / "backend degraded".

### 3. Keycloak HTTP client timeout (`backend/src/services/keycloak.rs`)

`KeycloakService` used `Client::new()` with **no timeout**, so a hung Keycloak
would block requests indefinitely. Now configured with:
- `connect_timeout: 5s`
- `timeout: 15s`

This makes the "Keycloak timeout" failure scenario fail fast instead of hanging.

### 4. Graceful cache degradation (`backend/src/services/cache.rs`)

- Added `CacheService::ping()` — liveness probe for the cache backend.
- `get()` now returns a clean `RedisError` (instead of panicking) when the
  connection cannot be established, and increments a `coopdata_cache_errors_total`
  counter. Combined with the existing `memory://` fallback backend and the
  idempotency middleware's `if let Ok(...)` handling, a Redis outage degrades
  gracefully rather than crashing the API.

### 5. Chaos test script (`scripts/test-chaos.sh`)

Automates the ticket's verification flow for all three dependencies:

```
Scenario 1: Database failure   -> capture baseline (count + checksum of submissions)
                                   -> docker compose stop postgres
                                   -> assert health = degraded (database=down)
                                   -> attempt write txn while down (must fail cleanly)
                                   -> docker compose start postgres
                                   -> assert health = healthy (database=ok)
                                   -> TRANSACTION INTEGRITY:
                                        - data unchanged from baseline (no corruption)
                                        - rolled-back txn leaves no trace (atomicity)
                                        - committed txn persists (write path works)
Scenario 2: Redis failure      -> same pattern for redis
Scenario 3: Keycloak failure   -> same pattern for keycloak (--no-keycloak to skip)
```

The script uses the **production compose file** (`docker-compose.yml`) explicitly
so the dev override (cargo-watch) is not used.

The transaction-integrity section directly satisfies the ticket's "verify
transaction integrity" acceptance criterion:
- **No corruption**: `submissions` row count + checksum are identical before and
  after the outage.
- **Atomicity**: a `BEGIN; INSERT; ROLLBACK` leaves 0 rows.
- **Write path restored**: a `BEGIN; INSERT; COMMIT` persists exactly 1 row.
- Test rows are cleaned up so the DB is left as found.

---

## Acceptance Criteria Mapping

| Criterion | Status | How verified |
| --------- | ------ | ------------ |
| Database failure is tested | ✅ | `scripts/test-chaos.sh` Scenario 1 |
| Redis failure is tested | ✅ | `scripts/test-chaos.sh` Scenario 2 |
| Keycloak failure is tested | ✅ | `scripts/test-chaos.sh` Scenario 3 |
| Services recover automatically | ✅ | `restart: unless-stopped` + health probe returns to `healthy` |
| No data corruption occurs | ✅ | Backend stays up; DB pool reconnects transparently (SeaORM pool) |
| Backend reconnects after dependency recovery | ✅ | Health endpoint returns `database=ok` / `redis=ok` / `keycloak=ok` after restore |
| Verify transaction integrity | ✅ | `scripts/test-chaos.sh` — baseline count+checksum unchanged, rollback leaves no trace, commit persists |

---

## How to Run

```bash
# Full chaos test (all three dependencies)
./scripts/test-chaos.sh

# Skip the Keycloak scenario (it restarts Keycloak, ~30-60s)
./scripts/test-chaos.sh --no-keycloak
```

---

## Related

- `docs/features/t12-retry-idempotency.md` — idempotency + retry patterns that
  protect against duplicate writes during transient failures (relevant to the
  "no data corruption" criterion).
- `docs/architecture/progress.md` — Phase 27 (T18) tracking.
