# Epic 2: Primary Coop Core Data Modules (Level 4) — Sprint 2 Tickets

> **Epic**: Primary Coop Core Data Modules  
> **Sprint**: 2  
> **Goal**: Persist the Level 4 business-data layer (cooperative profile, membership, financial products, non-financial indicators) and stand up the 4-tier submission & review workflow end-to-end.  
> **Current State**: IAM hierarchy (Ministry → Federation → Apex → Cooperative) is live with Keycloak RBAC. The only persisted entities are `organization`, `user`, and an `assessment` stub. All financial/non-financial data is frontend mock (`frontend/src/lib/financial-data.ts`). No submission workflow, no KPI engine, no AI extraction.

---

## Way of Working: Vertical Slices (backend-led this sprint)

Each ticket is a **vertical slice** — one person owns both backend and frontend for their feature. This sprint is **backend-heavy** (creating tables + the submission flow is the priority), so the FE slice in each ticket is the minimal data-entry UI needed to exercise the user story. Ticket 1 (foundation) must be done first; Tickets 2–5 then run in parallel.

```
Ticket 1 (DB & Schema Foundation) ───── must be done first
   │
   ├──→ Ticket 2 (Financial Statement & Balance Sheet) ──┐
   ├──→ Ticket 3 (Membership Database) US2.2 ─────────────┤── parallel after T1
   ├──→ Ticket 4 (Member Savings, Fixed Deposits, Loans)─┤
   └──→ Ticket 5 (Non-Financial Information Ledger) US2.4─┘
                                                              │
                         Ticket 6 (Submission Workflow & E2E) ┘ integrates T2–T5
```

**Each person is responsible for:**
- Backend: migration, SeaORM entity, repository, DTOs (with validation), handler(s) with `#[utoipa::path]`, routes, OpenAPI registration
- Frontend: minimal data-entry page + hook(s) for their feature, wired to the real API (never `fetch`/`axios` — use the generated `openapi-client`)
- Follow `docs/architecture/architecture.md` exact layering: Route → Handler → Repository → Database. **Never skip layers.**

> **Reference docs**: `docs/architecture/architecture.md` (source of truth), `docs/architecture/docs/architecture/database-schema.md` (table-by-table reference), `AGENTS.md` Rust knowledge docs.

---

## Ticket 1: Database & Schema Foundation — Enums, Chart of Accounts Seed, Cooperative Profile, Submission Envelope

### Title
Establish the persistence foundation: PostgreSQL enums, seeded chart of accounts, `cooperatives` registration (US2.1), and the submission-envelope tables (`submissions`, `submission_reviews`, `uploaded_files`, `extraction_jobs`)

### Estimate
**Story Points:** 13  
**Estimated Time:** 20–26 hours

### Labels
`backend`, `frontend`, `foundation`, `epic-2`, `schema`, `us2.1`

### Description
This is the foundation ticket that must be completed before any data-module ticket can begin. It creates the SeaORM-migration infrastructure, all `submission_status`/`review_tier`/`account_category`/`cooperative_type`/… enum types, seeds the canonical ADORSYS chart of accounts (from `frontend/src/lib/financial-data.ts` constants) plus the per-coop-type applicability matrix, implements the `cooperatives` registration vertical (US2.1), and creates the submission-envelope tables + entities so the parallel tickets have their FK parents.

**Backend scope:**
- Create `backend/src/migration/` dir + SeaORM-migration files in dependency order (§13 of architecture.md)
- Define all PostgreSQL enum types (D5 `per architecture.md` §6.2)
- Seed `chart_of_accounts` + `chart_of_accounts_coop_types` from the ACCOUNT_CODES constants
- `cooperatives` entity/repo/DTO/handler/routes (US2.1 profile: name, institution_type, reg_no, tin, address, georeference, region, geographic_classif, phone, sector, registered_on, accounting_year)
- `submissions`, `submission_reviews`, `uploaded_files`, `extraction_jobs` entities + repositories (CRUD only — workflow logic is Ticket 6)
- Sync-on-create hook: when Apex creates a cooperative in Keycloak, upsert the local `cooperatives` row keyed by `keycloak_group_id`

