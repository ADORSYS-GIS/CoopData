# Sprint 4 — Epic 4: Analytics, Benchmarking & Dashboards

> **Source of truth**: `docs/architecture/architecture.md` §8 (KPI Materialization), §9 (Abnormality Flagging), `frontend/src/lib/kpi-calculations.ts`, `frontend/src/pages/shared/AnalyticsPage.tsx`
> **Status**: Ready for implementation
> **Date**: 2026-07-14

---

## What's Already Built (Do Not Rebuild)

### Frontend — Fully Implemented
| Component | Status |
|-----------|--------|
| `AnalyticsPage.tsx` — role-aware dashboards (ministry/federation/apex/cooperative) with filter UI, charts, date-range picker, all using mock data | ✅ UI done, needs real data |
| `kpi-calculations.ts` — full KPI calculation library (financial, membership, savings, loan, fixed deposit KPIs) | ✅ Logic done |
| `ReportsPage.tsx` — report category cards, recent reports list, export panel UI | ✅ UI done, needs real export |
| `report-export-panel.tsx` — export format selector UI | ✅ UI done |
| `DashboardPage.tsx` — role-specific summary dashboards | ✅ UI done, needs real data |
| Dashboard components per role | ✅ UI done, needs real data |

### Backend — Partially Implemented
| Component | Status |
|-----------|--------|
| DB schema: `computed_kpis`, `benchmark_data` tables | ✅ Schema exists |
| Abnormality detector service | ✅ Complete |
| All financial data repositories | ✅ Complete |
| Non-financial data (members, savings, loans, fixed deposits) handlers | ✅ Complete |

### What's Missing (Sprint 4 Scope)
1. **Backend KPI engine** — no `GET /api/v1/cooperative/kpis` endpoint exists yet. The `computed_kpis` table exists but nothing writes to it or reads from it.
2. **Backend benchmark data** — no `GET /api/v1/benchmarks` endpoint.
3. **Frontend analytics wired to real data** — all charts in `AnalyticsPage.tsx` use `@/lib/mock-data`. Need to replace with real API hooks.
4. **Role-specific dashboards wired to real data** — `DashboardPage.tsx` and role dashboards use mock data.
5. **Report export** — the export panel has no real download logic.
6. **Peer benchmarking insight panel** — automated insights like "Your liquidity ratio is below sector average" don't exist.

---

## Architecture Decision: Where KPIs Are Computed

KPIs are computed **on-demand** (not pre-materialized as a batch job) for this sprint, because:
- We don't have a job scheduler yet
- The `kpi-calculations.ts` frontend library already has all formulas
- The backend can compute them from `balance_sheet_line_items` at query time

For Sprint 5, we can add a nightly materialization job to `computed_kpis`. For now, a `GET /api/v1/cooperative/submissions/{id}/kpis` endpoint computes and returns them live.

---

## Tickets

---

### S4-T1 — Backend: KPI Computation Endpoint

**Epic**: US4.2 — Automated KPI & Financial Ratio Generation
**Estimated effort**: 1.5 days
**Dependencies**: None (all data already in DB)
**Can be done in parallel with**: S4-T2, S4-T3, S4-T4

#### Context

Given an `approved` or `submitted` submission with line items in `balance_sheet_line_items`, the backend needs to compute the ~25 financial KPIs (PAR30, ROA, ROE, Capital Adequacy, etc.) defined in `docs/architecture/architecture.md §8` and `kpi-calculations.ts`.

The computation logic mirrors `kpi-calculations.ts` — port it to Rust.

#### Implementation Plan

**New service**: `backend/src/services/kpi_engine.rs`

Reads line items for a financial statement and computes KPIs from account codes:

```rust
pub struct KpiEngine;

impl KpiEngine {
    /// Compute all financial KPIs from balance sheet line items.
    pub fn compute(line_items: &[BalanceSheetLineItemModel]) -> ComputedKpiSet { ... }
}
```

