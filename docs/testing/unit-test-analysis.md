# Unit Test Deep Dive — CoopData Project

> **Date:** August 31, 2026
> **Status:** Current state analysis + improvement roadmap

---

## Current State Summary

| Metric | Frontend | Backend |
|---|---|---|
| **Test files** | 18 | 8 integration + 29 inline modules |
| **Total tests** | 236 (all passing ✅) | ~200+ (needs verification) |
| **Framework** | Vitest + Testing Library | tokio::test + tower |
| **Coverage tool** | `@vitest/coverage-v8` (configured) | None configured |

---

## Frontend — What's Well Tested ✅

- **Auth layer**: `authService.test.ts` (18+ tests), `AuthContext.test.tsx` (14 tests), route guards (23 tests), roles (39 tests)
- **Offline/offline-first**: `offlineCache.test.ts`, `offlineDb.test.ts`, `syncQueueService.test.ts`
- **Analytics components**: `BenchmarkInsightPanel`, `BasicCooperativeComparison`, `CooperativeComparison`
- **Hooks (partial)**: `useLatestSubmission`, `useVerifyIdentity`, `useSecuritySettings`
- **UI components**: `ProtectedRoute`, `DeleteConfirmationDialog`, `ResetMfaDialog`

---

## Frontend — Critical Gaps ❌

| Category | Untested Files | Priority |
|---|---|---|
| **Hooks** | `useOrganizations.ts`, `useOfflineQuery.ts`, `useNetworkStatus.ts`, ALL federation/apex/cooperative/submission hooks | 🔴 High |
| **Context** | `OrganizationLabelsContext.tsx` | 🔴 High |
| **Lib utilities** | `utils.ts`, `financial-data.ts`, `kpi-calculations.ts`, `report-export.ts`, `contentLocalization.ts`, `theme.tsx` | 🔴 High |
| **Shared components** | `app-shell.tsx`, `kpi-summary.tsx`, `financial-kpi-widget.tsx` | 🟡 Medium |
| **Pages** | ALL ministry/federation/apex/cooperative pages (only `SettingsPage` tested) | 🟡 Medium |
| **Services** | `offlineSeeder.ts` (partially mocked but not tested) | 🟡 Medium |
| **Forms/Tables** | No form validation logic tests, no table utility tests | 🟡 Medium |

---

## Backend — What's Well Tested ✅

- **Error handling**: `error.rs` — all error variants and status codes
- **Auth**: `middleware.rs`, `rbac.rs`, `claims.rs` — role checking, RBAC
- **DTOs**: Serialization/deserialization for `cooperative`, `federation`, `apex`, `organization`, `audit`, `member`, `financial`, `user`, `verification`, `common`
- **Services (partial)**: `benchmark.rs` (differential privacy), `verification_token.rs`, `localization.rs`, `kpi_engine.rs`, `nf_indicator_engine.rs`, `nf_excel_parser.rs`, `keycloak.rs`
- **Handler inline tests**: `basic_benchmark.rs`, `organization_label.rs`, `non_financial.rs`, `users.rs`
- **Integration tests**: `handlers_users.rs`, `handlers_verify_identity.rs`, `handlers_audit.rs`, `handlers_cooperative.rs`, `handlers_benchmark.rs`

---

## Backend — Critical Gaps ❌

| Category | Untested Modules | Priority |
|---|---|---|
| **Repositories** | ALL 32 repositories (zero unit tests) | 🔴 High |
| **Services** | `cache.rs`, `export_generator.rs`, `pdf_templates.rs`, `report_narrative.rs`, `object_storage.rs`, `ai_extraction.rs`, `extraction_pipeline.rs`, `submission_workflow.rs`, `abnormality_detector/` | 🔴 High |
| **Handlers** | `federation.rs`, `apex.rs`, `submission.rs`, `cooperative.rs`, `export.rs`, `upload.rs`, `me.rs`, `questionnaire.rs`, `questionnaire_template.rs`, `extraction.rs`, `national_overview.rs`, `financial_statement.rs` | 🔴 High |
| **Auth** | `JwtValidator` core validation, `jwt_validator.rs` | 🟡 Medium |
| **Config** | Only 1 test for `test_config()` | 🟡 Medium |
| **Integration tests** | Missing for: federations CRUD, apexes CRUD, submissions CRUD, questionnaire CRUD, exports, uploads | 🟡 Medium |