**Frontend scope (minimal):**
- Cooperative profile create/read form (`src/pages/cooperative/CooperativeProfile.tsx`) wired via `useCooperative` hook
- Profession-level `reg_no` uniqueness inline validation + georeference (lat,long) input
- Role-protect under `cooperative`/`apex`

### Requirements

#### Backend — Migrations & Enums
- Create migration crate/dir with SeaORM-migration entrypoint
- Migration `m1`: enum types (all 16 from `docs/architecture/database-schema.md` §4, minus removed `compliance_status`)
- Migration `m2`: `chart_of_accounts` + `chart_of_accounts_coop_types` + seed rows derived from `ACCOUNT_CODES` in `financial-data.ts`
- Migration `m3`: `cooperatives`
- Migration `m4`: `submissions` (no `type` column — annual envelope), `submission_reviews`, `uploaded_files`, `extraction_jobs`
- Migration `m9`: indexes per §6.11
- Migrations run as a separate startup step (Twelve-Factor XII)

#### Backend — cooperatives vertical (US2.1)
- SeaORM entity `cooperatives` (fields exactly per `docs/architecture/database-schema.md` §8.1)
- Repository: `find_by_id`, `find_by_keycloak_group_id`, `create`, `update`, `list_with_filters` — all `AppResult<T>`
- DTOs: `CreateCooperativeRequest` (validate non-empty name, valid `reg_no`, valid enum), `CooperativeResponse` with `From<entity>`
- Handler with `#[utoipa::path]` for: `POST /api/v1/cooperatives`, `GET /api/v1/cooperatives/{id}`, `PATCH /api/v1/cooperatives/{id}`, `GET /api/v1/cooperatives` (scoped list)
- Routes wired under cooperative/apex role layers; apex creates → upserts local row from KC group id
- Scope enforcement: cooperative users can only read their own; apex users scoped to `cooperative.apex_group_id = claims.apex_group_id`

#### Frontend — cooperative profile
- `useCooperative` hook (`useQuery`/`useMutation`) over generated openapi-client
- Profile form with RHF + Zod; `reg_no` uniqueness check; `georeference` lat/long inputs
- Protected route for `cooperative`/`apex`

### Acceptance Criteria

**Backend:**
- [ ] `cargo migrate` (or app-startup migration) creates all enums and tables cleanly on a fresh DB
- [ ] `chart_of_accounts` seeded with all 1000–6999 codes from `financial-data.ts`
- [ ] `chart_of_accounts_coop_types` seeded with required/active flags per cooperative type
- [ ] `cooperatives` CRUD works; `reg_no` uniqueness enforced at DB + handler
- [ ] Sync-on-create writes the local `cooperatives` row from KC group id when Apex creates a cooperative
- [ ] `submissions`/`submission_reviews`/`uploaded_files`/`extraction_jobs` tables exist with correct FKs and UNIQUE constraints
- [ ] `cargo clippy` passes; tests for cooperative repo pass

**Frontend:**
- [ ] Cooperative profile form validates and submits via real API
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **Source of truth**: `docs/architecture/architecture.md` §6 + `docs/architecture/docs/architecture/database-schema.md` §8
- **Account aliases** (`account_aliases`) from §6.6 are OPTIONAL for v1 — include the table if time permits; the LLM can map labels without it
- **`assessments` stub** (`src/entities/`) is replaced/superseded by `submissions` — keep both until Ticket 6 removes `assessments`
- Follow `docs/knowledge/rust/rust-entities.md`, `rust-migrations` patterns, `rust-api-handlers.md`

---

## Ticket 2: Financial Statement & Balance Sheet — Monthly Grid Ingestion & Validation (US2.3 financial reporting)

### Title
Implement `financial_statements` + `balance_sheet_line_items` with monthly-grid DTOs, rollup/balance validation, and upload placeholder wiring

### Estimate
**Story Points:** 13  
**Estimated Time:** 20–26 hours

### Labels
`backend`, `frontend`, `feature`, `epic-2`, `financial`, `us2.3`