Account code mapping (from `financial-data.ts` and `docs/architecture/architecture.md`):
- `1101-1104` → liquid assets
- `1201-1205` → gross loan portfolio
- `1251-1252` → loan loss provisions
- `1301-1305` → other assets
- `1999` → total assets
- `2101-2103` → member deposits
- `2201-2202` → borrowings
- `2301-2303` → other liabilities
- `2999` → total liabilities
- `3101-3102` → member shares
- `3201-3203` → reserves
- `3301-3302` → retained earnings
- `3999` → total equity
- `4101-4102, 4201` → income
- `5101-5102, 5201-5204, 5301` → expenses
- `6999` → net surplus

**KPIs to compute** (match `kpi-calculations.ts` exactly):

| KPI | Formula |
|-----|---------|
| Total Assets | code 1999 |
| Gross Loan Portfolio | sum(1201..1205) |
| Net Loan Portfolio | GLP - sum(1251-1252) |
| Total Member Deposits | sum(2101..2103) |
| Total Equity | code 3999 |
| PAR30 | (1202+1203+1204+1205) / GLP * 100 |
| PAR90 / NPL Ratio | 1205 / GLP * 100 |
| Loan Loss Coverage | sum(1251-1252) / (1202+1203+1204+1205) * 100 |
| ROA | net_surplus / total_assets * 100 |
| ROE | net_surplus / total_equity * 100 |
| Operating Expense Ratio | sum(5201-5204) / total_assets * 100 |
| Capital Adequacy Ratio | total_equity / total_assets * 100 |
| Liquid Funds Ratio | sum(1101-1104) / total_assets * 100 |
| Operational Self-Sufficiency | total_income / total_expenses * 100 |
| Net Interest Margin | (income_financial - expenses_financial) / total_assets * 100 |
| Deposits to Loans | total_deposits / GLP * 100 |

**New DTO**: `backend/src/api/dto/financial.rs` — add:
```rust
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct KpiResponse {
    pub name: String,
    pub value: f64,
    pub formatted: String,
    pub unit: String,  // "percent" | "currency" | "ratio"
    pub status: Option<String>,  // "green" | "amber" | "red"
    pub benchmark: Option<f64>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionKpisResponse {
    pub submission_id: Uuid,
    pub reporting_year: i32,
    pub computed_at: DateTime<Utc>,
    pub kpis: Vec<KpiResponse>,
}
```

**New handler** in `backend/src/api/handlers/financial_statement.rs`:
```
GET /api/v1/cooperative/submissions/{id}/kpis
```
- Load `financial_statement` for the submission
- Load all `balance_sheet_line_items` for the fs
- Call `KpiEngine::compute(&items)`
- Return `SubmissionKpisResponse`
- Auth: cooperative role, scope-checked to caller's cooperative

Wire to `routes/cooperative.rs`. Register in `openapi.rs`.

**Optional**: also expose `GET /api/v1/apex/submissions/{id}/kpis` (same logic, no scope restriction beyond apex ownership).

#### Expected Result
- Any approved or submitted cooperative submission can return computed KPIs.
- The 16 core financial KPIs are computed from real balance sheet line items.
- Status thresholds (green/amber/red) match the benchmarks in `kpi-calculations.ts`.

---

### S4-T2 — Backend: Benchmark Data Endpoint

**Epic**: US4.3 — Peer & National Benchmarking Engine
**Estimated effort**: 1 day
**Dependencies**: S4-T1 (needs KPIs to exist before we can aggregate benchmarks)
**Can be done in parallel with**: S4-T3, S4-T4

#### Context

The `benchmark_data` table exists in the schema. We need:
1. A way to compute and store sector/regional averages from all approved submissions
2. A read endpoint to retrieve benchmark comparisons

For Sprint 4, we compute benchmarks **on the fly** by averaging KPIs across all approved submissions in the same sector or region.

#### Implementation Plan

**New repository method** in `backend/src/repositories/financial_statement.rs`:
```rust
/// Find all approved submissions' financial statement IDs for a given cooperative type / region.
pub async fn find_approved_by_coop_type(&self, coop_type: &str) -> AppResult<Vec<Model>> { ... }
```

**New handler** in `backend/src/api/handlers/financial_statement.rs`:
```
GET /api/v1/benchmarks?kpi_name=par30&cooperative_type=sacco&reporting_year=2025
```

