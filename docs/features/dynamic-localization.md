# Design Document: Dynamic Content Localization (Multilingual Ministry-Editable Content)

> **Status:** Analysis & design only — **no implementation yet** (per request).
> **Scope:** Make user/ministry-editable *content* multilingual, so a cooperative can view a questionnaire / indicator / KPI in their own language.

---

## 1. Problem Statement

The app currently supports **4 languages** (`en`, `pt`, `ss`, `fr`) for **static UI chrome** via i18next
(`frontend/src/i18n/locales/*.json`).

However, the **dynamic, ministry-editable content** is stored as **single-language English plain text**
in the database and rendered verbatim:

| Content | Where stored | Single-language column(s) |
| ------ | ------------ | ------------------------- |
| **Questionnaire templates** (financial & non-financial, categories + questions) | `questionnaire_templates.sections` (JSONB) + `.label` (VARCHAR) | `label`, `sections[].title`, `sections[].description`, `sections[].fields[].label`, `sections[].fields[].description`, `sections[].fields[].options[]` |
| **Non-financial indicator catalog** (ministry builds custom indicators) | `non_financial_indicator_catalog` | `indicator_name`, `display_name`, `description`, `coop_type` |
| **Custom KPIs** | `custom_kpis` | `name`, `description` |

A cooperative sits in siSwati/Portuguese-speaking regions, but every question/label/option they see is
hardcoded English from the DB. **The ministry cannot enter content per language, and users cannot view
content in their chosen language.**

This is **content/database localization**, which is architecturally different from the **static UI i18n**
already in place.

---

## 2. Goals / Non-Goals

### Goals
1. Ministry can enter **translated labels/descriptions/options** for any questionnaire field, section,
   indicator, and KPI — in all supported languages.
2. A cooperative (or reviewer) sees the questionnaire rendered in **their active UI language**, falling
   back to English (or the source default) when a translation is missing.
3. Minimal disruption to existing fill flow and existing stored `answers` (keys stay unchanged).
4. Keep the **editor UX** simple: same editor, extra per-language text inputs.

### Non-Goals (for v1)
- Machine translation / auto-translate.
- Translating **numeric/answer data** (only labels/descriptions/options text).
- Full CMS for arbitrary entity i18n beyond the 3 content types above (keep it focused; the same pattern
  is reusable later).

---

## 3. Key Facts Found in the Codebase (Current State)

### 3.1 Static i18n (UI chrome only)
- `frontend/src/i18n/index.ts` — i18next + `react-i18next` + `i18next-browser-languagedetector`.
- Locales: `en.json`, `pt.json`, `ss.json`, `fr.json`. `fallbackLng: "en"`, detection via
  `localStorage` → `navigator` → `htmlTag`.
- The active language is available at runtime via `i18n.language` / `useTranslation().i18n.language`.

### 3.2 Questionnaire templates — current shape
- **Table:** `questionnaire_templates` (`migrations/25_questionnaire_templates.sql`): `label` (VARCHAR),
  `sections` (JSONB), `is_active`, `version`.
- **Entity:** `backend/src/entities/questionnaire_template.rs` (`sections: serde_json::Value`).
- **Repository:** `backend/src/repositories/questionnaire_template.rs`.
- **Handler/DTOs:** `backend/src/api/handlers/questionnaire_template.rs` —
  `QuestionnaireTemplateDto`, `CreateTemplateRequest`, `UpdateTemplateRequest`.
- **Routes:** `/api/v1/ministry/questionnaire-templates…` and the shared active-template endpoints
  (`/api/v1/cooperative/…`, `…/apex`, `…/federation`, `…/ministry` with `?questionnaire_type=`).

JSONB `sections` shape (exact fields edited by ministry):
```jsonc
[{
  "id": "general",
  "title": "General Information",        // ← translatable
  "icon": "Building2",                   // icon key (code value — NOT translated)
  "description": "Basic details…",       // ← translatable
  "fields": [{
    "key": "society_name",               // stable answer key — NEVER translated
    "label": "Name of Society",          // ← translatable
    "type": "text",                      // enum (code value — NOT translated)
    "required": true,
    "description": "…",                  // ← translatable
    "options": ["Provisional", "Fully"]  // ← each option translatable
  }]
}]
```

