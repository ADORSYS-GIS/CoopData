# PDF Export Architecture — End-to-End Guide

> Last updated: 2026-07-28

This document covers the complete PDF export pipeline: how reports are triggered, generated, cached, served, and invalidated across all four organizational tiers (Cooperative, Apex, Federation, Ministry).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Organizational Tiers](#2-organizational-tiers)
3. [Export Trigger Flow](#3-export-trigger-flow)
4. [Pre-Bake Pipeline (Background Generation)](#4-pre-bake-pipeline-background-generation)
5. [On-Demand Export (User-Initiated Download)](#5-on-demand-export-user-initiated-download)
6. [Gotenberg Integration](#6-gotenberg-integration)
7. [Frontend Print Routes & Components](#7-frontend-print-routes--components)
8. [Authentication in Headless Chromium](#8-authentication-in-headless-chromium)
9. [Object Storage & Caching](#9-object-storage--caching)
10. [Cache Invalidation & Cascading Regeneration](#10-cache-invalidation--cascading-regeneration)
11. [Prior Year Data Staleness](#11-prior-year-data-staleness)
12. [Error Handling & Retry Logic](#12-error-handling--retry-logic)
13. [Concurrency Control](#13-concurrency-control)
14. [Key Files Reference](#14-key-files-reference)
15. [Infrastructure](#15-infrastructure)
16. [Known Limitations](#16-known-limitations)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Ministry Approval                           │
│                     submission.rs:1090 (handler)                    │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │                                  │
           ▼                                  ▼
   ┌───────────────┐                  ┌────────────────┐
   │ Compute KPIs  │                  │ Trigger 4x     │
   │ (on approval) │                  │ background     │
   └───────────────┘                  │ export tasks   │
                                      └───┬┬┬┬─────────┘
                                          ││││
                    ┌─────────────────────┘│││└──────────────────────┐
                    ▼                      ▼ ▼                       ▼
          ┌──────────────┐    ┌────────────┐ ┌────────────┐  ┌────────────┐
          │ Cooperative   │    │   Apex     │ │ Federation │  │  Ministry  │
          │ Export        │    │  Export    │ │   Export   │  │   Export   │
          │ (L10)         │    │  (L131)    │ │   (L198)   │  │   (L274)   │
          └──────┬───────┘    └─────┬──────┘ └─────┬──────┘  └─────┬──────┘
                 │                   │              │               │
                 ▼                   ▼              ▼               ▼
          ┌──────────────────────────────────────────────────────────────┐
          │          generate_pdf_via_gotenberg (L55)                    │
          │   ┌─────────────────────────────────────────────────────┐   │
          │   │  1. Acquire semaphore permit (max 2 concurrent)    │   │
          │   │  2. Build reqwest::Client (35s timeout)             │   │
          │   │  3. POST to Gotenberg /forms/chromium/convert/url   │   │
          │   │  4. Form fields: url, waitDelay=25s, A4, margins=0 │   │
          │   │  5. Retry up to 2x on 503 or PDF < 20KB            │   │
          │   │  6. Return PDF bytes                                │   │
          │   └─────────────────────────────────────────────────────┘   │
          └──────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
          ┌──────────────────────────────────────────────────────────────┐
          │              Object Storage (MinIO / Local FS)               │
          │                                                              │
          │  exports/individual/{sub_id}/submission_{sub_id}.pdf        │
          │  exports/apex/{apex_id}/apex_{apex_id}_{year}.pdf           │
          │  exports/federation/{fed_id}/federation_{fed_id}_{year}.pdf │
          │  exports/ministry/ministry_{year}.pdf                       │
          └──────────────────────────────────────────────────────────────┘
```

---

## 2. Organizational Tiers

The system has a 4-tier organizational hierarchy:

| Tier | Entity | Keycloak Role | Report Type | Print Route |
|------|--------|---------------|-------------|-------------|
| **Cooperative** | Individual SACCO | `cooperative` | Individual submission | `/print/cooperative/$id` |
| **Apex** | Apex (group of cooperatives) | `apex` | Consolidated | `/print/apex/$id` |
| **Federation** | Federation (group of apexes) | `federation` | Consolidated | `/print/federation/$id` |
| **Ministry** | National ministry | `ministry` | National overview | `/print/ministry` |

Each tier has its own:
- **Frontend print route** — React page rendered by Gotenberg
- **Frontend component** — Cooperative uses `CooperativeReportPrint`; Apex/Federation/Ministry use `ConsolidatedReportPrint` or `FederationReportPrint`
- **Backend trigger function** — Spawns a `tokio::spawn` background task
- **Storage path pattern** — Where the cached PDF lives in MinIO

---

## 3. Export Trigger Flow

### 3.1 When Exports Are Triggered

Exports are **only triggered at the Ministry approval stage** (`submission.rs:1090`). Earlier approval tiers (Apex approve, Federation approve) do NOT trigger exports.

```rust
// submission.rs:1125-1156 — ministry_approve_submission handler

// Phase A: Cooperative export
ExportGenerator::trigger_cooperative_export(state.clone(), submission_id);

// Phase C: Apex export (parent of the cooperative)
ExportGenerator::trigger_apex_export(state.clone(), coop.apex_id, reporting_year);

// Phase D: Federation export (parent of the apex)
ExportGenerator::trigger_federation_export(state.clone(), apex.federation_id, reporting_year);

// Phase E: Ministry export (national level)
ExportGenerator::trigger_ministry_export(state.clone(), reporting_year);
```

### 3.2 Approval Lifecycle

```
Cooperative Submit  →  Apex Review  →  Federation Review  →  Ministry Approve
  (Draft→Submitted)   (Submitted→InReview)  (InReview→InReview)  (InReview→Approved)
                                                                   ↑
                                                          EXPORTS TRIGGERED HERE
```

### 3.3 What Each Approval Tier Does

| Tier | Action | Handler | Line | Export Triggered? |
|------|--------|---------|------|-------------------|
| Cooperative | Submit | `submit_submission` | L426 | ❌ No |
| Apex | Approve | `apex_approve_submission` | L724 | ❌ No |
| Apex | Return | `apex_return_submission` | L761 | ❌ No |
| Federation | Approve | `federation_approve_submission` | L891 | ❌ No |
| Federation | Return | `federation_return_submission` | L930 | ❌ No |
| Ministry | Approve | `ministry_approve_submission` | L1090 | ✅ Yes — 4 background tasks |
| Ministry | Reject | `ministry_reject_submission` | L1233 | ❌ No |

---

## 4. Pre-Bake Pipeline (Background Generation)

### 4.1 Background Task Pattern

All four tiers use the same pattern — spawn a `tokio::spawn` task:

```rust
// export_generator.rs:10-30 — trigger_cooperative_export
pub fn trigger_cooperative_export(state: AppState, submission_id: Uuid) {
    tokio::spawn(async move {
        if let Err(e) = Self::generate_all_formats(&state, submission_id).await {
            tracing::error!(...);
        } else {
            tracing::info!(...);
        }
    });
}
```

### 4.2 Cooperative Pre-Bake

```rust
// export_generator.rs:33-38
async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
    let pdf_bytes = Self::generate_cooperative_pdf(state, submission_id).await?;
    let pdf_key = format!("exports/individual/{}/submission_{}.pdf", submission_id, submission_id);
    state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;
    Ok(())
}
```

The cooperative generates **PDF only** via Gotenberg. The Gotenberg URL:
```
{gotenberg_frontend_url}/print/cooperative/{submission_id}?token={admin_jwt}
```

### 4.3 Apex Pre-Bake

```rust
// export_generator.rs:154-167
async fn generate_apex_formats(state: &AppState, apex_id: Uuid, reporting_year: i32) -> AppResult<()> {
    let (apex, _coops) = Self::compile_apex_data(state, apex_id, reporting_year).await?;
    let token = state.keycloak.get_admin_token().await?;
    let print_url = format!(
        "{}/print/apex/{}?token={}&year={}",
        state.config.gotenberg_frontend_url, apex.keycloak_id, token, reporting_year
    );
    let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
    let pdf_key = format!("exports/apex/{}/apex_{}_{}.pdf", apex_id, apex_id, reporting_year);
    state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;
    Ok(())
}
```

Key difference: Apex uses the `keycloak_id` (not the DB UUID) in the print URL. The `compile_apex_data` function aggregates all cooperatives and their KPIs for validation but the actual data comes from the frontend API calls when Gotenberg renders the page.

### 4.4 Federation & Ministry Pre-Bake

Same pattern as Apex — `compile_federation_data` / `compile_ministry_data` aggregate data for validation, then Gotenberg renders the frontend page and produces the PDF.

---

## 5. On-Demand Export (User-Initiated Download)

Users can also download exports on-demand via the export panel. These follow a different code path.

### 5.1 Single Submission Export (Cooperative Tier)

```rust
// export.rs:40-85 — export_single_submission
// GET /api/v1/cooperative/submissions/{id}/export

// 1. Check RBAC — user must have access to this cooperative
let allowed_coops = resolve_caller_cooperative_ids(&state, &claims).await?;

// 2. Check MinIO cache
let storage_key = format!("exports/individual/{}/submission_{}.pdf", id, id);
match state.storage.get_object(&storage_key).await {
    Ok(b) => b,                                    // Cache HIT → serve immediately
    Err(_) => {                                    // Cache MISS → generate live
        let bytes = ExportGenerator::generate_cooperative_pdf(&state, id).await?;
        state.storage.store(&storage_key, &bytes, "application/pdf").await?;
        bytes
    }
};
```

### 5.2 Consolidated Export (Apex/Federation/Ministry)

```rust
// export.rs:100-229 — export_bulk_consolidated
// GET /api/v1/{tier}/export?reporting_year=YYYY

// 1. Auto-resolve apex_id/federation_id from caller's claims if not provided
// 2. RBAC filtering — scope cooperatives to caller's hierarchy
// 3. Check MinIO cache (tier-specific storage key)
// 4. Cache MISS → generate via Gotenberg → store in MinIO → serve
```

### 5.3 Storage Key Patterns

| Tier | Storage Key Pattern |
|------|-------------------|
| Cooperative | `exports/individual/{sub_id}/submission_{sub_id}.pdf` |
| Apex | `exports/apex/{apex_id}/apex_{apex_id}_{year}.pdf` |
| Federation | `exports/federation/{fed_id}/federation_{fed_id}_{year}.pdf` |
| Ministry | `exports/ministry/ministry_{year}.pdf` |

---

## 6. Gotenberg Integration

### 6.1 Overview

Gotenberg 7.9 is a Docker-based API for converting HTML to PDF using headless Chromium. The backend sends a URL to Gotenberg, which navigates to it, renders the React page, and returns a PDF.

### 6.2 Gotenberg Call

```rust
// export_generator.rs:55-128 — generate_pdf_via_gotenberg

let form = reqwest::multipart::Form::new()
    .text("url", print_url.to_string())
    .text("waitDelay", "25s")              // Wait 25s for page to fully render
    .text("paperWidth", "8.27")            // A4 width in inches
    .text("paperHeight", "11.69")          // A4 height in inches
    .text("marginTop", "0")
    .text("marginBottom", "0")
    .text("marginLeft", "0")
    .text("marginRight", "0")
    .text("printBackground", "true")       // Render background colors/images
    .text("emulateMediaType", "screen");   // Use screen CSS, not print

let response = client
    .post("http://gotenberg:3000/forms/chromium/convert/url")
    .multipart(form)
    .send()
    .await;
```

### 6.3 Why `waitDelay` Instead of `waitForExpression`

The initial implementation used `waitForExpression: "window.isReady === true"` to tell Gotenberg when the React page had finished loading. This was **unreliable in Gotenberg 7.9**:

- `window.isReady` is set by React during render, but Gotenberg's CDP (Chrome DevTools Protocol) expression evaluator sometimes cannot see synchronous mutations from the page's JavaScript context
- Even trivially true expressions like `waitForExpression=true` fail intermittently
- DOM content checks like `waitForExpression=document.body.innerText.includes('Executive Summary')` work from the host but fail from the backend container (different network context)

**Solution:** Use `waitDelay=25s` only. This gives the page enough time to load all data from the API and render completely. Testing showed pages take 8-17s to fully render depending on data volume.

### 6.4 Gotenberg Request Flow

```
Backend Container                     Gotenberg Container              Frontend Container
       │                                     │                              │
       │  POST /forms/chromium/convert/url   │                              │
       │  (multipart: url, waitDelay=25s)   │                              │
       ├────────────────────────────────────→│                              │
       │                                     │  Navigate to URL             │
       │                                     │  (e.g., /print/cooperative/  │
       │                                     │   {id}?token={jwt})          │
       │                                     ├─────────────────────────────→│
       │                                     │                              │  Vite serves React app
       │                                     │                              │  React hooks fetch API data
       │                                     │                              │  (via /api proxy → backend)
       │                                     │  ←── HTML + JS bundle        │
       │                                     │                              │
       │                                     │  Chromium renders page       │
       │                                     │  (waits 25s)                 │
       │                                     │                              │
       │  ←── PDF bytes                     │                              │
       │                                     │                              │
```

### 6.5 Retry Logic

```rust
// export_generator.rs:69-127
let max_retries = 2;

for attempt in 0..max_retries {
    match response {
        Ok(resp) if resp.status().is_success() => {
            let bytes = resp.bytes().await?;
            if bytes.len() < 20_000 {
                // PDF too small — likely captured a loading spinner
                // Retry after 5s delay
                continue;
            }
            return Ok(bytes.to_vec());
        }
        Ok(resp) if resp.status().as_u16() == 503 => {
            // Gotenberg process pool exhausted
            // Retry after 5s delay
            continue;
        }
        Ok(resp) => {
            // Other error — don't retry
            return Err(...);
        }
        Err(e) => {
            // Network error — retry
            continue;
        }
    }
}
```

**Retry triggers:**
- HTTP 503 (Gotenberg process pool exhausted)
- PDF < 20KB (page captured in loading/error state)
- Network errors

**No retry:**
- Other HTTP errors (4xx, 5xx other than 503)

---

## 7. Frontend Print Routes & Components

### 7.1 Route Definitions

| Route | File | Component | Data Hooks |
|-------|------|-----------|------------|
| `/print/cooperative/$id` | `print.cooperative.$id.tsx` | `CooperativeReportPrint` | `useSubmission`, `useCooperativeKpis`, `useSubmissionLineItems`, `usePortfolioBreakdown`, `useMembershipStats` |
| `/print/apex/$id` | `print.apex.$id.tsx` | `ConsolidatedReportPrint` | `useApex`, `useNationalOverview` (×2: current + prior year) |
| `/print/federation/$id` | `print.federation.$id.tsx` | `FederationReportPrint` | `useFederation`, `useNationalOverview` (×2) |
| `/print/ministry` | `print.ministry.tsx` | `FederationReportPrint` | `useNationalOverview` (×2) |

### 7.2 Cooperative Report Structure (6 Pages)

`CooperativeReportPrint.tsx` (81 lines) is a thin shell that assembles 6 page components:

```
┌─────────────────────────┐
│  ReportCoverPage         │  Dark gradient cover with cooperative name, year, submission code
├─────────────────────────┤
│  ReportExecutiveSummary  │  Financial Highlights table, Key Ratios with stoplight badges
├─────────────────────────┤
│  ReportNonFinancial      │  Membership pie chart, Data Columns Reference table
├─────────────────────────┤
│  ReportFinancialPosition │  Balance Sheet + Income Statement with YoY comparison
├─────────────────────────┤
│  ReportPortfolioQuality  │  Portfolio quality pie chart, classification table
├─────────────────────────┤
│  ReportBenchmarkComparison│  Quartile benchmark table (P25/P50/P75 vs National Avg)
└─────────────────────────┘
```

### 7.3 Consolidated Report Structure (4 Pages)

`ConsolidatedReportPrint.tsx` (65 lines) renders Apex/Federation/Ministry reports:

```
┌─────────────────────────────┐
│  ConsolidatedCoverPage       │  Tier label, entity name, year, cooperative counts
├─────────────────────────────┤
│  ConsolidatedDashboardSheet  │  KPI summary tables, comparison charts
├─────────────────────────────┤
│  ConsolidatedCoopDetailSheet │  Per-cooperative breakdown
├─────────────────────────────┤
│  ConsolidatedRiskWatchSheet  │  Portfolio quality, risk indicators
└─────────────────────────────┘
```

### 7.4 Component Files

All print components live in `frontend/src/pages/shared/print/components/`:

| Component | Purpose |
|-----------|---------|
| `ReportCoverPage.tsx` | Cooperative cover page |
| `ReportExecutiveSummary.tsx` | Financial highlights & key ratios |
| `ReportNonFinancial.tsx` | Membership & non-financial metrics |
| `ReportFinancialPosition.tsx` | Balance sheet & income statement |
| `ReportPortfolioQuality.tsx` | Portfolio quality pie chart & table |
| `ReportBenchmarkComparison.tsx` | Quartile benchmarks |
| `ConsolidatedCoverPage.tsx` | Apex/Federation/Ministry cover |
| `ConsolidatedDashboardSheet.tsx` | Dashboard KPI tables |
| `ConsolidatedCoopDetailSheet.tsx` | Per-cooperative detail |
| `ConsolidatedRiskWatchSheet.tsx` | Risk indicators |
| `FederationReportPrint.tsx` | Federation-specific layout |
| `types.ts` | Shared `ReportDataProps` interface |
| `utils.ts` | `findKpi`, `getLineItem`, `calculateYoY`, `formatCurrency` helpers |

---

## 8. Authentication in Headless Chromium

This is one of the trickiest parts of the architecture. When Gotenberg navigates to a print route, the headless Chromium has **no Keycloak session**. The page must authenticate API calls using a pre-obtained admin JWT.

### 8.1 The Token Flow

```
1. Backend calls state.keycloak.get_admin_token()
   → Keycloak returns a client_credentials JWT (service account)

2. Backend embeds token in Gotenberg URL:
   /print/cooperative/{id}?token={jwt}
   /print/apex/{keycloak_id}?token={jwt}&year={year}

3. Gotenberg navigates to URL → React app loads

4. Route component reads token from URL search params:
   const { token } = Route.useSearch();

5. Token is passed to each hook as tokenOverride:
   useCooperativeKpis(submissionId, token)
   useApex(id, token)
   useNationalOverview({...}, true, token)

6. Hook uses tokenOverride instead of interactive session:
   const token = tokenOverride || await getAccessToken();
   fetch(url, { headers: { Authorization: `Bearer ${token}` } })
```

### 8.2 Two API Routing Paths

The frontend has two different ways to call the backend API:

**Path A: `apiClient` (openapi-fetch)**

```typescript
// openapi-client/index.ts:22-24
if (window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")) {
  API_BASE_URL = "http://backend:3000";
}
```

Used by: `useSubmission`, `useCooperative`, `useApex`, `useFederation`

The `apiClient.use()` interceptor automatically reads the token from the URL:
```typescript
// openapi-client/index.ts:34-43
onRequest({ request }) {
  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get("token");
  const token = queryToken || await getAccessToken();
  request.headers.set("Authorization", `Bearer ${token}`);
}
```

**Path B: Raw `fetch()` with `BASE_URL`**

```typescript
// useCooperativeKpis.ts:61-64
let BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
if (window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")) {
  BASE_URL = "http://backend:3000";
}
```

Used by: `useCooperativeKpis`, `useSubmissionLineItems`, `usePortfolioBreakdown`, `useMembershipStats`

These hooks accept `tokenOverride` and construct the `Authorization` header manually.

### 8.3 Why Both Paths Exist

- `apiClient` is the standard path for interactive browser usage. The interceptor handles token refresh automatically.
- Raw `fetch()` with `tokenOverride` is used for Gotenberg context where there's no interactive Keycloak session. The admin JWT is embedded in the URL and must be forwarded explicitly.

### 8.4 The `tokenOverride` Pattern

```typescript
// useCooperativeKpis.ts:72-76
export const useCooperativeKpis = (submissionId: string | undefined, tokenOverride?: string) =>
  useQuery<SubmissionKpisResponse>({
    queryKey: ["coop-kpis", submissionId, tokenOverride],
    queryFn: async () => {
      const token = tokenOverride || await getAccessToken();
      // ...
    },
  });
```

In interactive mode: `tokenOverride` is undefined → `getAccessToken()` returns the user's session token.
In Gotenberg mode: `tokenOverride` is the admin JWT from the URL → used directly.

---

## 9. Object Storage & Caching

### 9.1 Storage Backend

The system supports two storage backends (configured via `STORAGE_TYPE` env var):

- **`local`** — Local filesystem at `STORAGE_PATH` (default for dev)
- **`s3`** — MinIO or S3-compatible object storage

Both implement the `ObjectStorage` trait:

```rust
#[async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn store(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<()>;
    async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>>;
    async fn delete(&self, key: &str) -> AppResult<()>;
}
```

### 9.2 Cache-Through Pattern

Both pre-bake and on-demand exports use the same cache-through pattern:

```
Request → Check MinIO → HIT? → Serve cached file
                      → MISS? → Generate via Gotenberg → Store in MinIO → Serve
```

### 9.3 Pre-Bake vs On-Demand

| Aspect | Pre-Bake (Background) | On-Demand (User Click) |
|--------|----------------------|----------------------|
| Trigger | Ministry approval handler | User clicks "Download PDF" |
| Code path | `export_generator.rs` → `tokio::spawn` | `export.rs` → handler function |
| Storage key computed by | `export_generator.rs` | `export.rs` |
| Same storage key? | ✅ Yes | ✅ Yes |
| Serving | On-demand handler finds cached file | Same handler |

---

## 10. Cache Invalidation & Cascading Regeneration

### 10.1 The Staleness Problem

When a cooperative submits reports for multiple years:

```
Year 2025: Approved  ← older year
Year 2026: Approved  ← current year
```

The 2026 PDF's "Prior Year" column shows 2025 data. But if 2025 was approved **after** 2026's PDF was generated, the 2026 PDF is stale — it was generated without 2025's final data in the prior-year columns.

### 10.2 Invalidation on Approval

```rust
// submission.rs:1158-1216 — Phase F

// Find all APPROVED submissions for the same cooperative with year > current year
let future_subs = state.submission_repo.find_by_cooperative(coop_id).await?
    .into_iter()
    .filter(|s| s.reporting_year > current_year && s.status == Approved)
    .collect();

for sub in future_subs {
    // 1. Delete stale cached files from object storage
    state.storage.delete_object(&pdf_key).await;
    state.storage.delete_object(&xlsx_key).await;
    state.storage.delete_object(&docx_key).await;

    // 2. Trigger background regeneration
    ExportGenerator::trigger_cooperative_export(state.clone(), sub.id);
    ExportGenerator::trigger_apex_export(state.clone(), coop.apex_id, sub.reporting_year);
    ExportGenerator::trigger_federation_export(state.clone(), apex.federation_id, sub.reporting_year);
    ExportGenerator::trigger_ministry_export(state.clone(), sub.reporting_year);
}
```

### 10.3 Cascading Regeneration Scenario

```
1. Year 2025 submission approved
   → Trigger: cooperative(2025), apex(2025), federation(2025), ministry(2025)
   → No future-year submissions → no cascading

2. Year 2026 submission approved
   → Trigger: cooperative(2026), apex(2026), federation(2026), ministry(2026)
   → Find future-year submissions: none → no cascading

3. Year 2025 approved AFTER year 2026
   → Trigger: cooperative(2025), apex(2025), federation(2025), ministry(2025)
   → Find future-year submissions: year 2026 (Approved)
   → Cascading:
     - Delete cooperative(2026) PDF
     - Delete apex(2026) PDF
     - Delete federation(2026) PDF
     - Delete ministry(2026) PDF
     - Re-generate all 4 for year 2026
```

### 10.4 Limitation: Ministry/Federation/Apex Scope

The current invalidation only operates on the **cooperative's** future-year submissions. It does NOT:
- Find future-year submissions for **other cooperatives** in the same apex
- Invalidate apex/federation/ministry exports for **other cooperatives'** future years

This is acceptable because:
- Ministry/Federation/Apex exports aggregate ALL cooperatives
- When any one cooperative's year Y data changes, the aggregate for year Y is stale
- But the current code only invalidates the **specific cooperative's** year Y+1 exports

---

## 11. Prior Year Data Staleness

### 11.1 How Prior Year Data Is Retrieved

When a PDF is generated, the KPI endpoint includes prior year data:

```rust
// financial_statement.rs:295-322
// When include_prior_year=true:
let prior_submission = financial_statement_repo
    .find_by_cooperative_and_year(coop_id, reporting_year - 1)
    .await?;

if let Some(prior) = prior_submission {
    let prior_kpis = compute_kpis(&prior, &line_items, &benchmarks)?;
    response.prior_year_kpis = Some(prior_kpis);
}
```

This runs at **generation time**, not at serve time. Once the PDF is cached, the prior year data is frozen.

### 11.2 The Timing Issue

```
Timeline:
  2026-01-15: Year 2025 submission approved → 2025 PDF generated
  2026-02-01: Year 2026 submission approved → 2026 PDF generated
              → Prior year lookup finds 2025 submission → includes 2025 KPIs ✅

  2026-03-01: Year 2025 data corrected (ministry re-approval)
              → 2025 PDF regenerated
              → Phase F: invalidates 2026 PDF → 2026 PDF regenerated with fresh 2025 data ✅
```

The cascading regeneration ensures that corrections to older years propagate to newer years' PDFs.

---

## 12. Error Handling & Retry Logic

### 12.1 PDF Size Validation

```rust
// export_generator.rs:96-100
if bytes.len() < 20_000 {
    // PDF is too small — likely captured a loading spinner or error page
    // Retry after 5s
    last_error = Some(format!("PDF too small ({} bytes)", bytes.len()));
    continue;
}
```

**Why 20KB?** A valid 6-page cooperative PDF is ~400KB. A PDF showing only a loading spinner is ~15-43KB. The 20KB threshold rejects these error-state PDFs.

### 12.2 Gotenberg 503 Handling

Gotenberg returns 503 when its Chromium process pool is exhausted. The retry with 5s backoff handles this.

### 12.3 On-Demand Fallback

If the pre-baked PDF is missing from MinIO (e.g., pre-bake failed), the on-demand handler generates it live:

```rust
// export.rs:64-74
match state.storage.get_object(&storage_key).await {
    Ok(b) => b,
    Err(_) => {
        let bytes = ExportGenerator::generate_cooperative_pdf(&state, id).await?;
        state.storage.store(&storage_key, &bytes, "application/pdf").await?;
        bytes
    }
};
```

### 12.4 Logging

All export operations use structured logging with `tracing`:

```
INFO  Starting background export generation submission_id=xxx
INFO  Generating PDF via Gotenberg with URL: http://frontend:80/print/cooperative/xxx?token=yyy
INFO  Successfully pre-baked all export formats submission_id=xxx
ERROR Failed to generate exports in the background submission_id=xxx error=...
WARN  Failed to cache live-generated export error=... key=...
```

---

## 13. Concurrency Control

### 13.1 Gotenberg Semaphore

Gotenberg 7.9 can handle ~1-2 concurrent Chromium instances. To prevent process pool exhaustion:

```rust
// main.rs:122
gotenberg_semaphore: Arc::new(Semaphore::new(2)),

// export_generator.rs:61-62
let _permit = state.gotenberg_semaphore.acquire().await
    .map_err(|_| AppError::InternalServerError("Gotenberg semaphore closed".into()))?;
```

When both permits are taken, new export requests wait until a permit is released.

### 13.2 Background Task Concurrency

The `tokio::spawn` calls for the 4 tiers happen concurrently. If the semaphore is at capacity, some tasks will wait. This is fine — they'll eventually get a permit.

---

## 14. Key Files Reference

### Backend

| File | Purpose | Key Functions |
|------|---------|---------------|
| `backend/src/services/export_generator.rs` (338L) | PDF generation orchestration | `trigger_cooperative_export`, `trigger_apex_export`, `trigger_federation_export`, `trigger_ministry_export`, `generate_pdf_via_gotenberg` |
| `backend/src/api/handlers/export.rs` (231L) | HTTP export endpoints | `export_single_submission`, `export_bulk_consolidated` |
| `backend/src/api/handlers/submission.rs` (1719L) | Approval handler with export triggers | `ministry_approve_submission` (L1090) |
| `backend/src/services/keycloak.rs` (2126L) | Admin JWT generation | `get_admin_token` (L120) |
| `backend/src/services/object_storage.rs` (227L) | Storage abstraction | `store`, `retrieve`, `delete` |
| `backend/src/config.rs` (185L) | Configuration | `gotenberg_frontend_url` |
| `backend/src/lib.rs` (100L) | AppState definition | `gotenberg_semaphore`, `storage`, `keycloak` |
| `backend/src/main.rs` (458L) | Application bootstrap | `Semaphore::new(2)` |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/routes/print.cooperative.$id.tsx` (13L) | Cooperative print route |
| `frontend/src/routes/print.apex.$id.tsx` (51L) | Apex print route |
| `frontend/src/routes/print.federation.$id.tsx` (52L) | Federation print route |
| `frontend/src/routes/print.ministry.tsx` (45L) | Ministry print route |
| `frontend/src/pages/shared/CooperativeReportPrint.tsx` (81L) | Cooperative report shell |
| `frontend/src/pages/shared/print/ConsolidatedReportPrint.tsx` (65L) | Apex/Federation/Ministry report shell |
| `frontend/src/pages/shared/print/components/` (18 files) | Individual page components |
| `frontend/src/hooks/submissions/useCooperativeKpis.ts` (150L) | Cooperative data hooks (raw fetch with tokenOverride) |
| `frontend/src/hooks/analytics/useNationalOverview.ts` (114L) | Consolidated data hook (apiClient with tokenOverride) |
| `frontend/src/openapi-client/index.ts` (61L) | apiClient with Gotenberg hostname detection |

---

## 15. Infrastructure

### 15.1 Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| `backend` | 3000 | Rust API server |
| `frontend` / `coopdata-frontend-dev` | 5173 | Vite dev server (React) |
| `gotenberg` | 8081 → 3000 | PDF generation (headless Chromium) |
| `keycloak` | 8180 | Identity provider |
| `postgres` | 5432 | Database |
| `redis` | 6379 | Cache |
| `minio` | 9000 | Object storage |

### 15.2 Network Routing

```
Gotenberg → http://coopdata-frontend-dev:5173/print/...
               ↓
            Vite dev server serves React app
               ↓
            React hooks call /api/* (Vite proxy → backend:3000)
               ↓ OR (for Gotenberg context)
            apiClient routes to http://backend:3000 directly
```

### 15.3 Environment Variables

```bash
# Backend
GOTENBERG_FRONTEND_URL=http://coopdata-frontend-dev:5173  # URL Gotenberg uses to reach frontend
FRONTEND_URL=http://localhost:5173                           # User-facing frontend URL
KEYCLOAK_URL=http://keycloak:8180
KEYCLOAK_CLIENT_ID=coopdata-backend
KEYCLOAK_CLIENT_SECRET=bXEH0vTeuidB52EeJ2QixCKFumD9gZ1y

# Frontend
VITE_API_BASE_URL=                                           # Empty = same origin (production)
```

---

## 16. Known Limitations

### 16.1 `waitForExpression` Unreliable in Gotenberg 7.9

- Gotenberg's CDP expression evaluator is unreliable for custom window properties set during React render
- DOM content checks work from the host but not from the backend container
- **Workaround:** Use `waitDelay=25s` only

### 16.2 Cache Has No TTL

- Once a PDF is cached in MinIO, it stays until explicitly deleted
- No automatic expiration or staleness detection
- **Workaround:** Cache invalidation on approval (Phase F) handles the known staleness scenario

### 16.3 `reqwest::Client` Not Reused

- A new `reqwest::Client` is built per `generate_pdf_via_gotenberg` call
- Each client creates a new connection pool
- **Impact:** Minor — low export frequency, connection pool overhead is negligible

### 16.4 Ministry Report Has Hardcoded Entity Name

- `print.ministry.tsx:37` uses `"Ministry of Commerce, Industry and Trade"` instead of reading from data
- **Impact:** Cosmetic only

### 16.5 ConsolidatedReportPrint Has Dead Code

- `ConsolidatedReportPrint.tsx:38` has `(window as any).isReady = true` which is dead code (backend uses `waitDelay`)
- Also violates AGENTS.md rule against `any` types
- **Impact:** None (dead code), but should be cleaned up

### 16.6 Keycloak Groups Missing for Apex/Federation

- Apex and Federation entities may not have corresponding Keycloak groups
- `useApex(id)` and `useFederation(id)` return 502 when the Keycloak group doesn't exist
- The print routes handle this gracefully by using fallback names (`apex?.name ?? "Apex"`)
- **Impact:** Entity names show as "Apex"/"Federation" instead of actual names

### 16.7 Single Cooperative Limitation

- With only 1 cooperative in the system, Apex/Federation/Ministry reports show the same data
- This is a test data limitation, not a code bug
