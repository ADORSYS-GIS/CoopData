# On-demand Report Exports — Design & Implementation Plan

Status: **Implemented**
Related: ADORSYS-GIS/CoopData#207, `docs/features/multilingual-report-exports.md`
Out of scope: questionnaire reports (stay English-only, unchanged).

---

## 1. Problem

Each approval runs `trigger_cooperative_export`, `trigger_apex_export`, `trigger_federation_export` and `trigger_ministry_export`
(`backend/src/api/handlers/submission.rs`). Each one translates the AI narratives into 4 languages and renders 4 PDFs.

- **Waste:** that's 16 Gotenberg renders and 3 translation runs per approval, mostly for files nobody downloads. The consolidated
  reports are rebuilt on *every* cooperative approval.
- **Race:** a download clicked while the approval job is still running starts a second, duplicate job.
- **Hidden failures:** the user sees no progress or failure. A failed translation silently returns a half-English PDF.

## 2. Goals

1. At approval, make only the **English** cooperative report: narrative and PDF.
2. Make other languages **on demand**: translate, render and store only when a user asks.
3. On approval, every level's report is refreshed **in English**: the consolidated reports (apex, federation, ministry) that the
   approval changes are deleted and rebuilt in the background. Their other languages are prepared again on request.
4. Show every report's **status** on the report page: preparing, ready or failed. Languages unlock once English is ready.
5. **Only one job** per report and language at a time, across all backend instances.
6. Errors shown to users are **generic**. Details go to the backend logs only (`tracing::error!`).
7. A job lost to a crash or restart never blocks the user: after a timeout it counts as failed and can be retried.

## 3. Report lifecycle

```
            approval (cooperative report) / "Prepare" / "Update report"
                          │
   (none) ──────────▶ preparing ──ok──▶ ready
     ▲                    │               │
     │                    └─error/timeout─▶ failed ──"Try again"──▶ preparing
     │
     └── approval deletes every consolidated report it changes and starts its English job again
```

- English is always the first language. Another language can be prepared only once English is `ready`, because it's translated
  from the stored English narrative.
- Regenerating English (for example "Update report") deletes the other languages' narratives and PDFs. They return to "not
  prepared" and are made again on request, so a stale translation is never served.
- A `preparing` row older than `REPORT_JOB_TIMEOUT_SECS` (default 600) is reported as `failed` and can be claimed again.

## 4. Backend

### 4.1 Migration: `backend/migrations/49_report_exports.sql`

Number 49. The migration runner keys on the number, and `47_dedupe_general_info_section.sql` already exists on `origin/questionaire-report`; 48 is the recreated `48_apex_drafts_at_apex_tier.sql`.

```sql
CREATE TABLE IF NOT EXISTS report_exports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_key  TEXT NOT NULL,        -- e.g. submission:{id} | apex:{id}:{year}:{variant} | federation:… | ministry:{year}:{variant}
    lang        TEXT NOT NULL,        -- en | fr | pt | ss
    status      TEXT NOT NULL,        -- preparing | ready | failed
    storage_key TEXT,                 -- PDF object key once ready
    error       TEXT,                 -- internal detail, never returned by the API
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (report_key, lang)
);
```

### 4.2 Entity and repository

- `src/entities/report_exports.rs`: the SeaORM entity, with a `ReportExportStatus` enum.
- `src/repositories/report_export_repository.rs`, all methods returning `AppResult`:
  - `claim(report_key, lang, timeout)` is the **single-flight lock**. It's one atomic statement:
    ```sql
    INSERT … VALUES (…, 'preparing') ON CONFLICT (report_key, lang) DO UPDATE
      SET status='preparing', error=NULL, started_at=now(), updated_at=now()
      WHERE report_exports.status <> 'preparing' OR report_exports.started_at < now() - $timeout
    RETURNING id
    ```
    A returned row means this caller owns the job. No row means another request is already preparing it, and the caller just
    reports the status.
  - `mark_ready(id, storage_key)`, `mark_failed(id, error)`.
  - `list(report_key)` returns the status per language.
  - `delete_languages(report_key, keep)` forgets the other languages when English is regenerated, or all of them when a
    consolidated report is invalidated.
- Register the repository in `AppState`.

### 4.3 Service: `src/services/report_jobs.rs` (new)

`export_generator.rs` is already 1,200 lines, so the job logic goes in a new service.

