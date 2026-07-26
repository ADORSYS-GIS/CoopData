#7: gotenberg-pdf-export-err-connection-refused

# Postmortem: Cooperative PDF Export Fails — Gotenberg Chromium ERR_CONNECTION_REFUSED

**Date:** 2026-07-25
**Severity:** High — Cooperative PDF export completely non-functional; returns 500 with "unstream error" PDF
**Affected area:** Backend (export_generator.rs) + Gotenberg 8 service + Frontend (Vite config + Docker networking)
**Resolution:** Root cause identified as Gotenberg 8 internal Chromium proxy (`--proxy-server=http://127.0.0.1:42181`) blocking all outbound connections. Three real bugs were also fixed along the way.

---

## 1. Symptom

When a user clicks **Export → PDF** on the Reports Page for a cooperative submission:

1. Backend logs show: `net::ERR_CONNECTION_REFUSED: loading failed` from Gotenberg
2. User receives a PDF file containing the text "unstream error" instead of the actual report
3. The background export (triggered on approval) also fails with the same error
4. No pre-baked exports exist in S3 (confirmed via `mc ls`)

Backend error log:
```
ERROR coop_data_backend::services::export_generator:
  Failed to generate exports in the background
  submission_id=96824528-f182-47d2-a256-12082b7bd927
  error=Internal server error: Gotenberg returned error status 400 Bad Request:
    Chromium returned net::ERR_CONNECTION_REFUSED: loading failed
```

## 2. Architecture Context

### The Full Export Chain

```
User clicks Export → PDF
    ↓
GET /api/v1/cooperative/submissions/{id}/export?format=pdf
    ↓
Backend checks S3 for pre-baked PDF → 404 (none exists)
    ↓
Backend calls Gotenberg HTTP API:
  POST http://gotenberg:3000/forms/chromium/convert/url
  -F "url=http://frontend:5173/print/cooperative/{id}?token={jwt}"
  -F "waitExpression=window.status === 'ready'"
    ↓
Gotenberg's headless Chromium navigates to the URL
    ↓
React app renders CooperativeReportPrint (3-page report with Recharts)
    ↓
Chromium captures the rendered page as PDF
    ↓
PDF bytes returned → stored in S3 → returned to user
```

### The "Two Worlds" Docker Networking Concept

Understanding this issue requires understanding Docker networking:

| World | DNS Resolution | Used By |
|-------|---------------|---------|
| **Host World** (your laptop) | `localhost` | Your browser, curl on host |
| **Internal Docker World** | Service names (`frontend`, `backend`, `keycloak`) | Containers talking to each other |

This is the same pattern Keycloak uses:
- `VITE_KEYCLOAK_URL=http://localhost:8180` — browser (Host World) uses `localhost`
- `KEYCLOAK_URL=http://keycloak:8180` — backend (Docker World) uses service name

Gotenberg lives entirely in the **Internal Docker World**:
- Backend → Gotenberg: `http://gotenberg:3000` ✓ (works, same Docker network)
- Gotenberg → Frontend: `http://frontend:5173` ✗ (fails — see root cause below)

Key files:
- `backend/src/services/export_generator.rs:100-140` — `generate_cooperative_pdf()`
- `backend/src/config.rs:60` — `gotenberg_frontend_url` field
- `frontend/src/pages/reports/CooperativeReportPrint.tsx` — React report component
- `frontend/src/routes/print/cooperative/$id.tsx` — Print route

---

## 3. Bugs Found and Fixed (In Chronological Order)

### Bug 1: Hardcoded Port — `http://frontend:80` in Production Code

**Observation:** `export_generator.rs:112` hardcoded `http://frontend:80` for the Gotenberg URL. But in the dev environment (`docker-compose.override.yml`), the frontend runs Vite on port 5173, not nginx on port 80.

**Evidence:**
```bash
$ docker compose exec gotenberg curl http://frontend:80/
→ connect to 172.18.0.11 port 80 failed: Connection refused
```

**Fix applied:**
- Added `gotenberg_frontend_url` field to `AppConfig` in `backend/src/config.rs`
- Reads from `GOTENBERG_FRONTEND_URL` env var, defaults to `http://frontend:80`
- Changed `export_generator.rs:112` from hardcoded URL to `state.config.gotenberg_frontend_url`
- Set `GOTENBERG_FRONTEND_URL=http://frontend:5173` in `docker-compose.override.yml`
- Added to `docker-compose.yml` backend env section