---

## Top Recommendations (Prioritized)

### 1. 🔴 Backend Repositories — Biggest Gap

All 32 repositories have **zero tests**. These are pure database query layers — perfect for unit testing with a mock `DatabaseConnection`. Even testing error paths and query construction would be valuable.

**Affected files:**
- `src/repositories/member.rs`
- `src/repositories/non_financial_indicator_catalog.rs`
- `src/repositories/fixed_deposit.rs`
- `src/repositories/assessment.rs`
- `src/repositories/submission_section.rs`
- `src/repositories/questionnaire.rs`
- `src/repositories/ministry_report_narratives.rs`
- `src/repositories/cooperative.rs`
- `src/repositories/abnormality_flag.rs`
- `src/repositories/custom_kpi_repository.rs`
- `src/repositories/apex.rs`
- `src/repositories/kpi_record.rs`
- `src/repositories/uploaded_file.rs`
- `src/repositories/extraction_job.rs`
- `src/repositories/audit_log.rs`
- `src/repositories/user.rs`
- `src/repositories/financial_statement.rs`
- `src/repositories/savings_account.rs`
- `src/repositories/organization.rs`
- `src/repositories/account_alias.rs`
- `src/repositories/farm_coop.rs`
- `src/repositories/balance_sheet_line_item.rs`
- `src/repositories/loan.rs`
- `src/repositories/chart_of_accounts.rs`
- `src/repositories/non_financial_indicator_entry.rs`
- `src/repositories/federation.rs`
- `src/repositories/organization_label.rs`
- `src/repositories/questionnaire_template.rs`
- `src/repositories/submission.rs`
- `src/repositories/submission_review.rs`

### 2. 🔴 Backend Services — High Business Logic Risk

`export_generator.rs`, `kpi_engine.rs` (partially tested), `ai_extraction.rs`, `extraction_pipeline.rs`, and `submission_workflow.rs` contain critical business logic with minimal coverage.

**Affected files:**
- `src/services/cache.rs` — Caching layer (zero tests)
- `src/services/export_generator.rs` — Report export logic
- `src/services/pdf_templates.rs` — PDF template rendering
- `src/services/report_narrative.rs` — Narrative generation
- `src/services/object_storage.rs` — S3/local file storage
- `src/services/ai_extraction.rs` — AI-powered data extraction
- `src/services/extraction_pipeline.rs` — Data extraction pipeline
- `src/services/submission_workflow.rs` — Submission state machine
- `src/services/abnormality_detector/` — Anomaly detection
- `src/services/nf_excel_parser.rs` — Non-financial Excel parsing (has 1 trivial test)

### 3. 🔴 Frontend Utility Functions

`kpi-calculations.ts`, `financial-data.ts`, `utils.ts`, and `report-export.ts` are pure functions ideal for unit testing. They likely drive dashboard rendering and could silently break.

**Affected files:**
- `src/lib/utils.ts`
- `src/lib/kpi-calculations.ts`
- `src/lib/financial-data.ts`
- `src/lib/report-export.ts`
- `src/lib/contentLocalization.ts`
- `src/lib/theme.tsx`
- `src/lib/mock-data.ts`

### 4. 🔴 Frontend Custom Hooks

`useOfflineQuery` is the backbone of the offline-first architecture but has no test. The organization/federation/apex hooks are untested wrappers.

**Affected files:**
- `src/hooks/shared/useOfflineQuery.ts`
- `src/hooks/shared/useNetworkStatus.ts`
- `src/hooks/organizations/useOrganizations.ts`
- `src/hooks/federations/` — All federation hooks
- `src/hooks/apexes/` — All apex hooks
- `src/hooks/cooperatives/` — All cooperative hooks
- `src/hooks/submissions/` — All submission hooks (except `useLatestSubmission`)
- `src/hooks/users/` — All user hooks
- `src/hooks/analytics/` — All analytics hooks
- `src/hooks/settings/` — All settings hooks
- `src/hooks/audit/` — All audit hooks
- `src/hooks/admin/` — All admin hooks
- `src/hooks/non-financial/` — All non-financial hooks