### 3.3 NF indicator catalog — current shape
- **Table:** `non_financial_indicator_catalog` (`migrations/18_non_financial_indicator_catalog.sql`):
  `indicator_name` (UNIQUE, code), `display_name`, `description`, `data_type`, `coop_type`, `is_required`.
- **Entity:** `backend/src/entities/non_financial_indicator_catalog.rs`.
- **Handler/DTOs:** `backend/src/api/handlers/non_financial_indicator.rs` →
  `CreateIndicatorRequest`, `UpdateIndicatorRequest`, `IndicatorCatalogResponse`.

### 3.4 Custom KPIs — current shape
- **Table:** `custom_kpis` (`migrations/22_custom_kpis.sql`): `name` (UNIQUE), `description`, `formula`.
- **Handler/DTOs:** `backend/src/api/handlers/custom_kpi.rs` → `CustomKpiDto`, `CreateCustomKpiRequest`.
- Note: `formula` and the `name` code are **not** translatable (formula is logic; `name` is a stable
  identifier referenced elsewhere). Only the human-facing display labels/descriptions need localization.

### 3.5 Critical constraint — answer keys must NOT change
`questionnaire_responses.answers` (JSONB) is keyed by `fields[].key` / section ids. Translations must be
**stored alongside content**, not replace the `key`/`id`. The cooperative fill flow and stored answers
must remain unchanged.

---

## 4. Recommended Approach

**Hybrid model:**
1. Keep each content row's **canonical/source language** as the existing columns (what exists today —
   this stays the default/fallback and the "base" language).
2. Add a **generic JSONB translations map** on each content row: `translations` →
   `{ "<lang_code>": { <field path or name>: "<translated>" } }`. This reuses PostgreSQL JSONB (no new
   tables needed per entity) and keeps a single source of truth per record.
3. The backend **resolves the localized view** server-side using the request context (Accept-Language or
   an explicit `lang` query param), returning either fully-resolved strings **or** the raw
   `translations` map + a `lang` hint for the frontend to resolve.

### 4.1 Option A (recommended): JSONB `translations` column on each content table
- Add `translations JSONB NOT NULL DEFAULT '{}'::jsonb` to `questionnaire_templates`,
  `non_financial_indicator_catalog`, `custom_kpis`.
- For **questionnaire_templates**, the shape mirrors `sections` so the resolver can walk the tree:

```jsonc
// questionnaire_templates.translations
{
  "ss": {
    "label": "…",
    "sections": {
      "general": {
        "title": "…",
        "description": "…",
        "fields": {
          "society_name": { "label": "…", "description": "…", "options": ["…", "…"] }
        }
      }
    }
  },
  "fr": { /* same shape */ }
}
```

- For **non_financial_indicator_catalog** and **custom_kpis**, a flat map keyed by field name:

```jsonc
// non_financial_indicator_catalog.translations
{ "ss": { "display_name": "…", "description": "…", "coop_type": "…" } }
// custom_kpis.translations
{ "ss": { "display_name": "…", "description": "…" } }
```

**Why recommended:** No new tables/joins; one row stays self-contained; JSONB is already used throughout
the schema; validation can enforce the per-entity shape; versioning/`is_active` semantics unchanged.

### 4.2 Option B: separate `translations` child-table per entity
- `questionnaire_template_translations(template_id, lang, …)`, `indicator_translations(catalog_id, lang, …)`, `kpi_translations(kpi_id, lang, …)`.

**Why not default:** More tables, more joins, more repository/handler surface area, and it fragments the
document. Only worth it if we later need full audit trails per translation row or translation
review/approval workflows. (Document here as a future path, not the v1 choice.)

---

## 5. Resolution Strategy (who picks the language, server vs client)

**Recommended: resolve on the backend, using request language.**

1. Client sends its active language in every request. Two options:
   - **Preferred:** Frontend adds the resolved language as a query param or header, e.g.
     `?lang=ss` on the active-template endpoints, or an `Accept-Language` header set from
     `i18n.language` via the openapi-client base config.
2. Backend `resolve_content(lang, fallback="en")` walks:
   - exact `lang` → else `baseLng`/`en` in `translations` → else the **canonical column value**.
