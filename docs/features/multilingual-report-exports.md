# Multilingual Report Exports & AI Narratives — Feature Design

> **Status:** Implemented
> **Owner:** Engineering Team
> **Languages:** English (`en`), French (`fr`), Portuguese (`pt`), Siswati (`ss`)
> **Scope:** Cooperative (statement-based), Apex, Federation and Ministry reports.
> Questionnaire reports are **English-only** and out of scope.

---

## 1. Overview

Every supervisory PDF can be produced in the four platform languages. Two kinds of
text are translated:

| Text | Where it lives | How it is translated |
|---|---|---|
| Fixed report text (headings, tables, captions, generated findings, account names) | `pdf.*` keys in `frontend/src/i18n/locales/{en,fr,pt,ss}.json` | i18next, at render time |
| AI narratives | submission / apex / federation metadata, ministry narratives table | LLM: generated once in English, then translated |

Numbers and dates follow the report language (`fr-FR`, `pt-PT`; siSwati uses the
English conventions of Eswatini and CLDR month names, since browsers ship no siSwati
calendar data).

---

## 2. AI narratives: generate once, translate many

`backend/src/services/narrative_translation.rs`

1. **English analysis.** The existing 5 (cooperative) or 3–5 (consolidated) section
   prompts run once, in English, with the full financial context.
2. **Translation, on demand.** When a user asks for the report in French, Portuguese
   or Siswati, the finished English paragraphs (no financial tables) are sent to the LLM
   for that one language through `ReportNarrativeGenerator::translate_narrative_json`.
   Languages nobody asks for are never translated.
3. **Validation.** Each translation is accepted only when it:
   - is a JSON object with exactly the English keys,
   - translates every non-trivial field (it must not come back identical),
   - keeps every figure of the English text. Figures are compared digit-for-digit,
     so `1,234.5`, `1 234,5` and `1.234,5` are equal; whole numbers below ten may be
     written as words.
4. **Retries.** A rejected translation is retried up to 3 times. If it still fails, the
   report job fails: the user sees a generic error and can try again. A PDF with
   translated headings and English paragraphs is never produced.
5. **Storage.** English is stored when generated. Each translation is added next to it
   by a single SQL statement (`repositories/report_narrative_store.rs`), so two languages
   translated at the same time never overwrite each other:

```json
{
  "ai_narratives": {
    "en": { "executive_summary": "…", "…": "…" },
    "ss": { "…": "…" }
  }
}
```

Apex and federation narratives live under `ai_narratives_{year}`; ministry narratives
in `ministry_report_narratives`. Older shapes are still read: a flat English-only object,
and languages listed in a legacy `untranslated` array, which count as not translated.

### Concurrency

`ai_semaphore` (18 permits) limits **jobs**, not HTTP requests: one permit covers the
5 concurrent analysis calls, and a separate permit covers one translation. A task
never holds two permits at once (holding one while waiting for another can deadlock
when all permits are taken).

---

## 3. PDF generation

`backend/src/services/export_generator.rs`, `backend/src/api/handlers/export.rs`

PDFs are prepared on demand, one background job per report and language. Their
status is tracked in `report_exports`. See
[report-export-on-demand.md](report-export-on-demand.md) for the full design.

- **On approval:** the English cooperative report is generated (narrative and
  PDF). Every consolidated report the approval changes (apex, federation, ministry)
  is deleted and rebuilt in English in the background; its other languages are
  prepared again on request.
- **Prepare** (`POST …/report/prepare?lang=xx`): English is generated from the data.
  Another language is translated from the stored English, which must be ready first.
  `regenerate=true` rebuilds English and drops the other languages.
- **Status** (`GET …/report`): `preparing`, `ready` or `failed` per language. A job
  still preparing after `REPORT_JOB_TIMEOUT_SECS` (default 600) counts as failed and
  can be retried.
- **Download** (`GET …/export?lang=xx`): serves a ready PDF, otherwise 409. Nothing is
  generated inside a download request.
- Storage keys: `exports/v5/individual/{id}/submission_{id}_{lng}.pdf`,
  `…/apex/{id}/apex_{id}_{year}{tag}_{lng}.pdf`, and likewise for federation and
  ministry. PDFs stored before status tracking are recognised and served.

In the UI, the user picks a language (it defaults to their app language) and clicks
**Download**:
- A ready report downloads at once.
- Otherwise the button shows "Preparing your report…" and the file downloads by itself
  when it's ready. English is prepared first if needed.
- If the window is closed meanwhile, a notification offers the file once it's ready.

---

## 4. Print pages

- The i18next language detector reads `?lng=` first, so a page opened by Gotenberg is
  in the report language from its first render.
- `usePrintLanguage(lng)` switches the language if needed; print routes treat the
  page as loading until the language is active **and** the narratives have loaded, so
  Gotenberg never captures a half-translated page.
- Narratives are fetched from `GET …/narratives?lng=xx`, which returns the requested
  locale (or the legacy English object).
- Templates take every string from `pdf.*` through `tr()` in
  `frontend/src/pages/shared/print/tpl/i18n.ts`, which also provides the locale-aware
  number, percent and date formatting. Account names stay exactly as submitted in
  English and are translated by chart-of-accounts code in the other languages.

---

## 5. Ministry-defined role names

The Ministry names the four organisation levels in Settings → Terminology
(`organization_labels`: `short_label` = singular, `plural_label` = plural, with
per-language `translations`). Reports use those names instead of the fixed words
"Cooperative", "Apex", "Federation" and "Ministry".

- Print pages load the labels with the renderer's token (`useReportRoleLabels`) and
  pass them to `setReportRoles()` before the report renders.
- Every `tr()` call fills the role placeholders: `{{coop}}`, `{{coops}}`, `{{apex}}`,
  `{{apexes}}`, `{{federation}}`, `{{federations}}`, `{{ministry}}`, `{{ministries}}`
  (heading form, first letter capitalised) and the same names with an `Lc` suffix
  (mid-sentence form).
- A name is resolved in this order: the Ministry's translation for the report
  language → the Ministry's own name, when it differs from the seeded default → the
  report's built-in default for that language (`pdf.roles`).
- Sentences in French, Portuguese and siSwati are worded so the name stands on its
  own (`{{apex}} : …`, "par {{apexLc}}", "chaque {{coopLc}}"), which keeps them
  grammatical whatever gender or noun class the Ministry's name has.
- The `label` field (a user's job title, e.g. "Apex Officer") is not used in reports.

---

## 6. Quality assurance

- `backend/src/services/narrative_translation.rs` unit tests cover the validation
  rules and the English fallback.
- `frontend/src/pages/shared/print/tpl/multilingual.test.tsx` renders the cooperative
  report and every consolidated tier in each language and fails on any raw
  translation key, unfilled placeholder or known English sentence.
- Siswati translations (fixed text and the LLM prompt guidance) should be reviewed by
  a native speaker before they are relied on for regulatory use.
