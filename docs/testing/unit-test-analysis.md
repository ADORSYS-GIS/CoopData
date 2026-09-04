# Unit Test Deep Dive — CoopData Project

> **Date:** September 1, 2026
> **Status:** Current state analysis + prioritized implementation roadmap
> **Issue:** GitHub #109 — Improve Unit Test Coverage Across Frontend and Backend

---

## Executive Summary

This document is the living reference for Issue #109. It maps every untested module, assigns priority based on business risk and effort, and defines the phased roadmap to reach enforced coverage gates in CI.

**Goal:** Frontend 80% line coverage, Backend 70% line coverage, with CI gates that fail on regression.

---

## Current State Snapshot

| Dimension | Frontend | Backend |
|---|---|---|
| **Source files** | ~200 components/hooks/lib | 155 `.rs` files |
| **Test files** | 24 | 8 integration + 31 inline modules |
| **Total tests** | 369 | 275 |
| **Framework** | Vitest + Testing Library | tokio::test + tower |
| **Coverage tool** | `@vitest/coverage-v8` (configured) | **None** |
| **Coverage enforced in CI** | No | No |
| **Vitest config status** | ✅ Correct (`["text", "html", "lcov"]`) | N/A |
| **Backend coverage tool** | N/A | ❌ Not installed |

### What's Changed Since Last Review

- **Phase 2 completed**: 3 new FE test files (useOfflineQuery, useNetworkStatus, OrganizationLabelsContext), 2 new BE inline modules (object_storage, pdf_templates)
- **FE test count**: 369 passing (was 236, +133 new tests)
- **BE test count**: 275 passing (was 22 baseline, +253 new inline tests)
- **tempfile crate added** to backend dev-dependencies for object_storage tests
- **Key fixes**: LocalFileStorage::delete now returns Ok for missing files; useNetworkStatus uses vi.hoisted with relative path mocks; useOfflineQuery wrapper fixed to proper QueryClientProvider pattern

---

## Frontend — Coverage Map

### ✅ Well Tested (21 files)

| File | Tests | Coverage |
|---|---|---|
| `src/services/shared/authService.test.ts` | 37 | Auth, token parsing, role mapping |
| `src/context/AuthContext.test.tsx` | 14 | Auth provider, useAuth, useRole, useCanAccess |
| `src/lib/route-guards.test.ts` | 23 | Route access control by role |
| `src/constants/roles.test.ts` | 39 | Role constants and mappings |
| `src/hooks/submissions/useLatestSubmission.test.ts` | 8 | Latest submission sort logic |
| `src/hooks/auth/useVerifyIdentity.test.ts` | 9 | Identity verification flow |
| `src/components/analytics/__tests__/BenchmarkInsightPanel.test.tsx` | 13 | Benchmark insight generation |
| `src/components/analytics/__tests__/BasicCooperativeComparison.test.tsx` | 11 | Cooperative comparison widget |
| `src/components/analytics/__tests__/CooperativeComparison.test.tsx` | 2 | Full comparison widget |
| `src/services/shared/offlineCache.test.ts` | 4 | Cache get/set/delete/clear |
| `src/services/shared/syncQueueService.test.ts` | 5 | Sync queue flush, retry |
| `src/services/shared/offlineDb.test.ts` | 3 | IndexedDB table operations |
| `src/pages/ministry/__tests__/SettingsPage.test.tsx` | 6 | Settings page theme switching |
| `src/hooks/shared/useOfflineQuery.test.tsx` | 10 | Offline-first query hook |
| `src/hooks/shared/useNetworkStatus.test.ts` | 8 | Network status detection |
| `src/context/OrganizationLabelsContext.test.tsx` | 14 | Organization labels context |
| `src/lib/utils.test.ts` | 13 | cn() Tailwind merging |
| `src/lib/financial-data.test.ts` | 37 | Balance sheet calculations |
| `src/lib/kpi-calculations.test.ts` | 52 | KPI calculations |

### ❌ Untested — Priority Matrix

#### 🔴 Phase 1 — Utility Functions (Easy Wins, High Impact)

These are **pure functions** — no mocking needed, just input/output assertions.