3. The handler returns localized strings directly (so the frontend stays dumb) **or** returns both raw +
   translations. Recommend **server-resolved** for the fill/review endpoints to keep the wizard simple,
   and keep the **raw form** (with `translations`) for the ministry editor so they can edit every language.

**Backward compatibility:** when `translations` is empty (all existing rows), the resolver returns the
current columns verbatim → **zero behavior change** for existing data.

---

## 6. What Changes in the Database

New migration(s):

```sql
ALTER TABLE questionnaire_templates
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE non_financial_indicator_catalog
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE custom_kpis
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
```

- No PK/FK changes, no new tables, no data backfill required (empty `{}` = current behavior).
- Optional index is unnecessary (we do not query inside translations for filters in v1).

---

## 7. What Changes in the Backend (Rust)

Per the project's bottom-up flow (Entity → DTO → Repository → Handler → Routes/OpenAPI):

1. **Entity** (`*_entity.rs`): add `pub translations: serde_json::Value` (or `Json<HashMap<String,…>>`)
   to each of the 3 models.
2. **DTOs**:
   - Response DTOs: add localized fields resolved by the handler (or add `translations` for the editor).
   - Request DTOs (`Create*`, `Update*`): add optional `translations: Option<serde_json::Value>`.
3. **New shared resolver module** — e.g. `backend/src/services/localization.rs` with
   `resolve_str(content: &str, translations: Option<&Value>, lang: &str) -> String` and a
   `resolve_sections(...)` walker for questionnaire JSONB. This is the single source of the merge logic
   and is unit-tested in isolation.
4. **Repository** (`questionnaire_template.rs`, `non_financial_indicator_catalog.rs`, `custom_kpi`
   repo): accept/persist `translations` on create/update. No query changes needed otherwise.
5. **Handlers**:
   - Read `lang` from query (`?lang=`), reused across the active-template endpoints
     (`cooperative/apex/federation/ministry`) — a tiny shared helper.
   - For fill/review endpoints: resolve sections/labels into the requested language before returning the DTO.
   - For ministry editor endpoints: return the raw `translations` too (or add `lang` param to preview).
   - Validate `translations` keys are in the supported locale set; validate per-entity JSONB shape on write.
6. **Routes/OpenAPI**: add `lang` query param docs on the active-template endpoints; register any new
   schemas. No new routes are strictly required (same endpoints, extra params/fields).

---

## 8. What Changes in the Frontend (TypeScript/React)

1. **OpenAPI client**: regenerate after backend changes; types gain `translations` / localized fields and
   the `lang` param.
2. **API layer / hooks**: the questionnaire hooks (`frontend/src/hooks/submissions/useQuestionnaire.ts`)
   pass the current language (`i18n.language`) as `lang`. Centralize this in a helper (so every
   content-fetching call sends the language) rather than editing each call site.
3. **Active template consumers**: `QuestionnaireWizard` and any reviewer/print views — already consume
   `sections`; once the backend returns localized strings they render as-is with **no** change to how
   labels/options are used (keys/ids untouched).
4. **Ministry template editor** (`frontend/src/pages/ministry/template-editor/*`, and the Page):
   - Add a **language selector** (tabs or dropdown) in the editor: `en, pt, ss, fr`.
   - When a non-`en` language is selected, the text inputs for `label`, `section.title`,
     `section.description`, `field.label`, `field.description`, and select `options` become the
     **translation inputs** for that language, stored under `translations[lang][...]`.
   - `FieldModal`/`SectionMetadataForm`/`FieldEditor`/`SectionList` gain the translation-aware value
     source. Keep the canonical (English) editable at all times.
5. **NF indicator catalog editor & Custom KPIs editor**: same pattern — language selector plus
   translation inputs for `display_name`/`description` (and `coop_type` for indicators).
6. **Offline-first note**: any Dexie/IndexedDB cache of templates should store the resolved localized
   object tied to the `lang` it was fetched with, or store both raw + translations and resolve on device.

**Important:** do NOT translate `key`, `id`, `type`, `icon`, `formula`, or stored answer values. Only
human-facing display text.

---

## 9. Scope of New Work / New Files (workload estimate)

