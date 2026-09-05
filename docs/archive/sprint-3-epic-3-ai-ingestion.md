# Sprint 3 — Epic 3: AI-Powered Financial Statement Ingestion & Standardization (REVISED)

> **Source of truth**: `docs/architecture/architecture.md`, `docs/architecture/database-schema.md`, `docs/archive/ticket-2-ai-extraction-pipeline.md`
> **Status**: Ready for implementation
> **Date**: 2026-07-14

---

## What's Already Built (Do Not Rebuild)

### Backend — Fully Implemented
| Component | File | Status |
|-----------|------|--------|
| Multipart upload handler | `backend/src/api/handlers/upload.rs` | ✅ Complete |
| AI extraction service trait + LLM impl + MockExtractor | `backend/src/services/ai_extraction.rs` | ✅ Complete |
| Extraction pipeline orchestrator | `backend/src/services/extraction_pipeline.rs` | ✅ Complete |
| Extraction job handler (poll) | `backend/src/api/handlers/extraction.rs` | ✅ Complete |
| Financial statement handler (get, list line items, update line items) | `backend/src/api/handlers/financial_statement.rs` | ✅ Complete |
| Submission CRUD + state machine (create, list, get, submit, validate, approve/return/reject for all tiers) | `backend/src/api/handlers/submission.rs` | ✅ Complete |
| Abnormality detector (balance check, roll-up reconciliation, missing codes, confidence flags) | `backend/src/services/abnormality_detector.rs` | ✅ Complete |
| Submission workflow service (state machine transitions) | `backend/src/services/submission_workflow.rs` | ✅ Complete |
| Object storage service (local + S3 backends) | `backend/src/services/object_storage.rs` | ✅ Complete |
| All entities (submission, financial_statement, balance_sheet_line_item, extraction_job, uploaded_file, chart_of_account, account_alias, abnormality_flag, submission_review, submission_section) | `backend/src/entities/` | ✅ Complete |
| All repositories | `backend/src/repositories/` | ✅ Complete |
| All DTOs (extraction, financial, submission, upload) | `backend/src/api/dto/` | ✅ Complete |
| DB migrations 01–18 | `backend/migrations/` | ✅ Complete |

### Frontend — Fully Implemented
| Component | File | Status |
|-----------|------|--------|
| Upload widget (dropzone, polling, redirect on completion) | `frontend/src/pages/cooperative/UploadFinancialStatement.tsx` | ✅ Complete |
| `useUploadFinancialStatement` hook | `frontend/src/hooks/submissions/useUpload.ts` | ✅ Complete |
| `useExtractionJob` hook (polls every 2s) | `frontend/src/hooks/submissions/useExtractionJob.ts` | ✅ Complete |
| `useFinancialStatement` hook | `frontend/src/hooks/submissions/useFinancialStatement.ts` | ✅ Complete |
| `useSubmissions` / submission hooks | `frontend/src/hooks/submissions/useSubmissions.ts` | ✅ Complete |
| Manual financial statement form (tabbed, all sections) | `frontend/src/pages/cooperative/FinancialStatementPage.tsx` | ✅ Complete |
| KPI calculations library | `frontend/src/lib/kpi-calculations.ts` | ✅ Complete |

---

## What Needs to Be Built (Sprint 3 Scope)

The pipeline and backend are done. What's **missing** is:

1. **US3.1 — The cooperative-facing submission flow** is wired to `FinancialStatementPage` which uses only the manual form. The upload widget exists but is not connected to a real submission created via the API — it must create a submission first, then upload to it. The `DataCollectionPage` (`frontend/src/pages/cooperative/DataCollectionPage.tsx`) needs to be wired as the central entry point.

2. **US3.2 — The AI extraction editor** (`FinancialStatementEditor.tsx`) is a stub at `frontend/src/pages/cooperative/FinancialStatementEditor.tsx` — it does not connect to real API line items, does not show confidence badges, and does not allow cell editing via the real PATCH endpoint.