### 5. 🟡 Integration Test Coverage

Backend integration tests only cover ~6 of 23 handlers. Adding tests for submissions, exports, and questionnaire flows would catch wiring bugs.

**Missing integration tests:**
- Federations CRUD (`src/api/handlers/federation.rs`)
- Apexes CRUD (`src/api/handlers/apex.rs`)
- Submissions CRUD (`src/api/handlers/submission.rs`)
- Cooperative CRUD (`src/api/handlers/cooperative.rs`)
- Exports (`src/api/handlers/export.rs`)
- Uploads (`src/api/handlers/upload.rs`)
- Me/Profile (`src/api/handlers/me.rs`)
- Questionnaires (`src/api/handlers/questionnaire.rs`)
- National Overview (`src/api/handlers/national_overview.rs`)
- Financial Statements (`src/api/handlers/financial_statement.rs`)

### 6. 🟡 No Coverage Reporting Enforced

Frontend has `@vitest/coverage-v8` installed but the coverage reporter config failed (`text` reporter not recognized — needs `"text"` as a string, not a module). Backend has no coverage tooling at all.

**Action items:**
- Fix `vitest.config.ts` coverage reporter configuration
- Add coverage thresholds (e.g., 80% lines, 70% branches)
- Consider adding `cargo-tarpaulin` or `cargo-llvm-cov` for Rust coverage
- Enforce coverage gates in CI

---

## Existing Test Files Reference

### Frontend Test Files (18)

| File | Tests | What it covers |
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
| `tests/common/mod.rs` | — | Test utilities module |
| `tests/common/mock.rs` | — | TestApp builder, test config |

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
| `src/services/nf_excel_parser.rs` | Excel parsing (1 trivial test) |
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
| `src/api/handlers/users.rs` | Role validation |
| `src/api/handlers/basic_benchmark.rs` | Benchmark row filtering |
| `src/api/handlers/non_financial.rs` | Empty row import handling |
| `src/api/handlers/organization_label.rs` | Allowed keys validation |

---

## Improvement Roadmap

### Phase 1: Quick Wins (1-2 days)

- [ ] Fix `vitest.config.ts` coverage reporter configuration
- [ ] Add coverage thresholds to vitest config
- [ ] Write tests for `src/lib/utils.ts` (pure functions, easy wins)
- [ ] Write tests for `src/lib/kpi-calculations.ts` (pure calculations)
- [ ] Write tests for `src/lib/financial-data.ts` (data transformations)
- [ ] Write tests for `src/lib/report-export.ts` (export logic)
- [ ] Add `cargo-llvm-cov` or `cargo-tarpaulin` to backend CI

### Phase 2: Core Business Logic (3-5 days)

- [ ] Write unit tests for `useOfflineQuery` hook
- [ ] Write unit tests for `useNetworkStatus` hook
- [ ] Write unit tests for `OrganizationLabelsContext`
- [ ] Write backend service tests for `submission_workflow.rs`
- [ ] Write backend service tests for `export_generator.rs`
- [ ] Write backend service tests for `cache.rs`
- [ ] Write backend service tests for `report_narrative.rs`

### Phase 3: Repository & Handler Coverage (1-2 weeks)

- [ ] Write unit tests for top 10 most-used repositories
- [ ] Add integration tests for federation CRUD handlers
- [ ] Add integration tests for submission CRUD handlers
- [ ] Add integration tests for export handlers
- [ ] Add integration tests for upload handlers
- [ ] Add integration tests for questionnaire handlers

### Phase 4: Coverage Enforcement (ongoing)

- [ ] Enforce 80% line coverage threshold on frontend
- [ ] Enforce 70% line coverage threshold on backend
- [ ] Add coverage gates to CI pipeline
- [ ] Create coverage dashboard/reporting
- [ ] Target 90%+ coverage on critical paths (auth, submissions, exports)