Logic:
1. Query all `cooperatives` of the given `cooperative_type`
2. For each, find their latest `approved` submission for `reporting_year`
3. Load their `balance_sheet_line_items`
4. Compute the requested KPI via `KpiEngine::compute()` for each coop
5. Return: `{ kpi_name, sector_average, national_average, percentile_50, percentile_25, percentile_75, sample_count }`

**New DTO**:
```rust
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BenchmarkResponse {
    pub kpi_name: String,
    pub cooperative_type: Option<String>,
    pub reporting_year: i32,
    pub sector_average: f64,
    pub national_average: f64,
    pub percentile_25: f64,
    pub percentile_50: f64,
    pub percentile_75: f64,
    pub sample_count: usize,
}
```

Wire to `routes/shared.rs` (accessible by all authenticated users). Register in `openapi.rs`.

**Performance note**: Cache the result in Redis with key `benchmark:{kpi_name}:{coop_type}:{year}` and TTL 1 hour. Use the existing `CacheService`.

#### Expected Result
- Any user can query national/sector benchmark averages for any KPI.
- Cooperative users can compare their own PAR30/ROA/CAR against sector peers.
- Results are cached so the on-demand aggregation doesn't hit the DB on every request.

---

### S4-T3 — Frontend: Wire Analytics Page to Real API Data

**Epic**: US4.1 — Level-Specific Custom Dashboards & US4.2 — KPI Generation
**Estimated effort**: 2 days
**Dependencies**: S4-T1, S4-T2
**Can be done in parallel with**: S4-T4

#### Context

`AnalyticsPage.tsx` (2995 lines) uses `@/lib/mock-data` everywhere. Every chart, every KPI card, every filter result is hardcoded. The page architecture is excellent — it just needs real data.

Strategy: **replace the data source, keep the visualization**. Don't rewrite the charts. Just replace `GROWTH_TREND`, `SECTOR_BREAKDOWN`, `baseLoanPortfolio`, etc. with API-sourced data.

#### Implementation Plan

**New hooks** in `frontend/src/hooks/submissions/`:

**`useCooperativeKpis.ts`**:
```typescript
export const useCooperativeKpis = (submissionId: string | undefined) =>
  useQuery({
    queryKey: ["coop-kpis", submissionId],
    queryFn: () => apiClient.GET("/api/v1/cooperative/submissions/{id}/kpis", {
      params: { path: { id: submissionId! } },
    }),
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
  });
```

**`useBenchmarks.ts`** (new file `frontend/src/hooks/useBenchmarks.ts`):
```typescript
export const useBenchmarks = (params: {
  kpiName: string;
  cooperativeType?: string;
  reportingYear?: number;
}) =>
  useQuery({
    queryKey: ["benchmarks", params],
    queryFn: () => apiClient.GET("/api/v1/benchmarks", { params: { query: params } }),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
```

**`useApexStats.ts`** — the analytics page for apex needs aggregated data. A new endpoint `GET /api/v1/apex/stats` that returns:
- Total cooperatives under apex
- Submission rates (submitted vs total)
- Average KPIs across cooperatives (PAR30, ROA, CAR)

**Implementation for `AnalyticsPage.tsx`**:

For the **cooperative role** (simplest case — own data):
1. Replace `coopPerformanceMetrics` array with data from `useCooperativeKpis(latestSubmissionId)`
2. Replace `kpiMetricsByRole.cooperative` stat cards with real KPI values
3. Keep all chart data for trend charts — populate from `balance_sheet_line_items` via a new `useMonthlyTrend(fsId)` hook that returns `{ month, value }[]` per account category

For the **apex / federation / ministry roles** (aggregated data):
1. Replace stat cards from `kpiMetricsByRole` with data from the new apex/federation stats endpoints
2. Replace `filteredRegionCompliance` with real compliance rates from submissions
3. The filter functionality (federation/apex/cooperative/region/sector dropdowns) should filter server-side: pass selected IDs as query params to the stats endpoint

**Graceful degradation**: If the API is not yet returning aggregated stats for a given tier, fall back to the existing mock data with a `DEV_MODE` flag. This lets the frontend ship before the backend aggregation is ready.