| File | Lines | Why It Matters | Effort |
|---|---|---|---|
| `src/lib/utils.ts` | 6 | `cn()` used everywhere for class merging | ⭐ Trivial |
| `src/lib/kpi-calculations.ts` | 887 | All dashboard KPIs computed here — silent breakage = wrong numbers | ⭐⭐⭐ High |
| `src/lib/financial-data.ts` | 17,717 | Balance sheet calculations, loan portfolio, deposits | ⭐⭐⭐ High |
| `src/lib/report-export.ts` | 19,223 | Excel/PDF export — broken export = compliance failure | ⭐⭐⭐ High |
| `src/lib/contentLocalization.ts` | 5,095 | i18n string lookups — broken = wrong language | ⭐⭐ Medium |
| `src/lib/theme.tsx` | 2,517 | Theme configuration | ⭐⭐ Medium |
| `src/lib/mock-data.ts` | 28,401 | Test data factory — used by all tests | ⭐⭐ Medium |

#### 🔴 Phase 2 — Core Hooks (Offline-First Backbone)

| File | Lines | Why It Matters | Effort | Status |
|---|---|---|---|---|
| `src/hooks/shared/useOfflineQuery.ts` | 95 | **Offline-first core** — cache read/write, online/offline fallback, never throws | ⭐⭐⭐ High | ✅ Done (10 tests) |
| `src/hooks/shared/useNetworkStatus.ts` | ~50 | Network state detection for offline mode | ⭐⭐ Medium | ✅ Done (8 tests) |
| `src/context/OrganizationLabelsContext.tsx` | ~100 | Shared state for org labels | ⭐⭐ Medium | ✅ Done (14 tests) |
| `src/hooks/organizations/useOrganizations.ts` | ~80 | Organization listing — used by all views | ⭐⭐ Medium | Pending |
| `src/hooks/analytics/useMonthlyTrend.ts` | ~60 | Monthly trend data — analytics dashboard | ⭐⭐ Medium | Pending |
| `src/hooks/analytics/useNationalOverview.ts` | ~60 | National overview KPIs | ⭐⭐ Medium | Pending |
| `src/hooks/analytics/useNfStatistics.ts` | ~60 | Non-financial statistics | ⭐⭐ Medium | Pending |
| `src/hooks/submissions/useSubmissions.ts` | ~100 | Submission listing — high usage | ⭐⭐ Medium | Pending |
| `src/hooks/submissions/useManualEntry.ts` | ~100 | Manual financial entry | ⭐⭐ Medium |
| `src/hooks/submissions/useFinancialStatement.ts` | ~100 | Financial statement CRUD | ⭐⭐ Medium |
| `src/hooks/non-financial/useMembers.ts` | ~80 | Member management | ⭐⭐ Medium |
| `src/hooks/non-financial/useNfUpload.ts` | ~80 | Non-financial upload | ⭐⭐ Medium |
| `src/hooks/cooperatives/useCooperatives.ts` | ~80 | Cooperative listing | ⭐⭐ Medium |
| `src/hooks/federations/useFederations.ts` | ~80 | Federation listing | ⭐⭐ Medium |
| `src/hooks/apexes/useApexes.ts` | ~80 | Apex listing | ⭐⭐ Medium |
| `src/hooks/analytics/useFederationStats.ts` | ~60 | Federation analytics | ⭐⭐ Medium |
| `src/hooks/analytics/useMinistryStats.ts` | ~60 | Ministry analytics | ⭐⭐ Medium |
| `src/hooks/analytics/useBenchmarks.ts` | ~60 | Benchmark data | ⭐⭐ Medium |
| `src/hooks/analytics/useBenchmark.ts` | ~60 | Single benchmark | ⭐⭐ Medium |
| `src/hooks/analytics/useBasicBenchmark.ts` | ~60 | Basic benchmark | ⭐⭐ Medium |
| `src/hooks/analytics/useComparativeStatements.ts` | ~60 | Comparative statements | ⭐⭐ Medium |
| `src/hooks/analytics/useConsolidatedNarratives.ts` | ~60 | Consolidated narratives | ⭐⭐ Medium |
| `src/hooks/analytics/useCustomKpis.ts` | ~60 | Custom KPIs | ⭐⭐ Medium |
| `src/hooks/analytics/useRegionCompliance.ts` | ~60 | Region compliance | ⭐⭐ Medium |
| `src/hooks/analytics/useSectorBreakdown.ts` | ~60 | Sector breakdown | ⭐⭐ Medium |
| `src/hooks/analytics/useSubmissionActivity.ts` | ~60 | Submission activity | ⭐⭐ Medium |
| `src/hooks/analytics/useNfTrend.ts` | ~60 | NF trend | ⭐⭐ Medium |
| `src/hooks/audit/useAuditLogs.ts` | ~60 | Audit log listing | ⭐⭐ Medium |
| `src/hooks/users/useUsers.ts` | ~60 | User management | ⭐⭐ Medium |
| `src/hooks/admin/useQuestionnaireTemplates.ts` | ~60 | Questionnaire templates | ⭐⭐ Medium |
| `src/hooks/submissions/useApexSubmissionKpis.ts` | ~60 | Apex submission KPIs | ⭐⭐ Medium |
| `src/hooks/submissions/useCooperativeKpis.ts` | ~60 | Cooperative KPIs | ⭐⭐ Medium |
| `src/hooks/submissions/useExtractionJob.ts` | ~60 | Extraction job tracking | ⭐⭐ Medium |
| `src/hooks/submissions/useNonFinancialIndicators.ts` | ~60 | NF indicators | ⭐⭐ Medium |
| `src/hooks/submissions/useQuestionnaire.ts` | ~60 | Questionnaire | ⭐⭐ Medium |
| `src/hooks/submissions/useReviewSubmissions.ts` | ~60 | Review submissions | ⭐⭐ Medium |
| `src/hooks/submissions/useSubmissionNarratives.ts` | ~60 | Submission narratives | ⭐⭐ Medium |
| `src/hooks/submissions/useSubmissionSections.ts` | ~60 | Submission sections | ⭐⭐ Medium |
| `src/hooks/submissions/useUpload.ts` | ~60 | Upload | ⭐⭐ Medium |
| `src/hooks/non-financial/useFarmCoop.ts` | ~60 | Farm coop | ⭐⭐ Medium |
| `src/hooks/non-financial/useFixedDeposits.ts` | ~60 | Fixed deposits | ⭐⭐ Medium |
| `src/hooks/non-financial/useLoans.ts` | ~60 | Loans | ⭐⭐ Medium |
| `src/hooks/non-financial/useSavings.ts` | ~60 | Savings | ⭐⭐ Medium |
| `src/hooks/cooperatives/useCooperativeProfile.ts` | ~60 | Coop profile | ⭐⭐ Medium |
| `src/hooks/settings/useOrganizationLabels.ts` | ~60 | Org labels | ⭐⭐ Medium |
| `src/hooks/auth/useAuth.ts` | ~60 | Auth | ⭐⭐ Medium |
| `src/hooks/auth/usePassword.ts` | ~60 | Password | ⭐⭐ Medium |