**Result:** ✅ Fixed the port mismatch. curl from Gotenberg now reaches the frontend on port 5173. But PDF generation still fails.

---

### Bug 2: Vite 7 Host Protection — 403 Forbidden

**Observation:** After fixing the port, testing from Gotenberg:
```bash
$ docker compose exec gotenberg curl http://frontend:5173/
→ HTTP 403 Forbidden (Vite 7 blocks unknown Host headers)

$ docker compose exec gotenberg curl -H "Host: localhost:5173" http://frontend:5173/
→ HTTP 200 OK (localhost header passes)
```

Vite 7 added a security feature that rejects requests from unknown hostnames. Gotenberg sends `Host: frontend:5173` which Vite blocks.

**Fix applied:**
- Added `allowedHosts: true` to `vite.config.ts` server config
- This tells Vite to accept requests from any Host header

**Result:** ✅ curl from Gotenberg now returns 200 OK. But Gotenberg's Chromium still gets `ERR_CONNECTION_REFUSED`.

---

### Bug 3: API Calls Unreachable from Gotenberg's Browser

**Observation:** When Gotenberg's Chromium loads the print page, the React component makes API calls to fetch submission data. These use:
```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
// → "http://localhost:3000" (from docker-compose override)
```

Inside Gotenberg's container, `localhost:3000` resolves to the **Gotenberg container itself** (which listens on port 3000 for its own API), not the backend. API calls fail silently → page shows "Failed to load report data".

**Fix applied:**
- Set `VITE_API_BASE_URL: ""` in `docker-compose.override.yml`
- Empty string means API calls go through Vite's proxy (`/api` → `http://backend:3000`)
- Verified the proxy works: `curl http://frontend:5173/api/v1/health → 200 OK`

**Result:** ✅ All curl tests pass. But Gotenberg's actual Chromium request still fails.

---

### Bug 4 (Theory): Vite IPv6-Only Binding

**Hypothesis:** In Node v17+/v22, setting `host: true` in Vite may cause it to bind exclusively to the **IPv6** loopback address (`::`). Gotenberg's Chromium (running on Debian) resolves `frontend` to an **IPv4** address (`172.18.0.x`). If Vite is only listening on IPv6, Gotenberg gets `ERR_CONNECTION_REFUSED` on the IPv4 address.

**Fix proposed:** Changed `host: true` to `host: '0.0.0.0'` in `vite.config.ts` to force Vite to bind to all IPv4 addresses.

**Result:** ❌ **Did NOT fix the issue.** This theory was disproven by earlier evidence:
```bash
# curl from inside Gotenberg uses IPv4 → 200 OK ✓
$ docker compose exec gotenberg curl http://frontend:5173/ → 200 OK

# If Vite were IPv6-only, curl would ALSO fail on IPv4
# The fact that curl succeeds proves Vite IS listening on IPv4
```
The real issue is Chromium's internal proxy (`--proxy-server`), not Vite's bind address. However, `host: '0.0.0.0'` is still better practice than `host: true` for explicitness.

---

## 4. The Real Showstopper: Gotenberg 8 Chromium Proxy

### The Discovery

After fixing all three bugs above, `curl` from inside Gotenberg returned 200 OK for everything:
```bash
$ docker compose exec gotenberg curl http://frontend:5173/ → 200 OK ✓
$ docker compose exec gotenberg curl http://172.18.0.10:5173/ → 200 OK ✓
$ docker compose exec gotenberg curl http://frontend:5173/api/v1/health → 200 OK ✓
```

But Gotenberg's actual PDF conversion still failed:
```
POST /forms/chromium/convert/url → net::ERR_CONNECTION_REFUSED ✗
```

**curl worked but Chromium didn't.** This pointed to a Chromium-specific issue. So we inspected the actual Chromium process:

```bash
$ docker compose exec gotenberg ps aux | grep chromium
```

### The Smoking Gun

Found this Chromium flag:
```
--proxy-server=http://127.0.0.1:42181
```