3. **US3.3 — CoA standardization feedback** — the editor needs to show unmapped items, allow the user to remap them via CoA dropdown, and call the backend PATCH.

4. **US3.4 — Validation panel** — the editor needs a live validation panel showing abnormality flags from the backend, a "Re-validate" button, and blocking submission when error flags remain.

---

## Tickets

---

### S3-T1 — Wire the Data Collection Entry Flow (Submission Creation + Upload)

**Epic**: US3.1 — Document Capture & Upload Layer
**Estimated effort**: 1 day
**Dependencies**: None (backend fully ready)
**Can be done in parallel with**: S3-T2, S3-T4

#### Context

`DataCollectionPage.tsx` currently exists but is either a stub or shows only the manual form. The cooperative user needs a single entry point that:
1. Creates a submission via `POST /api/v1/cooperative/submissions` (with `reporting_year`)
2. Passes the resulting `submission_id` to the upload widget
3. Redirects to the financial statement editor page once extraction completes

The `UploadFinancialStatementWidget` already accepts an optional `submissionId` prop and calls `onExtractionComplete`. The missing piece is the submission creation step before the upload.

#### Implementation Plan

**File**: `frontend/src/pages/cooperative/DataCollectionPage.tsx`

Replace the current content with a 3-step flow:

**Step 1 — Choose year**: Show a `Select` for `reporting_year` (current year and -1, -2). Show a `Select` for `currency` (SZL / USD). Show a "Start Submission" button.

**Step 2 — Upload or enter manually**: On "Start Submission", call `useCreateSubmission` mutation (`POST /api/v1/cooperative/submissions`). On success, render two cards side by side:
- Card A: `UploadFinancialStatementWidget` with `submissionId` from the created submission. `onExtractionComplete` navigates to `/app/submissions/$id`.
- Card B: "Enter Manually" — navigates to `/app/financial-statement` with the `submission_id` as a search param.

**Step 3 — If a draft submission already exists** for the chosen year: detect the 409 Conflict from the server (or prefetch via `useSubmissions`) and show "Resume existing submission" with a link to the submission detail page.

**Hook to add** in `frontend/src/hooks/submissions/useSubmissions.ts`:
```typescript
export const useCreateSubmission = () =>
  useMutation({
    mutationFn: (body: { reporting_year: number; currency?: string }) =>
      apiClient.POST("/api/v1/cooperative/submissions", { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] }),
  });
```

**Route**: `app.data-collection.tsx` — add `beforeLoad: requireRole("cooperative")` (already present, verify).

#### Expected Result
- A cooperative user lands on Data Collection, picks year, clicks "Start" — a submission is created on the backend.
- They can upload a document (triggers AI extraction) or proceed to manual entry.
- If a draft already exists, they are prompted to resume it instead of creating a duplicate.

---

### S3-T2 — AI Extraction Review Editor: Real Line Items + Confidence Badges

**Epic**: US3.2 — Generative AI Extraction Engine & US3.3 — CoA Standardization
**Estimated effort**: 2 days
**Dependencies**: S3-T1 (need a `financial_statement_id` to load)
**Can be done in parallel with**: S3-T1, S3-T4

#### Context

`frontend/src/pages/cooperative/FinancialStatementEditor.tsx` is the page a user lands on after AI extraction completes. Currently it is a stub or uses mock data. It needs to:

1. Load real line items from `GET /api/v1/cooperative/financial-statements/{id}/line-items`
2. Display them in a TanStack Table grid with confidence badges
3. Allow inline cell editing (value and account_code) which PATCHes to `PATCH /api/v1/cooperative/financial-statements/{id}/line-items`
4. Show the AI-extracted raw label alongside the mapped account name

#### Implementation Plan

**File**: `frontend/src/pages/cooperative/FinancialStatementEditor.tsx`

The page receives `financialStatementId` from the route (URL param or from `useSubmissions` data on the parent submission detail page).