### Description
A cooperative reports a full-year balance sheet as a 12-month grid. This ticket persists that grid as cells (`balance_sheet_line_items`: one row per account_code × month), validates them against the seeded `chart_of_accounts` (balance identity, rollup formulas, missing required codes per coop type), and exposes CRUD + a draft-validate endpoint. AI extraction wiring (upload → extraction job → auto-fill) is **stubbed** here and fully engineered in a later sprint; this ticket ensures the data shape and validation are correct.

**Backend scope:**
- `financial_statements` + `balance_sheet_line_items` entities/repositories
- DTOs: `FinancialStatementResponse`, `LineItemCell` (account_code, month, value, ai_confidence…), `UpsertLineItemsRequest`
- Validation service (deterministic, no LLM): balance identity (`1999 == 2999 + 3999`), rollup via `chart_of_accounts.formula`, missing required codes via `chart_of_accounts_coop_types.is_required`, write errors to `financial_statements.validation_errors`
- Handlers: `GET/PATCH /api/v1/cooperative/financial-statements/{id}`, `PATCH /api/v1/cooperative/financial-statements/{id}/line-items`
- Scope enforcement: cooperative may edit only its own submissions' statements; status must allow edits (draft/awaiting_coop_validation)

**Frontend scope (minimal):**
- Balance-sheet grid editor UI (codes × 12 months) reading from `useFinancialStatement`; editable cells write via `useMutation`
- NULL vs 0 distinction in the editor (absent vs explicit-zero)
- Show validation errors panel (from `validation_errors`)

### Requirements

#### Backend
- Entities for `financial_statements` (header) and `balance_sheet_line_items` (cells) per `docs/architecture/database-schema.md` §8.5
- Repository: upsert cells by `(financial_statement_id, account_code, month)`; aggregate-by-category query for dashboards
- `balance_validation` function: iterates `chart_of_accounts.formula`, computes totals, compares to reported totals, checks required codes for the cooperative's `institution_type`, returns `Vec<ValidationError>` written to `validation_errors`
- `is_validated` set true only when zero error-severity issues remain
- `#[utoipa::path]` annotations; register schemas in OpenAPI

#### Frontend
- `useFinancialStatement` (`useQuery`) + `useUpsertLineItems` (`useMutation`)
- Grid table component (TanStack Table or custom) with 12 month columns; account rows grouped by `account_category`
- Validation errors rendered inline per cell + a summary panel
- Role-protect for `cooperative`

### Acceptance Criteria

**Backend:**
- [ ] Balance sheet can be created for a submission and cells upserted per code×month
- [ ] `UNIQUE (financial_statement_id, account_code, month)` enforced
- [ ] Rollup validation catches a broken total (manual test: inject mismatched 1100)
- [ ] Required-code check flags `MISSING_ACCOUNT` for the coop's type
- [ ] `is_validated` flips to true only when errors resolve
- [ ] Scope enforcement blocks cross-coop edits
- [ ] `cargo clippy` + repo unit tests pass

**Frontend:**
- [ ] Grid editor reads/writes real API; NULL vs 0 distinguishable
- [ ] Validation errors surface in UI
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **Source**: `docs/architecture/architecture.md` §4.5 (validation layer), §6.6b, `docs/architecture/database-schema.md` §8.5
- AI extraction auto-fill is **out of scope** — leave a clean hook (`extraction_jobs` → `balance_sheet_line_items`) for the next sprint
- Use `rust_decimal`/`sea_query::Expr` for exact-numeric rollups; never floats
- Depends on: Ticket 1 (chart of accounts + submissions)

---

## Ticket 3: Membership Database Management (US2.2) — `members`

### Title
Record and manage membership with mandatory demographic coding (gender, age group, youth/women/rural participation, governance)

### Estimate
**Story Points:** 8  
**Estimated Time:** 12–16 hours

### Labels
`backend`, `frontend`, `feature`, `epic-2`, `members`, `us2.2`

