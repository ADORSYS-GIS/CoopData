-- Migration 30: Dynamic content localization (multilingual ministry-editable content)
-- Adds a `translations` JSONB column to the three content tables whose human-facing text is
-- edited by the ministry and must be viewable in multiple languages.
--
-- Shape note: keyed by language code -> field map. Empty '{}' preserves current behavior
-- (canonical/source text is used as-is).

-- ── questionnaire_templates ────────────────────────────────────────────────────
-- translations: {
--   "<lang>": {
--     "label": "<translated label>",
--     "sections": {
--       "<sectionId>": {
--         "title": "...",
--         "description": "...",
--         "fields": {
--           "<fieldKey>": { "label": "...", "description": "...", "options": ["...", "..."] }
--         }
--       }
--     }
--   }
-- }
ALTER TABLE questionnaire_templates
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── non_financial_indicator_catalog ────────────────────────────────────────────
-- translations: { "<lang>": { "display_name": "...", "description": "...", "coop_type": "..." } }
ALTER TABLE non_financial_indicator_catalog
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── custom_kpis ────────────────────────────────────────────────────────────────
-- translations: { "<lang>": { "display_name": "...", "description": "..." } }
ALTER TABLE custom_kpis
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