**Data fetching**:
```typescript
// In useFinancialStatement.ts (add these queries if not present)
export const useLineItems = (fsId: string | undefined) =>
  useQuery({
    queryKey: ["line-items", fsId],
    queryFn: () => apiClient.GET("/api/v1/cooperative/financial-statements/{id}/line-items", {
      params: { path: { id: fsId! } },
    }),
    enabled: !!fsId,
  });

export const useUpdateLineItems = (fsId: string) =>
  useMutation({
    mutationFn: (updates: { id: string; value?: number; account_code?: number }[]) =>
      apiClient.PATCH("/api/v1/cooperative/financial-statements/{id}/line-items", {
        params: { path: { id: fsId } },
        body: { updates },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["line-items", fsId] }),
  });
```

**Table columns** (TanStack Table):

| Column | Content |
|--------|---------|
| Account Code | Editable `<Select>` from the CoA list (fetch `GET /api/v1/cooperative/chart-of-accounts` — add this endpoint if missing, or embed a static CoA list from `lib/financial-data.ts`) |
| Account Name | Read-only, derived from account code selection |
| Raw AI Label | Read-only — what the AI extracted verbatim (`raw_label` field) |
| Category | Read-only badge (assets / liabilities / equity / income / expenses) |
| Month | Read-only (0 = annual) |
| Value | Editable number input, inline. On blur → call PATCH. |
| Confidence | Color badge: ≥0.8 → green "High", 0.6–0.8 → yellow "Medium", <0.6 → red "Low" |
| Status | "Edited" badge (blue) if `manually_edited=true`; "Unmapped" badge (amber) if `account_code=null` |

**Grouping**: Group rows by `account_category` (Assets, Liabilities, Equity, Income, Expenses) with collapsible section headers and a subtotal row per section.

**Inline editing behavior**:
- Click a value cell → becomes an `<input type="number">`. On Enter or blur: call `useUpdateLineItems` with `[{ id, value }]`.
- For account code: a `<Select>` populated from the CoA. On change: call `useUpdateLineItems` with `[{ id, account_code }]`.
- Show a loading spinner on the cell while the PATCH is in-flight.
- After success, the "Edited" badge appears.

**Unmapped rows**: Rows where `account_code === null` are highlighted with an amber left border and shown in a dedicated "Unmapped Items" section at the bottom.

#### Expected Result
- User sees all AI-extracted line items with confidence indicators.
- Low-confidence cells are visually prominent (red badge, highlighted background).
- Unmapped items are grouped at the bottom with a call-to-action to assign an account code.
- Edits save to the backend in real time with optimistic UI.

---

### S3-T3 — CoA Endpoint for Account Code Selection

**Epic**: US3.3 — Unified Chart of Accounts Standardization
**Estimated effort**: 0.5 day
**Dependencies**: None
**Can be done in parallel with**: All other tickets

#### Context

S3-T2 needs to populate the "Account Code" dropdown in the editor with the list of valid CoA codes. The backend has a `ChartOfAccountsRepository` and entity. There is no public `GET /api/v1/cooperative/chart-of-accounts` endpoint yet.

#### Implementation Plan

**Backend** — add one read-only endpoint:

**File**: `backend/src/api/handlers/financial_statement.rs` — add:
```rust
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/chart-of-accounts",
    responses((status = 200, description = "Chart of accounts", body = Vec<ChartOfAccountResponse>)),
    tag = "Cooperative"
)]
pub async fn list_chart_of_accounts(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let coa = state.coa_repo.find_all().await?;
    let resp: Vec<ChartOfAccountResponse> = coa.into_iter().map(ChartOfAccountResponse::from).collect();
    Ok((StatusCode::OK, Json(resp)))
}
```

**DTO** in `backend/src/api/dto/financial.rs` — add:
```rust
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ChartOfAccountResponse {
    pub account_code: i32,
    pub account_name: String,
    pub account_category: String,
    pub is_total: bool,
    pub formula: Option<String>,
}
```