### Backend
| Item | File(s) | Effort |
| --- | --- | --- |
| Migration | `backend/migrations/30_content_translations.sql` | S |
| Entity fields | 3 entity files | S |
| DTO updates | handler DTOs (template, nf indicator, custom_kpi) | S–M |
| Shared resolver + tests | `backend/src/services/localization.rs` (+ unit tests) | M |
| Repository persist `translations` | template / catalog / kpi repos | S |
| Handler resolve + `lang` param + validation | 3 handler files (+ shared helper) | M |
| OpenAPI params/schemas + regenerate frontend client | `openapi` + `frontend/src/openapi-client` | S |
| Backend verification | `cargo clippy`, `cargo test` | S |

### Frontend
| Item | File(s) | Effort |
| --- | --- | --- |
| Pass `lang` from hooks/API layer | `hooks/submissions/*`, shared API helper | S–M |
| Template editor language selector + translation inputs | `pages/ministry/template-editor/*`, `QuestionnaireTemplateEditor.tsx` | M–L |
| NF catalog editor translations | ministry Non-Financial Indicators UI | M |
| Custom KPI editor translations | `pages/ministry/CustomKpisPage.tsx` | M |
| Offline cache update (lang-aware) | Dexie layer | S–M |
| Frontend verification | `npm run lint`, `npm run typecheck` | S |

### Tests
- Backend: resolver unit tests (missing lang, fallback, empty translations), handler integration for one
  type (e.g. questionnaire template).
- Frontend: editor save/load with translations; wizard renders translated labels when `lang=ss`; fallback
  when missing.

**Total realistic estimate: ~2–3 focused feature weeks** (1 backend + 1–1.5 frontend), assuming the
questionnaire template (JSONB tree) is done first as the pattern-setter, then indicators and KPIs follow
the same pattern cheaply.

---

## 10. Recommended Implementation Order (Phases)

1. **Phase A — Foundation (pattern-setter: questionnaire templates)**
   - Migration: add `translations` column.
   - Entity + DTO (`translations`), repository persist.
   - `localization.rs` resolver + unit tests.
   - Handler: `lang` param on active-template endpoints; resolve for fill/review; return `translations`
     for editor; validation.
   - Frontend: pass `lang`; regenerate client; update wizard consumers (should be near no-op).
2. **Phase B — Ministry template editor localization**
   - Language selector + translation inputs across section/field modals.
   - Save/load translation maps; preview in chosen language.
3. **Phase C — NF indicator catalog + Custom KPIs**
   - Reuse the same resolver/pattern for the two flat entities.
   - Localize their ministry editors.
4. **Phase D — Offline + polish**
   - Lang-aware Dexie caching; print/export localized labels; edge cases (missing `lang`, unknown lang,
     content containing HTML/markdown as plain text).

---

## 11. Risks / Edge Cases

- **Answer stability:** always resolve by `key`; never mutate stored `answers`.
- **Fallback correctness:** every resolver path must end at the canonical column (never blank).
- **Unsupported `lang`:** treat as fallback to `en` / canonical (do not 400 the fill flow).
- **Editor data loss:** guard so saving a translation for one language never wipes the canonical text or
  another language's map (merge, don't replace).
- **Validation:** restrict `translations` locale keys to the supported set; enforce per-entity JSONB
  shape to avoid invalid documents reaching the wizard.
- **Content with format chars:** avoid injecting HTML; keep texts as plain strings (consistent with the
  current plain-string templates).

---

## 12. Open Questions for the User (before implementation)

1. **Language set** — confirm the 4 UI locales are the only ones the ministry must translate to:
   `en`, `pt` (Portuguese), `ss` (siSwati), `fr` (French)? Any others (the repo doc mentions `es` in
   the knowledge guide, but the shipped locales are currently en/pt/ss/fr)?
2. **Canonical language** — is English always the source/fallback language (recommended), or should the
   ministry pick a per-record source language?
3. **Server vs client resolution** — confirm the recommendation (backend resolves for fill/review using
   `lang`; editor gets raw `translations`). This affects effort.
4. **Which entity first** — start with questionnaire templates (recommended, JSONB tree is the hardest
   and the pattern-setter), then indicators + KPIs?
5. **Custom KPI / indicator `name`** — these are stable code identifiers; only their display labels +
   descriptions get translated. Confirm that matches expectations (formula/name not translated).