- `ReportTarget` enum: `Submission(id)`, `Apex{id, year, variant}`, `Federation{…}`, `Ministry{year, variant}`, with `key()` and `pdf_key(lang)`.
- `prepare(state, target, lang, regenerate) -> AppResult<ReportStatus>`:
  1. Validate: `lang` is in `EXPORT_LOCALES`, questionnaire targets accept `en` only, and non-`en` requires English `ready`.
  2. `claim`. If not claimed, return the current status.
  3. `tokio::spawn` the job, then return `preparing` straight away (the HTTP response is **202**).
- The job:
  - **English:** generate the English narrative (always fresh for consolidated reports, and when `regenerate` is set) and store `{ en }` only. Render,
    store the PDF, `mark_ready`. On regeneration, `delete_except(key, "en")` and delete those PDFs from storage.
  - **Another language:** translate only that language from the stored English (`narrative_translation::translate_one`, 3
    attempts, validation unchanged). Store it in the same `ai_narratives` JSON, render, store, `mark_ready`.
  - **Any error:** `tracing::error!(report_key, lang, error = %e, "report job failed")` and `mark_failed`. The **English
    fallback inside a translated PDF is removed**: a translation failure is now a failed job, never a half-translated file.
  - The AI semaphore is still taken once per LLM step, as today.

### 4.4 Changes to existing code

- `export_generator.rs`:
  - `trigger_cooperative_export` becomes `report_jobs::prepare(Submission(id), "en", regenerate = true)`.
  - Remove the eager all-locale paths: `store_submission_locales`, `store_consolidated_locales`, the `translate_all` call sites,
    and the `untranslated` / `report_locales` / `cacheable_locales` plumbing. `complete_narratives` is reduced to "English only"
    plus "one locale".
  - The four `trigger_*_export` functions are replaced by `report_jobs::on_submission_approved`. It:
    - starts the English cooperative job;
    - for every consolidated report the approval changes (apex, federation, ministry; the statement or questionnaire variant
      matching the submission), deletes its PDFs, narratives and status rows and starts its English job;
    - does the same for approved later-year submissions of the same cooperative.

    A job overtaken by a newer one (a second approval while it ran) checks that it still owns its row before storing. It
    never overwrites the newer PDF, and it ends quietly as "superseded".
- `submission.rs`: both final-approval handlers call `on_submission_approved` once, instead of 8 trigger calls each.
- **Narrative storage:** `repositories/report_narrative_store.rs` reads and writes the narratives in one SQL statement each
  (`jsonb_set`). This way, two languages translated at the same time never overwrite each other.
- `export.rs`:
  - The download endpoints (`export_single_submission`, `export_bulk_consolidated`) **only serve stored PDFs**:
    - `ready`: stream the file;
    - anything else: **409** `{ error: "conflict" }`. Nothing is generated inside a download request any more.
  - The `regenerate=true` query flag is replaced by the prepare endpoint below.
  - The narrative GET endpoints and `select_locale` are unchanged.
- **Existing stored PDFs:** when reading the status, a missing row whose PDF already exists in storage is inserted as `ready`
  (lazy backfill). So reports from before this change stay downloadable, with no data migration.
- **Config:** `REPORT_JOB_TIMEOUT_SECS` (default 600) in `config.rs` and `.env.example`.

### 4.5 API

These follow the existing per-role routes and the same access checks as the current export handlers.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/v1/{role}/submissions/{id}/report` | Status per language for a submission report |
| POST | `/api/v1/{role}/submissions/{id}/report/prepare?lang=xx&regenerate=bool` | Start a language (202) or a full regeneration |
| GET  | `/api/v1/{apex\|federation\|ministry}/report?apex_id&federation_id&reporting_year&method` | Status per language for a consolidated report |
| POST | `/api/v1/{apex\|federation\|ministry}/report/prepare?…&lang=xx` | Prepare or update a consolidated report (202) |
| GET  | existing `…/export` endpoints | Download a ready PDF (409 if not ready) |

The response DTO `ReportStatusResponse` (`src/api/dto/report_export.rs`):

```json
{ "languages": [ { "lang": "en", "status": "ready", "updated_at": "…" },
                 { "lang": "ss", "status": "preparing", "updated_at": "…" } ],
  "available_languages": ["en", "fr", "pt", "ss"] }
```

The response contains **no error text**. `failed` is all the client gets. Every handler has `#[utoipa::path]` annotations, and
the schemas are registered in OpenAPI.

## 5. Frontend

- **API client:** regenerate the openapi client. There are no hand-written `fetch` calls for status or prepare. The PDF download
  keeps its existing blob fetch.