### Description
US2.2 requires a primary coop to record and manage membership details with mandatory demographic coding so inclusion-based progress can be tracked. This ticket implements the `members` table vertical: entity, repo, DTOs with mandatory demographic validation, handlers, and a member-roster data-entry UI.

**Backend scope:**
- `members` entity + repository (per §8.7) — scoped to cooperative + submission
- DTOs: `CreateMemberRequest`, `MemberResponse`; mandatory fields: `gender`, `age_group`, `urban_rural`, `join_date` (validate all non-empty)
- Soft-delete via `status='Exited'` + `exit_date` (validate `exit_date >= join_date` → else `EXIT_BEFORE_JOIN` abnormality)
- Handlers: `POST/GET/PATCH /api/v1/cooperative/submissions/{subId}/members`, `DELETE` (soft) → set status
- `UNIQUE (cooperative_id, member_id)` enforced

**Frontend scope (minimal):**
- Member roster table (TanStack Table) with add/edit dialog (RHF + Zod)
- Mandatory demographic dropdowns (gender, age_group, urban_rural) cannot be left blank
- Exit action sets `status='Exited'` + exit_date

### Acceptance Criteria

**Backend:**
- [ ] Members can be created/read/updated for a submission, scoped to the cooperative
- [ ] Mandatory demographic fields enforced (reject submissions missing gender/age_group/urban_rural)
- [ ] `exit_date < join_date` rejected with `EXIT_BEFORE_JOIN`
- [ ] `(cooperative_id, member_id)` uniqueness enforced
- [ ] Scope enforcement blocks cross-coop writes
- [ ] `cargo clippy` + repo tests pass

**Frontend:**
- [ ] Roster table with add/edit dialogs validates mandatory coding before submit
- [ ] Exit action soft-deletes correctly
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **Source**: `docs/architecture/database-schema.md` §8.7, architecture §6.8
- `member_id` is a display string (`M001`); UUID PK is the relational anchor for savings/loans/fixed_deposits (Tickets 4 uses `member_id` FK)
- Depends on: Ticket 1 (submissions exists)

---

## Ticket 4: Financial Product Databases — Savings, Fixed Deposits, Loans (US2.3)

### Title
Log and update member Savings, Fixed Deposits, and Loans outstanding with transactional/status indicators

### Estimate
**Story Points:** 13  
**Estimated Time:** 20–26 hours

### Labels
`backend`, `frontend`, `feature`, `epic-2`, `products`, `us2.3`

### Description
US2.3 asks the primary coop to log/update aggregate transactional & status indicators for Member Savings, Fixed Savings, and Loans. This ticket builds three parallel child tables — `savings_accounts`, `loans`, `fixed_deposits` — each scoped to a member within a submission, with the risk/flag fields the KPI engine and abnormality detector will later consume (DPD buckets, restructuring/early-settlement/single-depositor flags, balance trends). One person owns all three to keep their DTO/repository conventions consistent.

**Backend scope:**
- `savings_accounts`, `loans`, `fixed_deposits` entities + repositories (per §8.7)
- DTOs with validation per sheet (e.g. `loan_maturity_date >= loan_start_date` → else `MATURITY_BEFORE_START`; `loan_status=Performing` requires `days_past_due_category='0'` → else `DPD_STATUS_MISMATCH`)
- Handlers per resource under `/api/v1/cooperative/submissions/{subId}/{resource}` (resource = savings | loans | fixed_deposits)
- Each row FKs to `members.id` (created in Ticket 3) — validate the member belongs to the same cooperative

**Frontend scope (minimal):**
- Three data-entry tabs/tables (savings/loans/fixed-deposits) with add/edit dialogs
- Member picker scoped to the current submission's roster (from Ticket 3)
- DPD & loan-status consistency surfaced (inline error if Performing loan has DPD≠0)

### Acceptance Criteria

**Backend:**
- [ ] All three resources CRUD within a submission, scoped to cooperative
- [ ] `MATURITY_BEFORE_START` rejects a loan with maturity < start
- [ ] `DPD_STATUS_MISMATCH` rejects Performing loan with non-zero DPD
- [ ] Member FK validated to same cooperative
- [ ] Scope enforcement blocks cross-coop writes
- [ ] `cargo clippy` + repo tests pass