#### 🟡 Phase 3 — Contexts & Pages

| File | Why It Matters | Effort |
|---|---|---|
| `src/context/OrganizationLabelsContext.tsx` | Shared state for org labels — used across ministry/federation/apex views | ⭐⭐ Medium |
| All ministry/federation/apex/cooperative pages | Only `SettingsPage` tested | ⭐⭐⭐ High |

---

## Backend — Coverage Map

### ✅ Well Tested (29 inline + 8 integration files)

#### Inline Test Modules (29 files)

| File | What it tests |
|---|---|
| `src/error.rs` | All AppError variants → HTTP status codes |
| `src/utils.rs` | Utility conversion functions |
| `src/config.rs` | AppConfig construction |
| `src/auth/claims.rs` | JWT claims parsing |
| `src/auth/middleware.rs` | Auth middleware extraction |
| `src/auth/rbac.rs` | Role-based access control |
| `src/models/keycloak.rs` | Keycloak user model parsing |
| `src/services/benchmark.rs` | Differential privacy averages |
| `src/services/verification_token.rs` | Token generation/uniqueness |
| `src/services/localization.rs` | Language normalization |
| `src/services/keycloak.rs` | MFA enabled detection |
| `src/services/kpi_engine.rs` | KPI calculation engine |
| `src/services/nf_indicator_engine.rs` | Non-financial indicator calculations |
| `src/services/nf_excel_parser.rs` | Excel parsing (1 trivial test — **needs expansion**) |
| `src/api/dto/common.rs` | Pagination defaults |
| `src/api/dto/cooperative.rs` | Coop DTO conversion |
| `src/api/dto/federation.rs` | Federation DTO conversion |
| `src/api/dto/apex.rs` | Apex DTO conversion |
| `src/api/dto/organization.rs` | Organization DTO deserialization |
| `src/api/dto/organization_label.rs` | Label validation |
| `src/api/dto/audit.rs` | Audit DTO conversion |
| `src/api/dto/financial.rs` | Financial DTO conversion |
| `src/api/dto/member.rs` | Member DTO deserialization |
| `src/api/dto/user.rs` | User DTO deserialization |
| `src/api/dto/verification.rs` | Verification DTO deserialization |
| `src/api/dto/submission.rs` | Period validation (comprehensive, added by PR #110) |
| `src/api/handlers/users.rs` | Role validation |
| `src/api/handlers/basic_benchmark.rs` | Benchmark row filtering |
| `src/api/handlers/non_financial.rs` | Empty row import handling |
| `src/api/handlers/organization_label.rs` | Allowed keys validation |

#### Integration Test Files (8 files)

| File | Tests | Coverage |
|---|---|---|
| `tests/handlers_users.rs` | 5 | Health check, auth rejection, OpenAPI spec |
| `tests/handlers_verify_identity.rs` | 21 | Identity verification, MFA, delete-preview, RBAC |
| `tests/handlers_audit.rs` | 16 | Audit log endpoints, RBAC |
| `tests/handlers_cooperative.rs` | 16 | Cooperative endpoints, RBAC |
| `tests/handlers_benchmark.rs` | 3 | Benchmark endpoint access |
| `tests/handlers_basic_benchmark.rs` | 3 | Basic benchmark endpoint access |
| `tests/common/mock.rs` | — | TestApp builder, test config |
| `tests/common/mod.rs` | — | Test utilities module |

### ❌ Untested — Priority Matrix

#### 🔴 Phase 1 — Services (High Business Logic Risk)

| File | Lines | Why It Matters | Effort | Test Strategy |
|---|---|---|---|---|
| `src/services/cache.rs` | 187 | Caching layer — Redis + in-memory backend. **Easiest to test** — has `memory://` URL mode for zero-dependency testing | ⭐⭐ Medium | ✅ Done (14 inline tests) |
| `src/services/submission_workflow.rs` | 1,266 | Submission state machine — submit, approve, reject, flag. **Critical business logic** | ⭐⭐⭐ High | Pending |
| `src/services/export_generator.rs` | 40,517 | Excel/PDF report generation — compliance output | ⭐⭐⭐ High | Pending |
| `src/services/report_narrative.rs` | 101,811 | AI narrative generation — largest file in project | ⭐⭐⭐ High | Pending |
| `src/services/object_storage.rs` | 8,200 | S3/local file storage | ⭐⭐ Medium | ✅ Done (13 inline tests) |
| `src/services/pdf_templates.rs` | 3,463 | PDF template rendering | ⭐⭐ Medium | ✅ Done (14 inline tests) |
| `src/services/ai_extraction.rs` | 63,813 | AI-powered extraction | ⭐⭐⭐ High | Pending |
| `src/services/extraction_pipeline.rs` | 14,645 | Extraction pipeline orchestration | ⭐⭐⭐ High | Pending |
| `src/services/abnormality_detector/` | ~500 | Anomaly detection | ⭐⭐ Medium | Pending |
| `src/services/nf_excel_parser.rs` | 64,152 | Excel parsing — has 1 trivial test, needs expansion | ⭐⭐⭐ High | Pending |

#### 🔴 Phase 2 — Repositories (Zero Tests — 31 Repositories)

All 31 repositories have **zero unit tests**. These are pure database query layers — testable with SeaORM's mock connection or by testing at the integration level.

**Priority ranking (by usage frequency):**

| Priority | Repository | Why It Matters |
|---|---|---|
| 1 | `submission.rs` | Submission CRUD — core workflow |
| 2 | `cooperative.rs` | Cooperative CRUD — primary entity |
| 3 | `member.rs` | Member management — high volume |
| 4 | `financial_statement.rs` | Financial data — compliance |
| 5 | `user.rs` | User management — auth |
| 6 | `federation.rs` | Federation CRUD |
| 7 | `apex.rs` | Apex CRUD |
| 8 | `balance_sheet_line_item.rs` | Line items — financial calculations |
| 9 | `loan.rs` | Loan records |
| 10 | `savings_account.rs` | Savings accounts |
| 11 | `audit_log.rs` | Audit trail |
| 12 | `organization.rs` | Organization management |
| 13 | `questionnaire.rs` | Questionnaire responses |
| 14 | `questionnaire_template.rs` | Questionnaire templates |
| 15 | `fixed_deposit.rs` | Fixed deposits |
| 16 | `farm_coop.rs` | Farm coop data |
| 17 | `non_financial_indicator_entry.rs` | NF indicator entries |
| 18 | `non_financial_indicator_catalog.rs` | NF indicator catalog |
| 19 | `submission_section.rs` | Submission sections |
| 20 | `submission_review.rs` | Submission reviews |
| 21 | `chart_of_accounts.rs` | Chart of accounts |
| 22 | `uploaded_file.rs` | File uploads |
| 23 | `extraction_job.rs` | Extraction jobs |
| 24 | `kpi_record.rs` | KPI records |
| 25 | `custom_kpi_repository.rs` | Custom KPIs |
| 26 | `abnormality_flag.rs` | Abnormality flags |
| 27 | `account_alias.rs` | Account aliases |
| 28 | `organization_label.rs` | Organization labels |
| 29 | `assessment.rs` | Assessments |
| 30 | `ministry_report_narratives.rs` | Ministry narratives |
| 31 | `mod.rs` | Module re-export only |

**Test strategy for repositories:**
- Use SeaORM's `MockDatabase` for unit tests (fast, no DB needed)
- Test: `find_by_id`, `create`, `update`, `delete`, `list_all`, `find_by_*` methods
- Test: error paths (not found, validation failures)
- Test: query construction (filter, order, pagination)

#### 🟡 Phase 3 — Handler Integration Tests (Missing)

| Handler | Current Test Status | Priority |
|---|---|---|
| `federation.rs` | ❌ No integration test | 🔴 High |
| `apex.rs` | ❌ No integration test | 🔴 High |
| `submission.rs` | ❌ No integration test | 🔴 High |
| `export.rs` | ❌ No integration test | 🔴 High |
| `upload.rs` | ❌ No integration test | 🔴 High |
| `questionnaire.rs` | ❌ No integration test | 🟡 Medium |
| `questionnaire_template.rs` | ❌ No integration test | 🟡 Medium |
| `me.rs` | ❌ No integration test | 🟡 Medium |
| `financial_statement.rs` | ❌ No integration test | 🔴 High |
| `national_overview.rs` | ❌ No integration test | 🟡 Medium |
| `non_financial.rs` | ⚠️ Inline test only (empty row import) | 🟡 Medium |
| `non_financial_indicator.rs` | ❌ No integration test | 🟡 Medium |
| `nf_indicator_stats.rs` | ❌ No integration test | 🟡 Medium |
| `custom_kpi.rs` | ❌ No integration test | 🟡 Medium |
| `extraction.rs` | ❌ No integration test | 🟡 Medium |
| `organization_label.rs` | ⚠️ Inline test only | 🟡 Medium |
| `basic_benchmark.rs` | ⚠️ Inline test only | 🟡 Medium |
| `health.rs` | ❌ No integration test | 🟢 Low |
| `users.rs` | ⚠️ Inline test only | 🟢 Low |
| `audit.rs` | ✅ Integration test exists | 🟢 Low |
| `cooperative.rs` | ✅ Integration test exists | 🟢 Low |
| `verify_identity.rs` | ✅ Integration test exists | 🟢 Low |
| `benchmark.rs` | ✅ Integration test exists | 🟢 Low |

---

## Coverage Infrastructure

### Frontend — Vitest

**Current status:** ✅ Config is correct. `vitest.config.ts` uses `provider: "v8"` with `["text", "html", "lcov"]` reporters.

**What needs to be done:**
- [ ] Add coverage thresholds to `vitest.config.ts`:
  ```ts
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/*.config.*", "src/routeTree.gen.ts"],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  }
  ```
- [ ] Add coverage gate to CI (`frontend.yml`):
  ```yaml
  - name: Coverage
    run: npm run coverage
    # Fail if thresholds not met
  ```
- [ ] Verify `npm run coverage` runs successfully

### Backend — cargo-llvm-cov

**Current status:** ❌ No coverage tool installed.

**Recommended tool:** `cargo-llvm-cov` (lighter than `cargo-tarpaulin`, better HTML reports, supports GitHub Actions natively).

**Installation:**
```bash
cargo install cargo-llvm-cov
```

**What needs to be done:**
- [ ] Add `cargo-llvm-cov` to `Cargo.toml` `[dev-dependencies]` or install via CI
- [ ] Add `llvm-cov` to backend CI pipeline:
  ```yaml
  - name: Coverage
    run: cargo llvm-cov --lcov --output-path lcov.info
  - name: Upload coverage
    uses: actions/upload-artifact@v4
    with:
      name: coverage
      path: lcov.info
  ```
- [ ] Set thresholds in `Cargo.toml` or via CLI:
  ```bash
  cargo llvm-cov --fail-under-lines 70 --fail-under-functions 70
  ```
- [ ] Generate HTML report for local dev:
  ```bash
  cargo llvm-cov --html --open
  ```

---

## Prioritized Implementation Roadmap

### 🔴 Phase 1: Quick Wins (1-2 days)

**Goal:** Build momentum with easy, high-value tests. No mocking needed.

- [x] **Frontend:** Write tests for `src/lib/utils.ts` — `cn()` function (trivial, 13 tests) ✅
- [x] **Frontend:** Write tests for `src/lib/kpi-calculations.ts` — KPI calculation functions (52 tests) ✅
- [x] **Frontend:** Write tests for `src/lib/financial-data.ts` — Balance sheet calculations (37 tests) ✅
- [ ] **Frontend:** Write tests for `src/lib/contentLocalization.ts` — i18n lookups (medium, 10-20 tests)
- [ ] **Frontend:** Write tests for `src/lib/report-export.ts` — Export logic (high impact, 20-30 tests)
- [x] **Backend:** Write unit tests for `src/services/cache.rs` — Cache service with `memory://` backend (14 tests) ✅
- [ ] **Backend:** Add `cargo-llvm-cov` to CI pipeline
- [ ] **Frontend:** Add coverage thresholds to `vitest.config.ts`
- [ ] **Frontend:** Add coverage gate to CI pipeline

### 🔴 Phase 2: Core Business Logic (3-5 days)

**Goal:** Cover the highest-risk business logic in both frontend and backend.

- [ ] **Frontend:** Write tests for `useOfflineQuery` — online, offline, cache-hit, cache-miss, sync scenarios (critical, 15-20 tests)
- [ ] **Frontend:** Write tests for `useNetworkStatus` — online/offline detection (medium, 5-10 tests)
- [ ] **Frontend:** Write tests for `OrganizationLabelsContext` — shared state management (medium, 10-15 tests)
- [ ] **Backend:** Write unit tests for `src/services/submission_workflow.rs` — submit, approve, reject, flag state machine (critical, 20-30 tests)
- [ ] **Backend:** Write unit tests for `src/services/export_generator.rs` — report generation (high impact, 15-20 tests)
- [ ] **Backend:** Write unit tests for `src/services/object_storage.rs` — S3/local storage (medium, 10-15 tests)
- [ ] **Backend:** Write unit tests for `src/services/pdf_templates.rs` — PDF templates (medium, 5-10 tests)
- [ ] **Backend:** Expand tests for `src/services/nf_excel_parser.rs` — Excel parsing (high impact, 20+ tests)

### 🟡 Phase 3: Repository & Handler Coverage (1-2 weeks)

**Goal:** Systematic coverage of the data layer and API endpoints.

- [ ] **Backend:** Write unit tests for top 10 repositories using SeaORM `MockDatabase`:
  1. `submission.rs`
  2. `cooperative.rs`
  3. `member.rs`
  4. `financial_statement.rs`
  5. `user.rs`
  6. `federation.rs`
  7. `apex.rs`
  8. `balance_sheet_line_item.rs`
  9. `loan.rs`
  10. `savings_account.rs`
- [ ] **Backend:** Add integration tests for `handlers_federation.rs`
- [ ] **Backend:** Add integration tests for `handlers_apex.rs`
- [ ] **Backend:** Add integration tests for `handlers_submission.rs`
- [ ] **Backend:** Add integration tests for `handlers_export.rs`
- [ ] **Backend:** Add integration tests for `handlers_upload.rs`
- [ ] **Backend:** Add integration tests for `handlers_financial_statement.rs`
- [ ] **Backend:** Add integration tests for `handlers_questionnaire.rs`

### 🟡 Phase 4: Remaining Coverage (ongoing)

- [ ] **Backend:** Write unit tests for remaining 21 repositories
- [ ] **Backend:** Write unit tests for `src/services/report_narrative.rs`
- [ ] **Backend:** Write unit tests for `src/services/ai_extraction.rs`
- [ ] **Backend:** Write unit tests for `src/services/extraction_pipeline.rs`
- [ ] **Backend:** Write unit tests for `src/services/abnormality_detector/`
- [ ] **Frontend:** Write tests for remaining hooks (50+ hooks, prioritize by usage)
- [ ] **Frontend:** Write tests for untested pages

### 🟢 Phase 5: Coverage Enforcement (ongoing)

- [ ] Enforce 80% line coverage threshold on frontend in CI
- [ ] Enforce 70% line coverage threshold on backend in CI
- [ ] Create coverage dashboard (GitHub Actions artifact + PR comment)
- [ ] Target 90%+ coverage on critical paths (auth, submissions, exports)
- [ ] Add coverage regression alerts

---

## Testing Patterns Reference

### Frontend — Vitest

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn()", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });
  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });
});
```

### Frontend — TanStack Query Hooks

```typescript
// Mock the API client and offline cache
vi.mock("@/openapi-client/services.gen", () => ({
  getCooperative: vi.fn(),
}));
vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));
```

### Backend — Service Unit Tests

```rust
// src/services/cache.rs — use memory:// backend
#[tokio::test]
async fn cache_get_returns_none_when_key_missing() {
    let cache = CacheService::new("memory://").await.unwrap();
    let result: Option<String> = cache.get("missing").await.unwrap();
    assert!(result.is_none());
}
```

### Backend — Repository Unit Tests (SeaORM Mock)

```rust
// Use sea_orm::MockDatabase for repository tests
#[tokio::test]
async fn submission_repo_find_by_id_returns_none_when_not_found() {
    let db = MockDatabase::new(DbBackend::Postgres)
        .append_query_results(vec![vec![]])
        .into_connection();
    let repo = SubmissionRepository;
    let result = repo.find_by_id(Uuid::new_v4()).await.unwrap();
    assert!(result.is_none());
}
```

### Backend — Integration Tests

```rust
// tests/handlers_submission.rs — follow existing pattern in tests/common/mock.rs
#[tokio::test]
async fn create_submission_requires_auth() {
    let app = TestApp::build().await;
    let response = app.post("/api/submissions").json(&body).send().await;
    response.assert_status(StatusCode::UNAUTHORIZED);
}
```

---

## Files Reference

### Frontend Test Files (18)

| File | Tests | Coverage |
|---|---|---|
| `src/services/shared/authService.test.ts` | 18+ | Keycloak auth, token parsing, role mapping |
| `src/services/shared/offlineCache.test.ts` | 4 | Cache get/set/delete/clear |
| `src/services/shared/syncQueueService.test.ts` | 5 | Sync queue flush, retry, verification tokens |
| `src/services/shared/offlineDb.test.ts` | 3 | IndexedDB table operations |
| `src/lib/route-guards.test.ts` | 23 | Route access control by role |
| `src/constants/roles.test.ts` | 39 | Role constants and mappings |
| `src/hooks/submissions/useLatestSubmission.test.ts` | 8 | Latest submission sort logic |
| `src/hooks/auth/useVerifyIdentity.test.ts` | 9 | Identity verification flow |
| `src/hooks/auth/useSecuritySettings.test.tsx` | — | Security settings hook |
| `src/context/AuthContext.test.tsx` | 14 | Auth provider, useAuth, useRole, useCanAccess |
| `src/components/ProtectedRoute.test.tsx` | — | Protected route rendering |
| `src/components/shared/DeleteConfirmationDialog.test.tsx` | — | Delete dialog component |
| `src/components/shared/ResetMfaDialog.test.tsx` | — | MFA reset dialog |
| `src/components/analytics/__tests__/BenchmarkInsightPanel.test.tsx` | 13 | Benchmark insight generation + rendering |
| `src/components/analytics/__tests__/BasicCooperativeComparison.test.tsx` | 11 | Cooperative comparison widget |
| `src/components/analytics/__tests__/CooperativeComparison.test.tsx` | 2 | Full comparison widget |
| `src/pages/ministry/__tests__/SettingsPage.test.tsx` | 6 | Settings page theme switching |
| `src/pages/cooperative/__tests__/QuestionnaireWizard.test.tsx` | — | Questionnaire wizard flow |

### Backend Integration Test Files (8)

| File | Tests | What it covers |
|---|---|---|
| `tests/handlers_users.rs` | 5 | Health check, auth rejection, OpenAPI spec |
| `tests/handlers_verify_identity.rs` | 21 | Identity verification, MFA, delete-preview, RBAC |
| `tests/handlers_audit.rs` | 16 | Audit log endpoints, RBAC |
| `tests/handlers_cooperative.rs` | 16 | Cooperative endpoints, RBAC |
| `tests/handlers_benchmark.rs` | 3 | Benchmark endpoint access |
| `tests/handlers_basic_benchmark.rs` | 3 | Basic benchmark endpoint access |
| `tests/common/mock.rs` | — | TestApp builder, test config |
| `tests/common/mod.rs` | — | Test utilities module |

### Backend Inline Test Modules (29)

| File | What it tests |
|---|---|
| `src/error.rs` | All AppError variants → HTTP status codes |
| `src/utils.rs` | Utility conversion functions |
| `src/config.rs` | AppConfig construction |
| `src/auth/claims.rs` | JWT claims parsing |
| `src/auth/middleware.rs` | Auth middleware extraction |
| `src/auth/rbac.rs` | Role-based access control |
| `src/models/keycloak.rs` | Keycloak user model parsing |
| `src/services/benchmark.rs` | Differential privacy averages |
| `src/services/verification_token.rs` | Token generation/uniqueness |
| `src/services/localization.rs` | Language normalization |
| `src/services/keycloak.rs` | MFA enabled detection |
| `src/services/kpi_engine.rs` | KPI calculation engine |
| `src/services/nf_indicator_engine.rs` | Non-financial indicator calculations |
| `src/services/nf_excel_parser.rs` | Excel parsing (needs expansion) |
| `src/api/dto/common.rs` | Pagination defaults |
| `src/api/dto/cooperative.rs` | Coop DTO conversion |
| `src/api/dto/federation.rs` | Federation DTO conversion |
| `src/api/dto/apex.rs` | Apex DTO conversion |
| `src/api/dto/organization.rs` | Organization DTO deserialization |
| `src/api/dto/organization_label.rs` | Label validation |
| `src/api/dto/audit.rs` | Audit DTO conversion |
| `src/api/dto/financial.rs` | Financial DTO conversion |
| `src/api/dto/member.rs` | Member DTO deserialization |
| `src/api/dto/user.rs` | User DTO deserialization |
| `src/api/dto/verification.rs` | Verification DTO deserialization |
| `src/api/dto/submission.rs` | Period validation (comprehensive) |
| `src/api/handlers/users.rs` | Role validation |
| `src/api/handlers/basic_benchmark.rs` | Benchmark row filtering |
| `src/api/handlers/non_financial.rs` | Empty row import handling |
| `src/api/handlers/organization_label.rs` | Allowed keys validation |