- **Hooks** (`src/hooks/reports/`):
  - `useReportStatus(target)` is a `useQuery` that polls every 4 s while any language is `preparing`, and stops otherwise.
  - `usePrepareReport(target)` is a `useMutation` that invalidates the status query.
  - `useDownloadReport(target)` downloads a ready PDF, as today, without waiting.
- **Components** (`src/components/reports/`):
  - `ReportStatusCard` shows the report's state:
    - **Preparing:** a spinner and "Preparing report… this usually takes about a minute". Download is disabled.
    - **Ready:** `[Download English]`.
    - **Failed:** "The report couldn't be prepared. Please try again." `[Try again]`.
    - **Not prepared** (e.g. a consolidated report after an approval): `[Prepare]`.
  - `ReportLanguageList` has one row per language:
    - ready: `[Download]`;
    - preparing: "Translating… up to a minute";
    - failed: a generic message and `[Try again]`;
    - not prepared: `[Prepare]`.

    It's disabled until English is ready.
  - Language choice: the picker **defaults to the user's current app language**, and the user can pick any other.
  - A toast "Your Siswati report is ready" appears when a language the user started becomes ready.
- **Pages:**
  - `report-export-panel.tsx` shows `ReportReadiness` once the selection is complete.
  - The row action in `ReportsPage.tsx` opens `ReportDownloadDialog`.
  - The old "Regenerate & Export" button becomes "Update report", which calls prepare with `regenerate=true`.
- **i18n:** new `reports.status.*` keys in `en`, `fr`, `pt` and `ss`. Every error message is generic.

## 6. Tests

- **Backend unit tests:**
  - `ReportTarget::key` and `pdf_key`;
  - turning stale rows into `failed`;
  - prepare validation (non-`en` before English is ready, questionnaire with a non-`en` language, unknown language);
  - the job state transitions, using the mock narrative generator (success to `ready`, LLM error to `failed`, with no
    half-translated PDF).
- **Backend repository / integration tests:** `claim` returns ownership once, a second concurrent claim gets nothing, and a stale
  claim can be re-taken.
- **Handlers:** a download for a not-ready report returns 409, the error text never appears in a response, and the access checks
  match the export handlers.
- **Frontend:** `ReportStatusCard` renders every state, the language list is locked until English is ready, polling stops when
  nothing is preparing, and a failed state shows only the generic message.
- **Manual checks on the dev stack:**
  1. Approve a submission: "Preparing", then "Ready".
  2. Prepare Siswati: "Translating…", then download works.
  3. Restart the backend during a job: it shows "Failed" after the timeout, then "Try again" works.
  4. Point the LLM at a bad URL: a generic error in the UI and the details in the backend logs.
  5. Approve a second cooperative: the apex, federation and ministry reports show "Preparing", then Ready in English. Their
     other languages show "Prepare" again.
  6. Two browsers click Prepare at the same time: only one job runs (check the logs).

## 7. Implementation phases

| # | Phase | Main files |
|---|---|---|
| 1 | Migration, entity, repository with `claim` | `migrations/49_report_exports.sql`, `entities/report_exports.rs`, `repositories/report_export_repository.rs` |
| 2 | Job service: English-only generation, single-language translation, failure handling | `services/report_jobs.rs`, `services/narrative_translation.rs`, `services/export_generator.rs` |
| 3 | Approval flow: English cooperative report, English consolidated reports rebuilt | `services/report_jobs.rs`, `api/handlers/submission.rs` |
| 4 | Status and prepare endpoints, download returns 409 when not ready, OpenAPI | `api/dto/report_export.rs`, `api/handlers/export.rs`, `api/routes/*.rs`, `api/openapi.rs`, `config.rs` |
| 5 | Frontend hooks and components, wired into the export panel and reports page | `hooks/reports/*`, `components/reports/*`, `report-export-panel.tsx`, `ReportsPage.tsx` |
| 6 | i18n (4 languages), tests, doc update (`multilingual-report-exports.md`), remove dead code, manual checks | — |

After each phase: `cargo clippy` and `cargo test`, or `npm run lint`, `npm run typecheck` and `npm test`.

## 8. Effect

| | Per approval today | After |
|---|---|---|
| PDF renders | 16 | 4 (English: cooperative, apex, federation, ministry) |
| LLM translation runs | 3 to 12 | 0 |
| Consolidated reports | rebuilt in 4 languages per approval | rebuilt in English; other languages on request |
| Storage | 4 PDFs per report | English, plus only the languages people actually use |