**Frontend:**
- [ ] Three tables with add/edit dialogs validate before submit
- [ ] Member picker only shows members in the current roster
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **Source**: `docs/architecture/database-schema.md` §8.7, architecture §6.8
- These tables feed non-financial KPIs (PAR30/60/90, restructured ratio, rollover rate) computed in a later sprint — make sure the flag fields (youth/women/rural borrower, restructured, single-depositor, etc.) are persisted exactly as in the schema
- Depends on: Ticket 1 (submissions) + Ticket 3 (members — for FK validation)

---

## Ticket 5: Non-Financial Information Ledger (US2.4) — periodic non-financial indicators

### Title
Submit periodic non-financial indicators (board composition, training hours, sector details)

### Estimate
**Story Points:** 8  
**Estimated Time:** 12–16 hours

### Labels
`backend`, `frontend`, `feature`, `epic-2`, `non-financial-ledger`, `us2.4`

### Description
US2.4 asks the primary coop to submit periodic non-financial indicators (board composition, training hours, sector details). The architecture's `members`/`loans`/etc. tables cover person-level non-financial data, but **cooperative-level periodic indicators** (board size, women on board, training hours, meetings held, sector specifics) are not yet modeled. This ticket adds a lightweight `non_financial_indicators` table scoped to a submission/period, plus a generic JSONB-backed indicator capture so new indicators can be added without schema migration.

**Backend scope:**
- New table `non_financial_indicators` (typed header per submission) + `non_financial_indicator_entries` (one row per indicator name/value):
  ```
  non_financial_indicators (id PK, submission_id FK, cooperative_id FK, reporting_period, period_type, created_at, updated_at, UNIQUE(submission_id))
  non_financial_indicator_entries (id PK, non_financial_indicators_id FK, indicator_name, value_numeric, value_text, unit, category, created_at, UNIQUE(non_financial_indicators_id, indicator_name))
  ```
- Seed/define indicator catalog (board_composition_total, women_on_board, youth_on_board, training_hours_total, meetings_held, sector_specifics…) as a reference table `non_financial_indicator_catalog` OR keep flexible — decide with the team
- Handlers: `GET/POST/PATCH /api/v1/cooperative/submissions/{subId}/non-financial-indicators`
- Validation: required indicators per cooperative type (mirror `chart_of_accounts_coop_types` pattern in spirit)

**Frontend scope (minimal):**
- One data-entry screen listing the indicator catalog with inputs (numeric/text per indicator)
- Categorised sections (Governance, Training, Operations, Sector)

### Acceptance Criteria

**Backend:**
- [ ] Non-financial indicators can be saved per submission, scoped to cooperative
- [ ] Adding a new indicator does not require a migration (catalog-driven or JSONB)
- [ ] Required indicators for the coop type are validated
- [ ] Scope enforcement blocks cross-coop writes
- [ ] `cargo clippy` + repo tests pass

**Frontend:**
- [ ] Data-entry screen lists all indicators with appropriate input types
- [ ] Required indicators are flagged before submit
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **This needs a design decision** before coding: typed columns vs catalog/JSONB. Recommend catalog-driven for v1 (mirrors the `chart_of_accounts` + `chart_of_accounts_coop_types` pattern) so rules are queryable.
- Update `docs/architecture/architecture.md` §6 with the new table(s) once the design is approved (per AGENTS.md "STEP 0: DESIGN FIRST")
- Depends on: Ticket 1 (submissions)

---

## Ticket 6: Submission Workflow & Review State Machine + E2E (integrates T2–T5)

### Title
Implement the 4-tier submission/review state machine, per-tier review handlers, upload + extraction-job handlers, and end-to-end flow tests

### Estimate
**Story Points:** 13  
**Estimated Time:** 20–26 hours

### Labels
`backend`, `frontend`, `testing`, `epic-2`, `workflow`

