# Basic Benchmarking Implementation — Questionnaire-Based Cooperatives

> **Status**: Implemented ✅
> **Ticket**: [#76](https://github.com/ADORSYS-GIS/CoopData/issues/76) — Implement "Basic Benchmarking" Sidebar Tab for Questionnaire-Based Cooperatives
> **Branch**: `basicBenchmark`
> **Scope**: Give less-digitized cooperatives (questionnaire tier) a dedicated benchmarking view against National / Regional / Sector averages — with the exact same premium UI as the standard Benchmarking tab and the same privacy guarantees.
> **Companion doc**: `docs/benchmarkdesign.md` documents ticket #75 (the standard benchmarking endpoint + role-aware widget this feature builds on).

---

## 1. The Problem (Ticket #76 Context)

### 1.1 Background & Missing Capability

Currently, the platform segments cooperative analytics into two tracks:
1. **Standard Analytics** — for digitized cooperatives submitting comprehensive financial statements (`financial_statements`, KPI records).
2. **Basic Analytics** — for less digitized cooperatives submitting data via dynamic questionnaires (`questionnaire_responses.answers`).

While the standard analytics suite includes a robust **Benchmarking** sidebar tab (allowing coops to compare their KPIs against regional, national, and sector averages, introduced in Ticket #75), this capability was entirely missing for the less digitalized cooperatives in the Basic tier. 

To ensure equitable access to insights across all tiers, we needed to introduce a dedicated benchmarking view tailored exclusively to the metrics captured in the questionnaire forms.

### 1.2 User Story

> **As a** manager of a less digitalized cooperative,
> **I want** to access a dedicated "Basic Benchmarking" tab in the main sidebar,
> **So that** I can compare my questionnaire-based data against national, regional, and sector averages to identify areas for growth without needing to submit complex financial statements.

### 1.2 The constraints (why this was not a copy-paste job)

Any new questionnaire benchmarking view had to satisfy the same invariants as ticket #75:

| Invariant | Meaning |
|---|---|
| **Privacy** | A cooperative user must **never** receive another cooperative's raw rows. |
| **Correctness** | Averages must be computed over the **full population** — scoping the data to the caller's own row makes the "average" equal to their own score (meaningless). |
| **Min-contributor guard** | Averages over fewer than 3 cooperatives-with-data leak individual data and must be withheld (`null` + `insufficient_data` flag). |
| **UX parity** | The UI must exactly mirror the standard Benchmarking tab: Card container, three-column control panel (`SearchableCombobox` × 3), same Recharts bar chart, same colors (`#3b82f6` coop / `#10b981` target), same emoji iconography (🌍 📍 🏭), same empty states. |

**Resolution principle (inherited from #75):** *Averages are computed server-side over the full population; only aggregate numbers cross the wire. The client never receives another cooperative's raw rows.*

---

## 2. What Was Implemented — Backend

### 2.1 New endpoint — `GET /api/v1/analytics/basic-benchmark`

`backend/src/api/handlers/basic_benchmark.rs` — a dedicated, role-aware endpoint for questionnaire benchmarking.

**Caller resolution & role split:**

```rust
let caller_coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
let is_coop_caller =
    !claims.has_role("ministry") && !claims.has_role("federation") && !claims.has_role("apex");
```

- **Cooperative callers** receive only their **own row** (`cooperative`) plus server-computed **national / regional / sector / sector+regional averages**. The `rows` field is always empty for them — a **structural** privacy guarantee (the same pattern as `GET /analytics/benchmark`).
- **Admin callers** (ministry / federation / apex) receive the full `rows` for their authorized scope plus an informational national average, because they are authorized to see the raw data.

**"No data" is not an error:** a cooperative caller without an approved/submitted questionnaire for the year gets **`200 OK` with `cooperative: null`** — previously this surfaced as a `404 {"error":"not_found"}`, which is wrong: a pending/rejected/never-started submission is a legitimate state the UI should render as an empty state, not a failure. The 404 was removed from the OpenAPI contract. *(The standard benchmark endpoint had the same bug and was fixed identically — see §5.)*

### 2.2 DTOs — `backend/src/api/dto/basic_benchmark.rs`

```rust
pub struct BasicBenchmarkRow {
    pub cooperative_id: Uuid,
    pub name: String,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub has_data: bool,
    pub metrics: HashMap<String, f64>,   // questionnaire metric key → value
}

pub struct BasicBenchmarkResponse {
    pub reporting_year: Option<i32>,
    pub cooperative: Option<BasicBenchmarkRow>,  // own row (coop callers); None for admins / no data
    pub rows: Vec<BasicBenchmarkRow>,            // full scope (admin callers); always empty for coop callers
    pub national_average: Option<HashMap<String, f64>>,
    pub regional_average: Option<HashMap<String, f64>>,
    pub sector_average: Option<HashMap<String, f64>>,
    pub sector_regional_average: Option<HashMap<String, f64>>,
    pub insufficient_data: BasicBenchmarkInsufficientData,
}

pub struct BasicBenchmarkInsufficientData { national, regional, sector, sector_regional: bool }
```

### 2.3 The 15 questionnaire benchmark metrics

The benchmarked metrics mirror the fields extracted from `questionnaire_responses.answers` by `get_questionnaire_analytics`:

| Group | Metrics |
|---|---|
| **Membership** | `total_registered_members`, `total_active_members`, `total_members_male`, `total_members_female`, `members_age_18_25`, `members_age_26_35`, `members_age_36_60`, `members_age_61plus` |
| **Financial balances** | `total_share_capital`, `total_borrowed_funds`, `total_savings_value`, `total_loans_outstanding` |
| **Income** | `total_income`, `total_expenditure`, `total_net_income` |

**Row construction** (`build_questionnaire_rows`): all of a cooperative's questionnaire responses (a coop may have both a `financial` and a `non_financial` questionnaire against the same submission) are fetched for the full population via `find_responses_with_filters` (which applies the Approved/Submitted status filter) and **merged per cooperative** — a key present in multiple responses keeps the first non-zero value.

**`has_data` is presence-based, not value-based** (`has_benchmark_metrics`): a cooperative that submitted a questionnaire with **all-zero values still counts** as having data. The presence of any of the 43 benchmarkable answer keys (all documented aliases, kept in sync with `metrics_from_answers`) in the merged answers determines it. This fixes a subtle gap where a legitimately-zero submission was wrongly treated as "no data".

### 2.4 Shared averaging engine — `backend/src/services/benchmark.rs`

The averaging logic is **not duplicated** between the two benchmark handlers. Ticket #75's review flagged the duplication (P1); it was resolved by extracting a shared module:

- `MIN_CONTRIBUTORS: usize = 3` — the differential-privacy guard constant.
- `scoped_average(rows, predicate, get_value, keys) -> (Option<HashMap>, bool)` — filters rows by a predicate, withholds the slice (returns `(None, true)`) when fewer than `MIN_CONTRIBUTORS` rows match, otherwise returns `(Some(averages), false)`.
- `average_over(rows, get_value, keys)` — averages each key over rows-with-data only, ignoring missing and `NaN` values.

Both `basic_benchmark.rs` and `national_overview.rs` consume these helpers; the duplicated local implementations were deleted. Five unit tests cover the guard, predicate filtering, NaN/missing handling, and per-key independence.

**All four slices are gated** — including **national**. The national average is also withheld when fewer than 3 cooperatives-with-data exist nationally: a calling coop that knows its own value could otherwise derive a competitor's (`other = 2·avg − own`). The `insufficient_data` object therefore carries a `national` flag alongside `regional`, `sector`, and `sector_regional`.

**Without an own row, regional/sector slices are withheld** (`null` + flag): the caller's region/sector cannot be known without a row, so the backend does not guess.

**Client-side admin threshold (`MIN_CONTRIBUTORS_ADMIN = 2`)** — the shared widget computes regional/sector slices client-side for admin callers (ministry/federation/apex) over the scoped `rows` the backend returns to them. It withholds a slice below 2 contributing coops. This is **not** a privacy regression: admin callers are already authorized to see the raw rows of every cooperative in their scope, so a 2-coop average reveals nothing they do not already have direct access to. The differential-privacy guard that matters — `MIN_CONTRIBUTORS = 3` server-side — applies to **cooperative** callers, who can only ever receive their own row plus aggregates and must not be able to derive a competitor's value from a small average. Coop callers never use the client-side threshold; they consume the server-computed averages.

---

## 3. What Was Implemented — Frontend

### 3.1 Route + navigation

- **Route** — `frontend/src/routes/app.basic-benchmarking.tsx`: `/app/basic-benchmarking`, guarded by `allowedRoles={["ministry", "federation", "apex", "cooperative"]}` (all four roles can access).
- **Sidebar** — `frontend/src/components/app-shell.tsx`: a **"Basic Benchmarking"** item (Gauge icon) directly **below** the existing "Benchmarking" item (Scale icon), under the Analytics section.
- **Role nav** — `/app/basic-benchmarking` added to `ROLE_NAV_ITEMS` for all four roles in `frontend/src/constants/roles.ts`.
- **Page** — `frontend/src/pages/shared/BasicBenchmarkingPage.tsx` (renders the widget + reporting-year slicer).

### 3.2 Data hook — `frontend/src/hooks/analytics/useBasicBenchmark.ts`

`useBasicBenchmark({ reportingYear }, enabled)` calls `GET /api/v1/analytics/basic-benchmark` via the generated OpenAPI client, typed with `BasicBenchmarkResponse` / `BasicBenchmarkRow` interfaces, `staleTime: 60s`.

### 3.3 The shared generic widget (P1 refactor)

The standard `CooperativeComparison.tsx` (~1,247 lines) and the new basic widget (~958 lines) were ~90% identical — the ticket itself asked to *"reuse or adapt the existing CooperativeComparison component"*. The review (P1) required making that reuse real:

| File | Role |
|---|---|
| `benchmark-comparison.tsx` (760 lines) | **The single generic widget** — control panel (target coop, comparison peer, focus metric comboboxes), Recharts bar chart, insight card, matrix, and all loading / error / empty / insufficient-data states |
| `benchmark-matrix.tsx` (280 lines) | Shared comparison matrix table with search + category filter |
| `benchmark-types.ts` | Shared types: `BenchmarkMetric`, `BenchmarkGroup`, `BenchmarkRow`, `BenchmarkComparisonLabels`, `BenchmarkMatrixLabels` |
| `benchmark-utils.ts` | Shared `computeKpiAverages` (client-side averages for admin callers) |
| `CooperativeComparison.tsx` (461 lines) | **Thin wrapper** — standard KPI config (financial + non-financial), labels, hooks |
| `BasicCooperativeComparison.tsx` (170 lines) | **Thin wrapper** — questionnaire metric config, labels, hooks |

The generic widget is parameterized by:

- **metric config** — `{ key, label, unit, group, description, isLowerBetter }[]` (the `isLowerBetter` flag replaced the standard widget's hardcoded "lower is better" key list);
- **row source** — which hook to call per role and how to derive the rows available to the widget;
- **value accessor** — how to read a value off a row (`row.kpis`/`row.non_financial` for standard, `row.metrics` for basic);
- **server averages** — the four aggregate maps + insufficient flags (coop path) or `null` (admin path computes client-side);
- **i18n labels** — a full `BenchmarkComparisonLabels` object.

Both widgets keep the exact same chart styling, colors (`#3b82f6` / `#10b981`), emoji labels (🌍 📍 🏭), and empty states — maintained **once**, not mirrored.

**Role behavior (identical in both widgets):**

- **Coop users** → the benchmark endpoint; their own coop is pre-selected and **locked** (combobox disabled); the comparison-peer dropdown shows **only averages** (never other coops); averages come from the server and respect `insufficient_data`.
- **Admins** → the national-overview/rows endpoint; they can compare any two coops; averages computed client-side with `computeKpiAverages` (they are authorized to see all data).

**Honest states:** with a row present but no benchmarkable answers → amber "no submitted data" notice; coop with no approved data → ShieldAlert empty state ("No Approved Questionnaire Data…"); genuine fetch/500 failure → distinct **error state** (never dressed up as "no data").

### 3.4 i18n

All new strings live under the `basicBenchmarking.*` namespace (title, subtitle, info, groups, KPI labels/descriptions, matrix, empty/error states, insufficient-data notices, plus the `nav.basicBenchmarking` sidebar label) in all 4 locales: `en`, `fr`, `pt`, `ss`.

### 3.5 Tests

- `__tests__/BasicCooperativeComparison.test.tsx` — 11 tests: coop locked-own-coop path, server averages consumed, insufficient-data flags rendered, admin population path, all four empty/error/amber states.
- `__tests__/CooperativeComparison.test.tsx` — smoke tests for the standard wrapper (exercises the `kpis`/`non_financial` value-getter path).

---

## 4. How the Data-Leak Problem Was Solved (recap)

| Requirement | Implementation |
|---|---|
| Coop users never see other coops' rows | `rows` is **always empty** for coop callers — structural, in the response type |
| Averages computed over the full population | `build_questionnaire_rows` runs server-side over all questionnaire responses; only aggregates cross the wire |
| Min-contributor guard | `MIN_CONTRIBUTORS = 3` (shared `services/benchmark.rs`) gates **all four** slices, including national |
| Role-aware filtering | Coop → own row + server averages; admin → full scoped rows |

---

## 5. Bugs Fixed Along the Way

1. **"No data" returned as 404** (the user-reported issue): the basic endpoint returned `404 {"error":"not_found"}` whenever a coop user had no approved/submitted questionnaire — a common, legitimate state. Now `200 OK` + `cooperative: null`, rendered as a ShieldAlert empty state. **The standard benchmark endpoint had the same bug and was fixed identically**, so both widgets behave consistently (verified no e2e spec asserted the old 404).
2. **`has_data` heuristic** — presence-based `has_benchmark_metrics()` so all-zero submissions count as data.
3. **P1 duplication** — shared backend averaging engine + shared generic frontend widget (see §2.4 / §3.3), with the orphaned duplicate helpers removed.
4. **Merge fix** — after merging `develop`, the standard `get_benchmark` gained a `cooperative_id` param + `403 Forbidden` guard (from #75's follow-up); the refactor had dropped the `AppError` import. Restored and re-validated.

---

## 6. Files Touched

**Backend**
- `backend/src/api/handlers/basic_benchmark.rs` — new endpoint
- `backend/src/api/dto/basic_benchmark.rs` — new DTOs
- `backend/src/services/benchmark.rs` — shared averaging engine (+ 5 unit tests)
- `backend/src/api/handlers/national_overview.rs` — uses shared helpers; 404 → 200 fix
- `backend/src/api/dto/national_overview.rs` — `cooperative: Option<CoopKpiRow>`
- `backend/src/api/routes/shared.rs` — route registration
- `backend/tests/handlers_basic_benchmark.rs` — route + OpenAPI schema tests
- `backend/openapi.json` — regenerated

**Frontend**
- `frontend/src/routes/app.basic-benchmarking.tsx` — new route (+ `routeTree.gen.ts`)
- `frontend/src/pages/shared/BasicBenchmarkingPage.tsx` — new page
- `frontend/src/components/app-shell.tsx` — sidebar item
- `frontend/src/constants/roles.ts` — role nav items
- `frontend/src/hooks/analytics/useBasicBenchmark.ts` — new hook
- `frontend/src/components/analytics/basic-benchmark-utils.ts` — metric config
- `frontend/src/components/analytics/benchmark-{comparison,matrix,types,utils}.{tsx,ts}` — shared widget
- `frontend/src/components/analytics/CooperativeComparison.tsx` / `BasicCooperativeComparison.tsx` — thin wrappers
- `frontend/src/i18n/locales/{en,fr,pt,ss}.json` — `basicBenchmarking.*` + `nav.basicBenchmarking`
- `frontend/src/openapi-client/api.d.ts` + `frontend/openapi.json` — regenerated

**Docs**
- `docs/basic-benchmarking-implementation.md` — this document

---

## 7. Verification

- **Backend:** `cargo fmt` ✅, `cargo clippy --all-targets` ✅ (0 warnings on changed files), `cargo test` ✅ — 203 unit tests (incl. 5 `services::benchmark` helper tests) + all integration suites (incl. `handlers_basic_benchmark.rs`).
- **Frontend:** `tsc --noEmit` ✅, ESLint 0 errors / 0 warnings on changed files ✅, Prettier ✅, **197 tests pass** (13 new).
- **OpenAPI:** `backend/openapi.json` regenerated and the frontend client re-synced — the endpoint and all schemas are in the contract.
- **Post-merge:** re-validated both stacks after merging `develop` into `basicBenchmark`; only fix needed was the `AppError` import (§5.4).

---

## 8. Summary

Basic Benchmarking delivers the questionnaire tier the same insight the standard tier got in ticket #75: a dedicated sidebar tab with an identical premium UI, comparing 15 questionnaire-derived metrics against National / Regional / Sector / Sector+Regional averages. Privacy is **structural** (coop callers can only ever receive their own row + aggregates), the `MIN_CONTRIBUTORS = 3` guard applies to every slice, and "no data" is rendered honestly as an empty state rather than an error. The feature was built by **extracting a single shared benchmarking widget and a shared backend averaging engine**, eliminating the ~90% duplication the review flagged — future changes to the benchmarking UX are now made once, for both tracks.
