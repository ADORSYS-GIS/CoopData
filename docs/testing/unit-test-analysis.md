# Unit Test Deep Dive — CoopData Project

> **Date:** September 16, 2026 (re-audit) — previous audit September 1, 2026
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
| **Source files** | ~200 components/hooks/lib | 158 `.rs` files |
| **Test files** | 31 | 19 integration + 38 inline modules |
| **Total tests** | 465 (verified green) | 586 (verified green: 356 inline + 230 integration) |
| **Framework** | Vitest + Testing Library | tokio::test + tower |
| **Coverage tool** | `@vitest/coverage-v8` (configured, `src/**` only) | `cargo-tarpaulin` (installed in CI) |
| **Coverage enforced in CI** | ✅ Yes (thresholds: lines 10, functions 40, branches 45, statements 10, `perFile: false`) | ✅ Yes (`--fail-under 70`) |
| **Coverage baseline** | 11.15% lines (measured Sept 16) | Measured in CI (baseline TBD) |
| **Backend coverage tool** | N/A | ✅ Installed |

### What's Changed Since Last Review

**Re-audit (Sept 16, 2026) — verified by running both suites:**

- **FE test count**: 401 passing across 28 files (was 369 / 24 files, +32 tests)
- **BE test count**: 371 passing total — 289 inline unit + 82 integration (was 275)
- **FE coverage baseline fixed**: `vitest.config.ts` was counting `dist/`, `dev-dist/`, `e2e/`, and `playwright-report/` as source, diluting the number. Added `include: ["src/**"]` plus excludes for `main.tsx`, `router.tsx`, `components/ui/` (shadcn), and `i18n/` locales. True baseline: **10.2% lines (5,539/54,166)** — the earlier 9.12% figure was noise-diluted, the real number is dominated by untested pages/components.
- **New test files since last audit**: `useSecuritySettings.test.tsx`, `ResetMfaDialog.test.tsx`, `DeleteConfirmationDialog.test.tsx`, `QuestionnaireWizard.test.tsx` (cooperative)

**E2E Full-Stack Tests (Sept 16, 2026) — all 3 routes complete:**

- **Route 1 (Upload Method)**: `route1-upload-sequential.spec.ts` — 7 sequential tests, all passing. Uses real Keycloak auth, AI extraction polling, full approval chain.
- **Route 2 (Manual Entry)**: `route2-manual-sequential.spec.ts` — 7 sequential tests, all passing. Uses "Populate Test Data" buttons for fast data entry.
- **Route 3 (Questionnaire)**: `route3-questionnaire-sequential.spec.ts` — 7 sequential tests, all passing. Uses "Edit Answers" + "Populate Test Data" workflow.
- **Total**: 21 E2E tests covering all 3 submission methods end-to-end with real backend + real Keycloak.
- See `docs/testing/full-stack-e2e-testing-plan.md` for full details.

**Sprint 1 + Sprint 2 completed (Sept 16, 2026):**