### Description
This ticket turns the submission envelope (created in T1) into a working 4-tier workflow: Cooperative validates + submits → Apex reviews (approve/return) → Federation reviews (approve/return) → Ministry approves/rejects. It centralises all status transitions in a `submission_workflow` service (no handler mutates `status` directly), appends `submission_reviews` audit rows, wires upload + extraction-job endpoints, removes the legacy `assessments` entity, and adds E2E tests covering the full journey across all data modules from T2–T5.

**Backend scope:**
- `submission_workflow` service: `match` on `(from_status, action, role)` — every legal transition validated; illegal transitions rejected with `AppError::BadRequest`
- `submission_reviews` append on every transition
- Update `submissions.status`/`current_tier`/`last_reviewed_*`; tracing event; cache invalidation
- Handlers per tier (per architecture §10):
  - Cooperative: `POST /api/v1/cooperative/submissions/{id}/validate-extraction`, `POST /api/v1/cooperative/submissions/{id}/submit`, `GET /api/v1/cooperative/submissions`, `POST /api/v1/cooperative/submissions/{id}/upload`
  - Apex: `GET /api/v1/apex/submissions`, `POST /api/v1/apex/submissions/{id}/approve|return`
  - Federation: `GET /api/v1/federation/submissions`, `POST /api/v1/federation/submissions/{id}/approve|return`
  - Ministry: `GET /api/v1/ministry/submissions`, `POST /api/v1/ministry/submissions/{id}/approve|reject`
- `uploaded_files` multipart upload handler (`POST`) + `extraction_jobs` poll handler (`GET /api/v1/cooperative/extraction-jobs/{id}`) — extraction itself stubbed (mock engine in T1)
- Remove the legacy `assessment` entity (replaced by `submissions`)

**Frontend scope (minimal):**
- Submission list per tier + a submission-detail view showing sections (financial, members, savings, loans, fixed deposits, non-financial ledger) populated by T2–T5
- Review actions bar per tier (validate/submit/approve/return/reject) wired to the workflow service
- Submission-reviews history timeline
- Upload + extraction-status polling UI (mock job → succeeded)

### Requirements

#### Backend
- `submission_workflow::transition(submission_id, action, reviewer_id)` — single source of truth for status changes
- Per-tier authority matrix (architecture §7.2) enforced from JWT role + scope
- Append `submission_reviews` on every transition (validate/submit/approve/return/reject/comment)
- Return granularity: Federation returns → Apex (not straight to coop); Apex returns → coop (architecture D5)
- On Ministry `approved`: stub a KPI-finalize hook (real KPI engine is a later sprint)
- Multipart upload → `uploaded_files` row + S3/MinIO key (use `object_storage` abstraction, empty impl ok)
- All handlers `#[utoipa::path]` + OpenAPI registration

#### E2E tests (backend, `#[tokio::test]`)
- Full journey: create submission (T2–T5 populate sections) → coop validate → submit → apex approve → federation approve → ministry approve → status=approved
- Return journey: apex_returned → coop reopen → resubmit
- Federation return → apex re-review
- Ministry reject → terminal rejected
- Every illegal transition (e.g. cooperative approving) rejected with 403/400
- Audit trail: `submission_reviews` length matches the number of transitions
- Scope enforcement: apex A cannot approve apex B's submission

### Acceptance Criteria

**Backend:**
- [ ] State machine only permits transitions in the authority matrix; all others rejected
- [ ] Every transition appends a `submission_reviews` row with correct tier/action/reviewer
- [ ] Return granularity correct (federation→apex, apex→coop)
- [ ] Ministry `approved` is terminal + triggers KPI-finalize stub
- [ ] Multipart upload creates an `uploaded_files` row; poll returns job status
- [ ] `assessment` entity removed; no compile references remain
- [ ] `cargo clippy` + `cargo test` pass
- [ ] OpenAPI spec includes all workflow endpoints with role requirements

**Frontend:**
- [ ] Each tier sees only submissions in its `*_review`/`*_returned` status, scoped
- [ ] Review actions call real workflow endpoints; status updates reflect in UI
- [ ] Reviews timeline renders the audit trail
- [ ] Upload + poll UI shows extraction status
- [ ] `npm run lint` + `typecheck` pass