Wire to `backend/src/api/routes/cooperative.rs` — no auth required beyond JWT (read-only reference data). Register in `openapi.rs`.

**Frontend** — add hook:
```typescript
// frontend/src/hooks/submissions/useFinancialStatement.ts
export const useChartOfAccounts = () =>
  useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: () => apiClient.GET("/api/v1/cooperative/chart-of-accounts"),
    staleTime: Infinity, // CoA never changes
  });
```

#### Expected Result
- The CoA dropdown in S3-T2's editor is populated from the backend (same data the LLM uses).
- The endpoint is cached client-side forever since the CoA is immutable reference data.
- After regenerating the OpenAPI client (`npm run update-client`), the frontend types are auto-updated.

---

### S3-T4 — Validation Panel + Submit Gate

**Epic**: US3.4 — Automated Data Validation Layer
**Estimated effort**: 1 day
**Dependencies**: S3-T2 (validation panel lives inside the editor)
**Can be done in parallel with**: S3-T1, S3-T3

#### Context

The backend already runs validation during pipeline execution and on the `POST /validate-extraction` endpoint. The results are stored in `financial_statements.validation_errors` (JSONB) and `abnormality_flags`. The frontend editor needs to surface these and gate the "Submit" button.

#### Implementation Plan

**Hook** — add to `frontend/src/hooks/submissions/useSubmissions.ts`:
```typescript
export const useValidateExtraction = (submissionId: string) =>
  useMutation({
    mutationFn: () =>
      apiClient.POST("/api/v1/cooperative/submissions/{id}/validate-extraction", {
        params: { path: { id: submissionId } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-flags", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
    },
  });

export const useSubmitSubmission = (submissionId: string) =>
  useMutation({
    mutationFn: () =>
      apiClient.POST("/api/v1/cooperative/submissions/{id}/submit", {
        params: { path: { id: submissionId } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
    },
  });

export const useSubmissionFlags = (submissionId: string | undefined) =>
  useQuery({
    queryKey: ["submission-flags", submissionId],
    queryFn: () =>
      apiClient.GET("/api/v1/apex/submissions/{id}/flags", {
        params: { path: { id: submissionId! } },
      }),
    enabled: !!submissionId,
  });
```

**Validation Panel component** — `frontend/src/components/submissions/submission-review-panel.tsx` already exists. Extend it or create `frontend/src/components/submissions/ValidationPanel.tsx`:

The panel renders:
- A summary bar: `N errors (red)` · `M warnings (yellow)` · "Re-validate" button
- Each flag as an expandable row: rule name, severity badge, message, field reference
- If 0 errors and 0 warnings: a green "All checks passed" banner
- "Submit to Apex" button — **disabled** if there are any `error`-severity flags. Enabled otherwise (warnings are allowed).

**Integration in `FinancialStatementEditor.tsx`**:

- Render the `ValidationPanel` as a sticky sidebar (desktop) or collapsible accordion (mobile) below the table.
- "Re-validate" button calls `useValidateExtraction` and shows a loading spinner.
- "Submit to Apex" button calls `useSubmitSubmission`. On success: navigate to the submission detail page with a `toast.success("Submission sent to Apex for review")`.

**Specific flag messages to display** (from the detector):

| Rule ID | Severity | User-facing message |
|---------|----------|---------------------|
| `BALANCE_UNBALANCED` | error | "Balance sheet doesn't balance: Assets ({X}) ≠ Liabilities + Equity ({Y}). Difference: {Z}" |
| `TOTAL_MISMATCH` | error | "Total mismatch for account {code}: computed {X}, extracted {Y}" |
| `MISSING_ACCOUNT` | error | "Required account {code} ({name}) is missing for your cooperative type" |
| `LOW_EXTRACTION_CONFIDENCE` | warning | "{N} line items have low AI confidence (<60%). Review highlighted cells." |
| `UNMAPPED_ACCOUNT` | warning | "{N} items could not be mapped to the Chart of Accounts. Assign account codes manually." |

