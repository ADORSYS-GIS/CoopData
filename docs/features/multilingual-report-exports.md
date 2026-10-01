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
2. **Translation.** The finished English paragraphs — no financial tables — are sent
   to the LLM three times concurrently (French, Portuguese, Siswati) through
   `ReportNarrativeGenerator::translate_narrative_json`.
3. **Validation.** Each translation is accepted only when it:
   - is a JSON object with exactly the English keys,
   - translates every non-trivial field (it must not come back identical),
   - keeps every figure of the English text. Figures are compared digit-for-digit,
     so `1,234.5`, `1 234,5` and `1.234,5` are equal; whole numbers below ten may be
     written as words.
4. **Retries and fallback.** A rejected translation is retried up to 3 times. If it
   still fails, that locale holds the English text and is listed in `untranslated`.
5. **Storage.** One write per entity:

```json
{
  "ai_narratives": {
    "en": { "executive_summary": "…", "…": "…" },
    "fr": { "…": "…" },
    "pt": { "…": "…" },
    "ss": { "…": "…" },
    "untranslated": []
  }
}
```

Apex and federation narratives live under `ai_narratives_{year}`; ministry narratives
in `ministry_report_narratives`. Narratives stored before this feature (a flat English
object) are still read, and are translated the first time another language is needed.

### Concurrency

`ai_semaphore` (18 permits) limits **jobs**, not HTTP requests: one permit covers the
5 concurrent analysis calls, and a separate permit covers the 3 translation calls. A
task releases its analysis permit before it asks for the translation permit, so it
never holds two permits at once (holding one while waiting for another can deadlock
when all permits are taken).

---

## 3. PDF generation

`backend/src/services/export_generator.rs`, `backend/src/api/handlers/export.rs`

- **On approval** the background job generates fresh narratives and renders one PDF
  per locale through Gotenberg (`/print/{tier}/{id}?…&lng=xx`). Locales whose
  translation failed are **not** rendered or cached, so their next download retries
  the translation instead of serving English labelled as another language.
- **Download** (`GET …/export?lang=fr`, `lng` also accepted): serves the cached PDF
  for that locale; on a miss it completes the narratives (generate / upgrade legacy /
  retry failed locales) and renders that locale. English downloads also fall back to
  PDFs cached before this feature.
- **Regenerate** (`regenerate=true` or the manual "generate narratives" action)
  replaces the narratives and rebuilds every locale's cached PDF in the background.
- Cache keys: `exports/v5/individual/{id}/submission_{id}_{lng}.pdf`,
  `…/apex/{id}/apex_{id}_{year}{tag}_{lng}.pdf`, and likewise for federation and
  ministry.

The frontend sends the user's current app language with every download.

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