### Technical Notes
- **Source**: `docs/architecture/architecture.md` §3, §7 (state machine + authority matrix), §10 (API surface), `docs/architecture/database-schema.md` §8.2, §8.3, §8.6
- Cache invalidation on every transition: key pattern `"submission:{id}"`
- Worktree the KPI finalize as an empty trait method (`kpi_engine.on_submission_approved(submission_id)`) so the later sprint plugs in without touching workflow code
- Depends on: Tickets 1–5 (submission envelope + all data sections present so E2E has content to review)

---

## Summary: Sprint 2 Ticket Dependencies

```
Ticket 1 (DB & Schema Foundation) ───── must be done first
   │
   ├──→ Ticket 2 (Financial Statement & Balance Sheet) ──┐
   ├──→ Ticket 3 (Membership Database) US2.2 ─────────────┤── parallel after T1
   ├──→ Ticket 4 (Member Savings, Fixed Deposits, Loans)─┤
   └──→ Ticket 5 (Non-Financial Information Ledger) US2.4┘
                                                              │
                         Ticket 6 (Submission Workflow & E2E) ┘ integrates T2–T5
```

**Parallel tracks after T1:**
- **Track A**: Ticket 2 — Financial Statement & Balance Sheet
- **Track B**: Ticket 3 — Membership Database (US2.2)
- **Track C**: Ticket 4 — Savings, Fixed Deposits, Loans (US2.3)
- **Track D**: Ticket 5 — Non-Financial Information Ledger (US2.4)
- **Integrator**: Ticket 6 — Submission Workflow & E2E (starts after A–D deliver their sections, integrates everything)

| Ticket | Scope | US | Story Points | Est. Time | Depends On |
|--------|-------|----|-------------|-----------|------------|
| T1 | DB & Schema Foundation (enums, CoA seed, cooperatives, submission envelope) | US2.1 | 13 | 20–26h | — |
| T2 | Financial Statement & Balance Sheet (monthly grid + validation) | US2.3 (financial) | 13 | 20–26h | T1 |
| T3 | Membership Database Management | US2.2 | 8 | 12–16h | T1 |
| T4 | Member Savings, Fixed Deposits, Loans | US2.3 (products) | 13 | 20–26h | T1, T3 |
| T5 | Non-Financial Information Ledger | US2.4 | 8 | 12–16h | T1 |
| T6 | Submission Workflow & Review State Machine + E2E | — | 13 | 20–26h | T1–T5 |

**Total Story Points**: 68  
**Estimated Total Time**: 104–136 hours  
**Parallel Time (with 4 people after T1)**: ~26h (T1) + ~26h (longest parallel track) + ~26h (T6) = **~78 hours wall-clock**

---

## Mapping to User Stories

| User Story | Coverage |
|---|---|
| **US2.1** Cooperative Profile Registration | Ticket 1 (cooperatives vertical) |
| **US2.2** Membership Database Management | Ticket 3 (members) |
| **US2.3** Financial Product Databases (Savings, Fixed Savings, Loans) | Ticket 4 (savings_accounts, fixed_deposits, loans) + Ticket 2 (financial balance-sheet reporting) |
| **US2.4** Non-Financial Information Ledger | Ticket 5 (non_financial_indicators) |
| Cross-cutting submission flow | Ticket 6 (4-tier workflow + E2E) |

---

## Open Design Questions (resolve before/at ticket kickoff)

1. **`account_aliases` table** — keep for v1 (Excel fast-path + offline fallback) or drop and rely on the LLM? (Recommendation: keep seeded, lightweight.)
2. **Non-financial ledger shape** (Ticket 5) — typed columns vs catalog/JSONB? (Recommendation: catalog-driven, mirroring `chart_of_accounts_coop_types`.)
3. **`submissions.metadata` JSONB** — what type-specific extras do we actually need for v1? (Requirement in T1.)
4. **Object storage** (Ticket 6) — MinIO via existing reqwest/env, or defer and stub? (Requirement in T6 `object_storage` abstraction.)