#### Expected Result
- After extraction, the user sees exactly what the AI flagged before submitting.
- "Re-validate" re-runs Stage 3 after user edits.
- "Submit" is blocked until all errors are resolved. Warnings show but don't block.
- On successful submit, the submission moves to `apex_review` and the user sees a confirmation.

---

### S3-T5 — Submission Detail Page: Full Status + Review History

**Epic**: US3.2 / US3.4 (supporting)
**Estimated effort**: 1 day
**Dependencies**: S3-T1, S3-T2
**Can be done in parallel with**: S3-T3

#### Context

`frontend/src/pages/shared/SubmissionDetailPage.tsx` exists but needs to connect to real API data. After submission, users (at all tiers) need to see the current status, review history, and action buttons appropriate to their role.

#### Implementation Plan

**File**: `frontend/src/pages/shared/SubmissionDetailPage.tsx`

Use `useSubmission(id)` (already exists in `useSubmissions.ts`) to load the submission.

**Sections to render**:

1. **Status banner** — large colored badge showing current `status` (draft / submitted / apex_review / etc.) and `current_tier`. For cooperative: also show `financial_statement_id` + "View/Edit Data" link.

2. **Submission sections checklist** — render each section from `submission.sections[]`:
   - `financial` section: status badge (pending / in_progress / complete). Link to the financial statement editor if status is `in_progress`.
   - Other sections (non-financial): link to their respective pages.

3. **AI Extraction status** — if `extraction_job_id` exists, show the job status from `useExtractionJob(job_id)`. Link to the editor once `succeeded`.

4. **Review history** — list of `submission_reviews` (append-only audit). Each row: tier badge, action badge, reviewer (ID), timestamp, comment.
   - Hook: `useSubmissionReviews(submissionId)` → `GET /api/v1/{role}/submissions/{id}` already returns sections; add a reviews endpoint or derive from the submission detail.

5. **Action buttons** — role-gated:
   - `cooperative` + status `draft`: "Upload Document", "Enter Manually", "Delete Draft"
   - `cooperative` + status `awaiting_coop_validation` or `apex_returned`: "Review & Validate", "Re-upload"
   - `apex` + status `apex_review`: "Approve → Federation", "Return to Cooperative" (calls `useApexApprove` / `useApexReturn`)
   - `federation` + status `federation_review`: "Approve → Ministry", "Return to Apex"
   - `ministry` + status `ministry_review`: "Final Approve", "Reject"

**Hooks to add** in `useReviewSubmissions.ts`:
```typescript
export const useApexApprove = (submissionId: string) =>
  useMutation({ mutationFn: (comment?: string) =>
    apiClient.POST("/api/v1/apex/submissions/{id}/approve", {
      params: { path: { id: submissionId } },
      body: { comment },
    })
  });
// similar for apex_return, federation_approve, federation_return, ministry_approve, ministry_reject
```

#### Expected Result
- Any user at any tier can see exactly where their submission is in the pipeline.
- Reviewers can approve/return without leaving the page.
- The review history gives a full audit trail.

---

## Sprint 3 Ticket Summary

| Ticket | User Story | Effort | Parallel With |
|--------|-----------|--------|---------------|
| S3-T1 | US3.1 — Submission creation + upload entry flow | 1 day | S3-T2, S3-T4 |
| S3-T2 | US3.2/3.3 — AI extraction editor (real data, confidence, inline edit) | 2 days | S3-T1, S3-T4 |
| S3-T3 | US3.3 — CoA endpoint for account code dropdown | 0.5 day | All |
| S3-T4 | US3.4 — Validation panel + submit gate | 1 day | S3-T1, S3-T3 |
| S3-T5 | US3.1/3.2 — Submission detail page (status + reviews + actions) | 1 day | S3-T3 |

**Total estimated**: ~5.5 days of frontend work. No backend changes required except S3-T3 (0.5 day backend).

**Critical path**: S3-T3 → S3-T2 → S3-T4. S3-T1 and S3-T5 can be done concurrently by a second developer.