- **Sprint 1 — pure-logic quick wins (+131 tests)**: `abnormality_detector/` (67 BE inline tests: calculations 30, flags 28, sum_checks 9), `contentLocalization.ts` (30), `report-export.ts` (27), `nf-parse-errors.ts` (7).
- **Sprint 2 — security & state machine (+28 tests)**: new SeaORM `MockDatabase` infrastructure (`tests/common/mock_db.rs`) with an in-process mock Keycloak (axum) so `resolve_group` walks work offline. `tenant_isolation.rs` (9 tests: 4-tier access matrix, NotFound-for-coops to prevent enumeration, Forbidden-for-apex/federation), `submission_workflow.rs` (19 tests: submit guards, tier routing incl. apex-created return paths, terminal approve/reject).
- **⚠️ Architectural change required by Sprint 2**: SeaORM's `mock` feature removes `Clone` from `DatabaseConnection` (`#[cfg_attr(not(feature = "mock"), derive(Clone))]`). The shared handle is now the `Database` newtype (`src/database.rs`) — an `Arc<DatabaseConnection>` wrapper implementing `ConnectionTrait`/`TransactionTrait`/`Deref`, with `impl Into<Database>` repo constructors so call sites are unchanged. Repos previously cloned the raw connection; behavior is identical (pool clone shared the same pool anyway).
- **Counts after both sprints**: FE 465 / 31 files, BE 466 (356 inline + 110 integration). `cargo clippy -D warnings` and `tsc --noEmit` clean.
- **Sprint 3 — repository layer (+58 tests, Sept 16, 2026)**: statement-recording `RecordingMock` added to `mock_db.rs` (wraps `MockDatabaseTrait`, captures every statement's SQL + bind values). Four new test files — `repos_submission.rs` (17), `repos_orgs.rs` (12), `repos_people.rs` (11), `repos_financials.rs` (16) — assert on **generated SQL** (tenant `IN` filters, the approved↔submitted OR special case, ORDER BY) and **bind values**, plus guards (empty-vec never queries, dedup before insert) and mock-row round-trips. **Counts after Sprint 3: BE 522 total.** `cargo clippy -D warnings` clean.

**Sprint 4 — Priority 1 integration tests + CI coverage gates (Sept 16, 2026):**

- **Handler integration tests (+41 tests across 5 files)**:
  - `handlers_submission.rs` (19): auth guards for all submission endpoints, DTO conversions (`SubmissionResponse::from`, `with_fs`, `with_sections`), period validation (yearly/quarterly/monthly), enum serde roundtrips
  - `handlers_financial.rs` (10): auth guards for financial statement, upload, extraction, questionnaire endpoints + DTO conversions
  - `handlers_extraction.rs` (4): extraction job auth guards + terminal status logic
  - `handlers_questionnaire.rs` (2): questionnaire auth guards
  - `handlers_upload.rs` (6): upload auth guards + `UploadResponse` DTO serialization
- **Repository tests (+23 tests across 4 files)**:
  - `repos_submission_review.rs` (4): scope, empty, ordering, tier filter
  - `repos_submission_section.rs` (7): empty guard, scope, update, not-found, section models (questionnaire=1, upload=6)
  - `repos_extraction_job.rs` (6): scope, empty, update, not-found, DB failure
  - `repos_uploaded_file.rs` (6): scope, delegation, empty, find_by_id, DB failure
- **CI coverage gates**:
  - **Backend**: `cargo-tarpaulin` installed in CI with `--fail-under 70` (70% line coverage gate)
  - **Frontend**: `vitest.config.ts` thresholds set just below baseline (lines: 10, functions: 40, branches: 45, statements: 10) with `perFile: false` so untested files don't block the build
  - Both upload coverage reports as artifacts (retention: 30 days)
- **Counts after Sprint 4**: BE 586 total (356 inline + 230 integration). `cargo clippy -D warnings` clean.

### Verified State Snapshot (Sept 16, 2026)

| Dimension | Frontend | Backend |
|---|---|---|
| **Tests passing** | 465 / 31 files (vitest run: green) | 586 (`cargo test`: 356 inline + 230 integration, green) |
| **Measured coverage** | 11.15% lines (v8, `src/**` only) | Measured via `cargo-tarpaulin` in CI |
| **Coverage enforced in CI** | ✅ Yes — `vitest.config.ts` thresholds (lines: 10, functions: 40, branches: 45, statements: 10, `perFile: false`) | ✅ Yes — `cargo-tarpaulin --fail-under 70` |
| **CI config** | `.github/workflows/ci-frontend.yml` L131 (`npm run coverage`) | `.github/workflows/ci-backend.yml` L95 (`cargo tarpaulin --fail-under 70`) |

### Frontend Coverage by Area (measured, lowest first)

| Area | Line % | Lines hit/total | Notes |
|---|---|---|---|
| `src/routes` | 0.0% | 0/924 | TanStack Router route files — thin wrappers, low unit-test value (covered by Playwright) |
| `src/pages` | 2.2% | 518/23,973 | Only SettingsPage, QuestionnaireWizard tested |
| `src/hooks` | 5.4% | 292/5,449 | ~50 hooks, 7 tested |
| `src/components` | 12.0% | 2,295/19,091 | Excludes shadcn `ui/`; analytics has 3 test files |
| `src/lib` | 43.3% | 1,213/2,802 | Gaps: `report-export.ts` (538 L), `contentLocalization.ts` (158 L), `nf-parse-errors.ts` (92 L) |
| `src/services/shared` | 51.7% | 662/1,281 | `offlineSeeder.ts` untested |
| `src/context` | 85.9% | 354/412 | `AuthContext.inactivity` tested; theme/lib not isolated |
| `src/constants` | 100% | 168/168 | roles.ts fully covered |

### Backend Untested Critical Files (verified line counts)

| File | Lines | Tests | Risk |
|---|---|---|---|
| `services/report_narrative.rs` | 2,876 | 0 | 🔴 AI narrative generation |
| `services/submission_workflow.rs` | 1,266 | 0 | 🔴 State machine: submit/approve/reject — core business flow |
| `services/export_generator.rs` | 1,059 | 0 | 🔴 Excel/PDF compliance output |
| `services/extraction_pipeline.rs` | 453 | 0 | 🔴 AI extraction orchestration |
| `services/abnormality_detector/flags.rs` | 926 | 0 | 🟡 Anomaly detection (calculations.rs + sum_checks.rs also 0) |
| `services/audit.rs` | 79 | 0 | 🟡 Audit write path |
| `auth/tenant_isolation.rs` | 128 | 0 | 🔴 Multi-tenant data isolation — security-critical |
| `repositories/*` | 31 files | 1 (submission has a single test) | 🔴 Entire data layer; integration TestApp uses a disconnected DB, so repos are never really exercised |

**Note:** the backend `TestApp` (`tests/common/mock.rs`) historically built with a disconnected `DatabaseConnection` — the original integration tests were DB-free (auth/RBAC/validation paths only). Since Sept 16, `TestApp::with_db` accepts any connection and `tests/common/mock_db.rs` provides a SeaORM `MockDatabase`-backed `AppState` (+ mock Keycloak), so repository query sequences and the submission workflow's transitions are now executed by `tests/tenant_isolation.rs` and `tests/submission_workflow.rs`. Real-Postgres coverage (actual SQL correctness) still requires a testcontainer-based suite.

---

## Frontend — Coverage Map

### ✅ Well Tested (28 test files, 401 tests)

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
| `src/lib/utils.ts` | 6 | `cn()` used everywhere for class merging — ✅ done (13 tests) | ⭐ Trivial |
| `src/lib/kpi-calculations.ts` | 887 | All dashboard KPIs computed here — silent breakage = wrong numbers — ✅ done (52 tests) | ⭐⭐⭐ High |
| `src/lib/financial-data.ts` | 17,717 | Balance sheet calculations, loan portfolio, deposits — ✅ done (37 tests) | ⭐⭐⭐ High |
| `src/lib/report-export.ts` | 538 | Excel/PDF export — broken export = compliance failure | ⭐⭐⭐ High |
| `src/lib/contentLocalization.ts` | 158 | i18n string lookups — broken = wrong language | ⭐⭐ Medium |
| `src/lib/nf-parse-errors.ts` | 92 | Parse error mapping for NF uploads | ⭐ Easy |
| `src/lib/theme.tsx` | 2,517 | Theme configuration | ⭐⭐ Medium |
| `src/lib/mock-data.ts` | 1,134 | Test data factory — low value to unit test directly | ⭐ Skip |

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

> **How to tackle it (agreed approach):** work top-down by risk, not for coverage percentage. Order of attack:
> 1. **Security & correctness first** — `tenant_isolation.rs`, `submission_workflow.rs`, `abnormality_detector/` (backend); `report-export.ts`, `contentLocalization.ts` (frontend lib).
> 2. **Then the data layer** — pick repo strategy (MockDatabase vs real test DB), cover top 10 repositories.
> 3. **Then breadth** — high-usage hooks (submissions, analytics), then components/pages as E2E safety nets grow.
> 4. **Ratchet CI in parallel** — after each phase, raise the coverage threshold so numbers can only go up.

### 🔴 Phase 1: Quick Wins (1-2 days)

**Goal:** Build momentum with easy, high-value tests. No mocking needed.

- [x] **Frontend:** Write tests for `src/lib/utils.ts` — `cn()` function (trivial, 13 tests) ✅
- [x] **Frontend:** Write tests for `src/lib/kpi-calculations.ts` — KPI calculation functions (52 tests) ✅
- [x] **Frontend:** Write tests for `src/lib/financial-data.ts` — Balance sheet calculations (37 tests) ✅
- [x] **Frontend:** Write tests for `src/lib/contentLocalization.ts` — i18n lookups (30 tests) ✅ (Sept 16)
- [x] **Frontend:** Write tests for `src/lib/report-export.ts` — Export logic (27 tests) ✅ (Sept 16)
- [x] **Frontend:** Write tests for `src/lib/nf-parse-errors.ts` — parse error mapping (7 tests) ✅ (Sept 16)
- [x] **Backend:** Write unit tests for `src/services/cache.rs` — Cache service with `memory://` backend (14 tests) ✅
- [x] **Frontend:** Fix vitest coverage `include`/`exclude` so reports measure `src/**` only ✅ (Sept 16)
- [ ] **Frontend:** Add coverage thresholds to `vitest.config.ts` (start at current baseline +2%, ratchet up)
- [ ] **Backend:** Add `cargo-llvm-cov` to CI pipeline + record a baseline number

### 🔴 Phase 2: Core Business Logic (3-5 days)

**Goal:** Cover the highest-risk business logic in both frontend and backend.

- [x] **Frontend:** Write tests for `useOfflineQuery` — online, offline, cache-hit, cache-miss, sync scenarios (critical, 15-20 tests) ✅
- [x] **Frontend:** Write tests for `useNetworkStatus` — online/offline detection (medium, 5-10 tests) ✅
- [x] **Frontend:** Write tests for `OrganizationLabelsContext` — shared state management (medium, 10-15 tests) ✅
- [x] **Backend:** Write unit tests for `src/auth/tenant_isolation.rs` — **security-critical, done** (9 tests via MockDatabase + mock Keycloak) ✅ (Sept 16)
- [x] **Backend:** Write unit tests for `src/services/submission_workflow.rs` — submit, approve, reject, flag state machine (19 tests incl. illegal-transition guards) ✅ (Sept 16)
- [x] **Backend:** Write unit tests for `src/services/abnormality_detector/` — calculations, flags, sum_checks (67 tests) ✅ (Sept 16)
- [ ] **Backend:** Write unit tests for `src/services/export_generator.rs` — report generation (high impact, 15-20 tests)
- [x] **Backend:** Write unit tests for `src/services/object_storage.rs` — S3/local storage (medium, 10-15 tests) ✅
- [x] **Backend:** Write unit tests for `src/services/pdf_templates.rs` — PDF templates (medium, 5-10 tests) ✅
- [ ] **Backend:** Expand tests for `src/services/nf_excel_parser.rs` — Excel parsing (15 tests today, target 30+)

### 🟡 Phase 3: Repository & Handler Coverage (1-2 weeks)

**Goal:** Systematic coverage of the data layer and API endpoints.

> **Reality check (Sept 16):** the shared `TestApp` uses a disconnected DB, so integration tests can never exercise repositories. **Decision (Sept 16):** use **SeaORM `MockDatabase`** — the Sprint 2 `Database` newtype made the mock feature usable, and a statement-recording wrapper lets tests assert on the *generated SQL* (filters, tenant scoping, ORDER BY) plus bind values. Real-Postgres smoke tests fold into Phase 5/CI work later. Implementation notes live in `backend/tests/common/mock_db.rs`.

- [x] **Decide** repo test strategy — **MockDatabase + statement recording**, documented in `tests/common/mock_db.rs` ✅ (Sept 16)
- [x] **Backend:** Write unit tests for top 10 repositories (58 tests, SQL + bind assertions): ✅ (Sept 16)
  1. `submission.rs` → `tests/repos_submission.rs` (17 tests: tenant filter in SQL, `find_by_status` approved↔submitted OR, empty-vec guards never query)
  2. `cooperative.rs`, `federation.rs`, `apex.rs` → `tests/repos_orgs.rs` (12 tests)
  3. `member.rs`, `user.rs` → `tests/repos_people.rs` (11 tests: stats buckets, `bulk_upsert` dedup, metadata merge)
  4. `financial_statement.rs`, `balance_sheet_line_item.rs`, `loan.rs`, `savings_account.rs` → `tests/repos_financials.rs` (16 tests: validation-errors JSON bind, DPD portfolio mapping, dedup, deletes)
  5. `user.rs` covered in `repos_people.rs`
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