**Hook for monthly trend** in `useFinancialStatement.ts`:
```typescript
export const useMonthlyTrend = (financialStatementId: string | undefined) =>
  useQuery({
    queryKey: ["monthly-trend", financialStatementId],
    queryFn: async () => {
      const items = await apiClient.GET(
        "/api/v1/cooperative/financial-statements/{id}/line-items",
        { params: { path: { id: financialStatementId! } } }
      );
      // Group by month, sum assets/liabilities/equity
      return groupLineItemsByMonth(items.data ?? []);
    },
    enabled: !!financialStatementId,
  });
```

#### Expected Result
- Cooperative role: all KPI cards show real computed values from their latest approved submission.
- Cooperative role: the 12-month trend chart shows real month-by-month balance sheet data.
- Cooperative role: comparison against sector benchmarks shows the real average.
- Higher roles: KPI aggregation via new stats endpoints replaces mock multiplier math.
- The filter UI (federation/apex/cooperative/region) passes params to the API instead of doing client-side multiplication.

---

### S4-T4 — Frontend: Peer Benchmarking Insight Panel

**Epic**: US4.3 — Peer & National Benchmarking Engine
**Estimated effort**: 1 day
**Dependencies**: S4-T1, S4-T2
**Can be done in parallel with**: S4-T3

#### Context

US4.3 requires automated insights like: _"Your liquidity ratio is 12.1%, which is below the sector average of 15.3% for SACCOs."_

These insights don't exist anywhere in the codebase. They need to be:
1. Computed from the KPI data + benchmark data
2. Rendered as a scannable insight panel with actionable language

This is **frontend-only** work using data from S4-T1 and S4-T2.

#### Implementation Plan

**New component**: `frontend/src/components/analytics/BenchmarkInsightPanel.tsx`

The component takes:
```typescript
interface Props {
  kpis: KpiResponse[];          // from useCooperativeKpis
  benchmarks: BenchmarkResponse[]; // from useBenchmarks
  cooperativeType: string;
}
```

**Insight generation logic** (pure TypeScript, no AI):
```typescript
function generateInsights(kpis: KpiResponse[], benchmarks: BenchmarkResponse[]): Insight[] {
  return kpis.flatMap((kpi) => {
    const bench = benchmarks.find(b => b.kpi_name === kpi.name);
    if (!bench) return [];

    const diff = kpi.value - bench.sector_average;
    const pct = Math.abs(diff / bench.sector_average * 100);

    if (pct < 5) return []; // within 5% — not noteworthy

    const direction = diff > 0 ? "above" : "below";
    const severity: "positive" | "warning" | "critical" =
      kpi.unit === "percent" && isLowerBetter(kpi.name)
        ? diff < 0 ? "positive" : pct > 20 ? "critical" : "warning"
        : diff > 0 ? "positive" : pct > 20 ? "critical" : "warning";

    return [{
      kpiName: kpi.name,
      message: `Your ${kpi.name} is ${kpi.formatted}, which is ${pct.toFixed(1)}% ${direction} the sector average of ${formatBenchmark(bench.sector_average, kpi.unit)}.`,
      severity,
      suggestion: getSuggestion(kpi.name, direction),
    }];
  });
}
```

**Insight suggestions** (hardcoded rules — not AI):
| KPI | Below average suggestion | Above average suggestion |
|-----|--------------------------|--------------------------|
| PAR30 | "Consider strengthening your loan recovery processes." | "Strong portfolio quality — your delinquency rate is well managed." |
| Capital Adequacy | "Your capital buffer is thin. Consider retaining more surplus." | "Well-capitalized — good buffer against unexpected losses." |
| Liquid Funds | "Low liquidity may affect your ability to meet member withdrawals." | "Strong liquidity position." |
| ROA | "Review operating costs or loan pricing to improve returns." | "Above-average profitability." |

**UI Render**:
- Render as a scrollable card titled "Performance Insights"
- Each insight: an icon (TrendingUp / TrendingDown / AlertTriangle), the message text, and a small comparison bar showing their value vs the benchmark value
- Color coded: green for positive, yellow for warning, red for critical
- Collapsed by default on mobile (show 3, "See all N insights" expander)

**Placement** in `AnalyticsPage.tsx`: Insert `BenchmarkInsightPanel` between the KPI stat cards and the charts, visible only for the `cooperative` role (their insights are specific; higher roles see aggregated views).