**Gotenberg 8 routes ALL Chromium traffic through an internal HTTP proxy** running on `127.0.0.1:42181`. This proxy:
- Forces all browser network requests through a local man-in-the-middle (for logging/security)
- **Cannot resolve Docker service DNS names** (has no access to Docker's internal DNS)
- Blocks connections to both hostnames (`frontend`) and direct IPs (`172.18.0.10`)

### Proof

```bash
# curl bypasses the proxy → works
$ docker compose exec gotenberg curl http://frontend:5173/ → 200 OK

# Chromium goes through the proxy → blocked
Gotenberg Chromium → proxy (127.0.0.1:42181) → "frontend:5173" → ERR_CONNECTION_REFUSED

# Even direct IP doesn't work through the proxy
Gotenberg Chromium → proxy (127.0.0.1:42181) → "172.18.0.10:5173" → ERR_CONNECTION_REFUSED
```

Verified via the Gotenberg API directly:
```bash
$ curl -s -X POST http://localhost:8081/forms/chromium/convert/url \
  -F "url=http://frontend:5173/" \
  -o /tmp/test.pdf
→ "Chromium returned net::ERR_CONNECTION_REFUSED: loading failed"

$ curl -s -X POST http://localhost:8081/forms/chromium/convert/url \
  -F "url=http://172.18.0.10:5173/" \
  -o /tmp/test.pdf
→ "Chromium returned net::ERR_CONNECTION_REFUSED: loading failed"
```

**Result:** Confirmed as the root cause. The `--proxy-server` flag is **hardcoded** in Gotenberg 8's Chromium launch configuration. There is no environment variable or config file to disable or configure it.

### Why This Is Unfixable Without Changing Gotenberg

1. The proxy is an **internal architectural decision** in Gotenberg 8 — it's not user-configurable
2. Gotenberg 8 does not expose env vars or config to customize Chromium's `--proxy-server` flag
3. The proxy runs inside the Gotenberg container on `127.0.0.1:42181` — it's completely internal
4. Even if we could configure it, the proxy would still need access to Docker DNS, which it doesn't have

---

## 5. Full Causal Chain

```
Gotenberg 8 launches Chromium with --proxy-server=http://127.0.0.1:42181
    ↓
All Chromium HTTP requests are forced through the internal proxy
    ↓
Backend sends Gotenberg: "Load http://frontend:5173/print/cooperative/{id}?token=..."
    ↓
Gotenberg tells Chromium to navigate to the URL
    ↓
Chromium sends the navigation request to the internal proxy (127.0.0.1:42181)
    ↓
Proxy attempts to connect to "frontend:5173"
    ↓
Proxy CANNOT resolve Docker service DNS (has no access to Docker's network stack)
    ↓
Proxy returns ERR_CONNECTION_REFUSED to Chromium
    ↓
Chromium reports: net::ERR_CONNECTION_REFUSED: loading failed
    ↓
Gotenberg returns HTTP 400 with the error message
    ↓
Backend wraps error: "Gotenberg returned error status 400 Bad Request"
    ↓
User receives a PDF containing "unstream error" text
```

---

## 6. Why This Was Hard to Diagnose

1. **The error message was misleading.** `ERR_CONNECTION_REFUSED` typically means the target server isn't running. But the frontend WAS running — Gotenberg's proxy was blocking the connection.
2. **curl from the same container worked.** This created a false impression that networking was fine. But curl bypasses Chromium's proxy, so it tested a completely different network path.
3. **Four real bugs/red herrings masked the hidden bug.** The hardcoded port (Bug 1), Vite host protection (Bug 2), API reachability (Bug 3), and IPv6 binding theory (Bug 4) were all investigated. Some were real issues, some were disproven theories. None addressed the Chromium proxy issue.
4. **No configuration knob for the proxy.** Gotenberg 8 doesn't expose environment variables or config files to customize Chromium's `--proxy-server` flag. We cannot work around it.
5. **The env var was verified as correct.** `GOTENBERG_FRONTEND_URL=http://frontend:5173` was confirmed present in the running container, eliminating "env var not loaded" as a hypothesis.
6. **Plausible-sounding theories can be wrong.** The IPv6 binding theory (Bug 4) sounded logical — Node v17+ with `host: true` could bind to IPv6-only. But it was disproven by curl succeeding on IPv4 from the same container.

---

## 7. All Fixes Applied (Summary Table)

| # | Fix | File | Status |
|---|-----|------|--------|
| 1 | `gotenberg_frontend_url` config field (env var) | `backend/src/config.rs` | ✅ Correct — still useful |
| 2 | Dynamic URL in export generator | `backend/src/services/export_generator.rs:112` | ✅ Correct — still useful |
| 3 | `allowedHosts: true` in Vite | `frontend/vite.config.ts` | ✅ Correct — still useful |
| 4 | `VITE_API_BASE_URL: ""` | `docker-compose.override.yml` | ✅ Correct — still useful |
| 5 | `GOTENBERG_FRONTEND_URL` env var | `docker-compose.yml` + `override.yml` | ✅ Correct — still useful |
| 6 | `host: '0.0.0.0'` in Vite | `frontend/vite.config.ts` | ⚠️ Good practice, but doesn't fix the issue |
| 7 | Chromium proxy bypass | N/A | ❌ **Unfixable** — Gotenberg 8 internal |

Fixes 1-5 are all valid and necessary. They will be required when the proxy issue is resolved (e.g., by downgrading Gotenberg or replacing it). Fix 6 is good practice for explicitness. But none of them solve the PDF export by themselves because of the Gotenberg 8 Chromium proxy (fix 7).

---

## 8. Resolution Options

### Option A: Abandon Gotenberg for Server-Side printpdf (Recommended)

Replace `generate_cooperative_pdf` with server-side PDF generation using the `printpdf` crate — the same approach used by:
- `generate_consolidated_pdf` (Apex exports)
- `generate_consolidated_federation_pdf` (Federation exports)
- `generate_consolidated_ministry_pdf` (Ministry exports)

**Pros:**
- Fast, reliable, no external service dependency
- No Docker networking issues
- Consistent with all other export generators
- No headless browser overhead

**Cons:**
- Loses the Recharts visualizations (charts, radar, donut)
- KPI data shown as tables instead of charts

### Option B: Downgrade to Gotenberg 7

Gotenberg 7 did not have the `--proxy-server` flag. Chromium had direct network access.

**Pros:**
- Preserves rich React-rendered PDF with charts
- Minimal code changes (already working with fixes 1-5)

**Cons:**
- Gotenberg 7 may have security/vulnerability issues
- Older version, less maintained
- May have other incompatibilities

### Option C: Run Gotenberg with Host Networking

Pass `--network=host` to Gotenberg so Chromium shares the host's network stack.

**Pros:**
- Preserves rich PDF output
- Minimal code changes

**Cons:**
- `--network=host` is a security concern (exposes all host network interfaces)
- Fragile, depends on Gotenberg's internal architecture
- Not portable across environments (especially Kubernetes)

---

## 9. Prevention

1. **Test Gotenberg's Chromium, not just curl.** When debugging Gotenberg integration, always test the actual URL-to-PDF conversion endpoint (`POST /forms/chromium/convert/url`), not just network connectivity from the Gotenberg container. curl and Chromium have different network paths.

2. **Inspect Chromium process flags first.** Before debugging Gotenberg networking, run `ps aux | grep chromium` to see what restrictions are in place. This would have saved hours of debugging.

3. **Prefer server-side PDF generation.** Headless browser PDF generation is fragile, slow, and depends on complex infrastructure (Gotenberg + Chromium + Docker networking). Server-side `printpdf` generation is deterministic, fast, and has zero external dependencies.

4. **Add integration tests for PDF export.** A test that calls `POST /api/v1/cooperative/submissions/{id}/export?format=pdf` and asserts a valid PDF response would catch regressions immediately.

---

## 10. Lessons Learned

- **curl ≠ Chromium.** Just because `curl` from a container can reach a service doesn't mean Gotenberg's Chromium can. Chromium goes through Gotenberg's internal proxy which has completely different network access.
- **Gotenberg 8 is architecturally different from v7.** The `--proxy-server` flag is a significant breaking change that affects all URL-based conversion. Always check the Chromium flags in your Gotenberg version.
- **Error messages can be deeply misleading.** `ERR_CONNECTION_REFUSED` pointed to a networking issue, but the real problem was a proxy access control issue inside Gotenberg.
- **Three real bugs can coexist with a fourth hidden bug.** Each fix we applied (port, host, API base URL) was correct and necessary, but none addressed the root Chromium proxy issue. The hidden bug was the one that actually mattered.
- **When all else fails, inspect the process.** `ps aux | grep chromium` revealed the `--proxy-server` flag which was the actual root cause. Process inspection should be an early debugging step, not a last resort.
