# Questionnaire KPI Dashboard and Report: Handoff

Branch: `questionaire-report` (created from `develop` at f7f65d2). Everything below is uncommitted. Nothing is pushed. Read `docs/features/questionnaire-kpi-dashboard.md` first for the design (data flow, consolidation rule, indicator table).

## Goal

Make the seeded questionnaire forms (Financial and Non-Financial "Primary Cooperatives Questionnaire v1", seeded by migration 25) able to compute every KPI and chart in `/home/ariel/Downloads/KPI & CONSOLIDATED.pptx`, at individual and consolidated level. Fix the bugs found on the way. Improve the Basic Analytics page. Add a PDF report for questionnaire submissions (KPIs plus an AI summary) through the existing report pipeline, without changing the report content of the other submission methods (`upload`, `manual`, `manual_grid`).

## Standing constraints from the user

- Never delete volumes and never run `docker compose down -v`.
- Do not commit or push unless the user asks.
- Never type passwords or sign in for the user. Browser login is done by the user.
- The caveman plugin is active: terse chat replies, but code, commits, docs and memory files stay in normal prose.
- Follow CLAUDE.md: bottom-up flow, named exports, no `any` (one documented cast exists), files under 200 lines (frontend) and 300 lines (backend), run `cargo clippy` and `cargo test`, `npm run lint` and typecheck.
- Production deploys are only done when the user explicitly asks. The production SSH key was authorised only for those requests.

## What is done

### Backend
- Migration `backend/migrations/43_questionnaire_periods_and_kpi_fields.sql`, idempotent. It adds `period_type` and `period_value` to `questionnaire_responses` (backfilled from submissions) and drops the unique constraints that made a Q1 and a Q4 return of the same year collide. It adds a `loan_quality` section and a `liquidity` section to the financial form, and `age_61plus_male/female` fields to the non-financial `membership` section. It is applied to the local DB only.
- KPI engine in `backend/src/services/questionnaire_kpi/` (`inputs.rs`, `derived.rs`, `indicators.rs`, `series.rs`, `tests.rs`). It is made of pure functions and covers about 70 indicators. Each indicator has a status: `computed`, `approximate` or `not_reported`. 14 unit tests pass.
- `backend/src/services/basic_dashboard.rs` and `api/handlers/basic_dashboard.rs` expose `GET /api/v1/analytics/basic-dashboard`. It handles period selection, USD conversion with the submission's frozen rate, previous-period comparison, series of up to 8 periods, market share, demographics, and a per-cooperative ranking. Scope is resolved from the caller: a cooperative sees its own data, apex, federation and ministry users see the consolidated view. DTOs are in `api/dto/basic_dashboard.rs`.
- Bug fixes in `api/handlers/questionnaire.rs` and `basic_benchmark.rs`: age bands now sum male and female (they counted male only), `amount_owed_by_members` is only a fallback for outstanding loans (it was double counted), and quarterly submissions no longer collide. Tests were added and one expectation was updated (55.0 to 50.0).
- Report: `services/questionnaire_report.rs`, `api/handlers/questionnaire_report.rs`, new narrative trait method in `report_narrative.rs` (six sections, LLM plus mock), and a dispatcher `generate_submission_pdf` in `export_generator.rs`. It routes questionnaire submissions to the new path and leaves every other method on the unchanged `generate_cooperative_pdf`. New endpoint: `GET /api/v1/cooperative/submissions/{id}/questionnaire-report` (400 for non-questionnaire submissions).

### Frontend
- New Basic Analytics dashboard: `pages/shared/BasicAnalyticsDashboard.tsx`, components under `components/analytics/basic/`, hook `useBasicDashboard`, types, lib helpers, fixtures, and i18n namespace `basicDashboard` (en/fr/pt). The route `/app/basic-analytics` points to it. The old `QuestionnaireAnalyticsPage.tsx` is deleted.
- Report print page `routes/print.questionnaire.$id.tsx` with `QuestionnaireReportPrint.tsx` and 9 sheets under `pages/shared/print/components/questionnaire/`, plus hook `useQuestionnaireReport`, lib, types, and i18n `questionnaireReport` (en/fr/pt).
- Reported by the agents: frontend tsc and lint clean, 73 files and 624 tests pass. Backend suite of 805 tests passed after the report work, and clippy was clean after fixes.

### Local demo data
The 20 demo submissions (tagged `metadata->>'seed'='kpi-demo'`) used to test the dashboard were removed from the dev DB. Basic Analytics is empty until a cooperative submits a questionnaire.

## What is not done (next steps, in order)

1. **Restore the local stack.** `coopdata-frontend-dev` is stopped after an earlier wrong choice in `start.sh`. Run `./start.sh` and pick **option 2** (restart, keeps volumes). Never pick option 1 (PWA preview, breaks on a root-owned `frontend/dist`) or option 3 (removes volumes). Then run `docker restart coopdata-backend-dev` and wait for "Server listening" so the new code compiles.
2. **Regenerate the OpenAPI client.** From `frontend/`, run `npm run fetch-api` then the codegen script. Then remove the `(apiClient as any).GET` cast in `useBasicDashboard` and the report hook, if the generated types now cover the endpoints.
3. **Test in the browser.** The user signs in. Check `/app/basic-analytics`: individual view against consolidated view, all filters, every chart, market share, the ranking table, the USD/native toggle, and empty and not-reported states. Nothing has been tested against the live API yet.
4. **Test the PDF report.** Generate it for an approved questionnaire submission. Confirm the Gotenberg render, the 9 pages, and the AI narratives (stored in `submission.metadata.ai_narratives`). Confirm that reports for upload, manual and manual_grid submissions are unchanged.
5. **Run the full checks.** `cargo fmt`, `cargo clippy`, full `cargo test` (the last run was interrupted by the user, so ask before starting it), and `npm run lint`, typecheck and vitest.
6. **Fix whatever the live tests reveal.**
7. **Confirm migration 43 for other environments.** It is idempotent. Production needs it applied through `migrate-db.sh`, and the server checkout does not have it yet.
8. **Commit** only when the user asks. Use Conventional Commits and never commit secrets. Push only when asked.

## Known limits and optional work

- Forms are entered in SZL. The dashboard converts to USD by default and can show the entered currency.
- Sector-wide figures outside the SACCO returns (banks, insurance, capital markets, FSP licensing) cannot come from these forms.
- The new form fields have no fr/pt/ss labels. The existing forms have none either.
- Decide whether the non-financial form or other seeded sections need more fields.

## Production deploy notes (only when the user asks)

Merge to `develop`, then to the deployed branch. Apply migration 43 on the server. Pull the images explicitly with `docker compose -f docker-compose.ghcr.yaml pull backend frontend` because the MinIO pull fails and the script skips the others. Never remove volumes.

## Suggested prompt for a new session

> On branch `questionaire-report`, finish testing the questionnaire KPI dashboard and PDF report. Read `docs/features/questionnaire-handoff.md` and `docs/features/questionnaire-kpi-dashboard.md`. Do not commit or push.