#### Expected Result
- A cooperative user immediately sees whether their KPIs are above or below sector average.
- Automated language explains the gap without manual work.
- Color severity makes it instantly scannable.
- No AI needed — pure rule-based comparison logic.

---

### S4-T5 — Backend + Frontend: Multi-Format Report Export

**Epic**: US4.4 — Multi-Format Report Exporting
**Estimated effort**: 1.5 days
**Dependencies**: S4-T1 (KPIs needed for report content)
**Can be done in parallel with**: S4-T3, S4-T4

#### Context

`ReportsPage.tsx` has a beautiful export panel UI but zero real functionality. `report-export-panel.tsx` has a format selector with PDF/Excel/Word. The backend has no export endpoints. Reports need to contain:
- Summary KPIs (from S4-T1)
- Balance sheet line items (from the financial statement)
- Non-financial summary (from members/savings/loans)

For Sprint 4, we implement **Excel (XLSX) and CSV export** on the backend, which covers the most critical audit and distribution use case. PDF and Word can be Sprint 5.

#### Implementation Plan

**Backend — new export handler** in `backend/src/api/handlers/financial_statement.rs`:

```
GET /api/v1/cooperative/submissions/{id}/export?format=xlsx
GET /api/v1/cooperative/submissions/{id}/export?format=csv
GET /api/v1/apex/submissions/{id}/export?format=xlsx   (for reviewers)
```

Add crate `rust_xlsxwriter = "0.79"` to `backend/Cargo.toml` (pinned exact version).

**XLSX export structure** (two sheets):
- Sheet 1: "Balance Sheet" — account code, account name, category, month, value, ai_confidence
- Sheet 2: "KPIs" — kpi name, value, formatted, unit, benchmark, status

```rust
pub async fn export_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(params): Query<ExportParams>,
) -> AppResult<impl IntoResponse> {
    // ... build xlsx using rust_xlsxwriter ...
    // Return as Content-Disposition: attachment; filename="submission-{ref}.xlsx"
    // Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
}
```

**CSV export** — simpler: serialize line items as CSV rows with the `csv` crate.

**Frontend — wire the export panel**:

File: `frontend/src/components/reports/report-export-panel.tsx`

Replace the stub download buttons with real calls:
```typescript
const handleExport = async (format: "xlsx" | "csv") => {
  const url = `/api/v1/cooperative/submissions/${submissionId}/export?format=${format}`;
  const token = await authService.getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `submission-${submissionId}.${format}`;
  a.click();
};
```

Add `submissionId` prop to `ReportExportPanel` — passed from `ReportsPage.tsx` using the latest approved submission from `useSubmissions()`.

**Ministry/Federation/Apex multi-coop export**:

An additional endpoint for higher-tier bulk exports:
```
GET /api/v1/ministry/export?format=xlsx&reporting_year=2025
GET /api/v1/apex/export?format=xlsx&reporting_year=2025
```

Returns a multi-sheet workbook: one sheet per cooperative, each with their KPIs.

Wire to `ReportsPage.tsx` "Generate Report" button for ministry/federation/apex roles.

#### Expected Result
- Cooperative user can download their financial statement as Excel or CSV in one click.
- The download contains all balance sheet line items + computed KPIs.
- Ministry/Apex can download a consolidated multi-cooperative workbook for audit.
- The existing `report-export-panel.tsx` UI works end-to-end without change.

---

### S4-T6 — Frontend: Wire Dashboard Pages to Real API Data

**Epic**: US4.1 — Level-Specific Custom Dashboards
**Estimated effort**: 1.5 days
**Dependencies**: S4-T1 (KPIs for cooperative dashboard)
**Can be done in parallel with**: S4-T3, S4-T4, S4-T5

#### Context

`DashboardPage.tsx` and the four role-specific dashboard components (`cooperative-dashboard.tsx`, `apex-dashboard.tsx`, `federation-dashboard.tsx`, `ministry-dashboard.tsx`) all use mock data from `@/lib/mock-data`. The role dashboards are the first thing users see after login — they must show real numbers.

#### Implementation Plan

**Hook additions** in `frontend/src/hooks/submissions/`:

**`useCooperativeDashboardStats.ts`** (new file):
```typescript
export const useCooperativeDashboardStats = () => {
  const { data: submissions } = useSubmissions();
  const latestApproved = submissions?.find(s =>
    s.status === "approved" || s.status === "submitted"
  );

  const { data: kpis } = useCooperativeKpis(latestApproved?.id);
  const { data: sections } = useQuery({ ... }); // submission sections completion

  return {
    latestSubmission: latestApproved,
    kpis: kpis?.kpis ?? [],
    pendingSections: /* count incomplete sections */,
    lastSubmittedAt: latestApproved?.submitted_at,
  };
};
```

**Cooperative dashboard** (`cooperative-dashboard.tsx`):
- Replace all hardcoded numbers with data from `useCooperativeDashboardStats`
- KPI cards: real PAR30, ROA, CAR, Net Surplus from the KPI engine
- "Pending actions" widget: count of incomplete submission sections
- "Recent submissions" list: from `useSubmissions()` (already wired in some places)

**Apex dashboard** (`apex-dashboard.tsx`):
- Add `GET /api/v1/apex/stats` endpoint (backend task, 0.5 day):
  Returns: `{ cooperative_count, submitted_count, pending_review_count, average_par30, average_car }`
- Wire to an `useApexStats` hook
- Replace mock stat cards with real data

**Federation/Ministry dashboards**:
- Add `GET /api/v1/federation/stats` and `GET /api/v1/ministry/stats` similarly
- These are simple COUNT queries on the submissions and cooperatives tables scoped by role
- Wire to `useFederationStats` / `useMinistryStats` hooks

**Backend — add stats endpoints** (one handler per role):
```
GET /api/v1/apex/stats
GET /api/v1/federation/stats
GET /api/v1/ministry/stats
```

Each returns:
```rust
#[derive(Serialize, ToSchema)]
pub struct ApexStatsResponse {
    pub cooperative_count: i64,
    pub submission_count: i64,
    pub pending_review_count: i64,
    pub approved_count: i64,
    pub average_par30: Option<f64>,
    pub average_car: Option<f64>,
}
```

These handlers already have a stub (`ApexStatsResponse` exists in `dto/apex.rs`) — just wire the real DB queries.

#### Expected Result
- Cooperative users see their real KPIs on the dashboard immediately after login.
- Apex/Federation/Ministry users see real submission counts and compliance rates.
- The "pending" numbers in the dashboard match what's actually in the DB.
- Loading states (skeletons) are shown while data fetches.

---

## Sprint 4 Ticket Summary

| Ticket | User Story | Layer | Effort | Parallel With |
|--------|-----------|-------|--------|---------------|
| S4-T1 | US4.2 — Backend KPI computation endpoint | Backend | 1.5 days | S4-T2, S4-T3, S4-T4 |
| S4-T2 | US4.3 — Backend benchmark aggregation endpoint | Backend | 1 day | S4-T1, S4-T3 |
| S4-T3 | US4.1/4.2 — Wire analytics page to real data | Frontend | 2 days | S4-T4, S4-T5 |
| S4-T4 | US4.3 — Peer benchmarking insight panel | Frontend | 1 day | S4-T3, S4-T5 |
| S4-T5 | US4.4 — Multi-format report export (XLSX + CSV) | Full-stack | 1.5 days | S4-T3, S4-T4 |
| S4-T6 | US4.1 — Wire role dashboards to real data | Full-stack | 1.5 days | S4-T3 |

**Total estimated**: ~8.5 days. With two developers working in parallel:
- Developer A (backend-first): S4-T1 → S4-T2 → S4-T5 backend → S4-T6 backend
- Developer B (frontend-first): S4-T3 → S4-T4 → S4-T5 frontend → S4-T6 frontend

**Critical path**: S4-T1 (backend KPIs) must finish before S4-T3 and S4-T4 can use real data. S4-T2 (benchmarks) must finish before S4-T4 (insights panel). Everything else is independent.

---

## OpenAPI Client Regeneration

After completing all backend tickets in both sprints, run:
```bash
cd backend && cargo run --bin export-openapi-spec
cd frontend && npm run update-client
```

This regenerates `frontend/src/openapi-client/api.d.ts` with all new endpoints and types, and the frontend hooks will automatically pick up the correct TypeScript types.
