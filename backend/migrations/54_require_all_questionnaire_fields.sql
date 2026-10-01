-- Migration 54: make the "Required" badge in the ministry template editor
-- match the questionnaire wizard's actual behavior (every field blocks
-- progress regardless of the flag) by setting required=true everywhere.
-- Also removes test debris left behind by someone exercising the ministry
-- template editor (confirmed junk, not real content):
--   - non_financial "financials" section had a stray {"key":"h",...} field
--     already removed by migration 52; its description had separately been
--     overwritten to literal "test eng" on respondent_name.
--   - translations (fr/pt/ss) for this template are 100% placeholder test
--     values ("name fr", "desc port", a section titled literally "swa", an
--     orphaned test field "test_1"/"name_fr"/"number_of_members", and a
--     phantom test section "section_1788615955373" that was never in the
--     live form). No real translation work exists yet, so they are cleared
--     rather than left actively wrong.
-- Idempotent.

-- ── 1. Every field in the active non_financial template becomes required ────
UPDATE questionnaire_templates
SET sections = (
    SELECT jsonb_agg(
        jsonb_set(
            s, '{fields}',
            COALESCE((
                SELECT jsonb_agg(jsonb_set(f, '{required}', 'true'::jsonb))
                FROM jsonb_array_elements(s->'fields') f
            ), '[]'::jsonb)
        )
    )
    FROM jsonb_array_elements(sections) s
),
updated_at = NOW()
WHERE questionnaire_type = 'non_financial' AND is_active;

-- ── 2. Same for the active financial (chart-of-accounts) template's grid
--      fields — one account_grid field per section; required means "at
--      least one row filled in", same convention the wizard already uses. ─
UPDATE questionnaire_templates
SET sections = (
    SELECT jsonb_agg(
        jsonb_set(
            s, '{fields}',
            COALESCE((
                SELECT jsonb_agg(jsonb_set(f, '{required}', 'true'::jsonb))
                FROM jsonb_array_elements(s->'fields') f
            ), '[]'::jsonb)
        )
    )
    FROM jsonb_array_elements(sections) s
),
updated_at = NOW()
WHERE questionnaire_type = 'financial' AND is_active;

-- ── 3. Clear the "test eng" debris left on respondent_name's description ────
UPDATE questionnaire_templates
SET sections = (
    SELECT jsonb_agg(
        CASE
            WHEN s->>'id' = 'general' THEN
                jsonb_set(s, '{fields}',
                    (SELECT jsonb_agg(
                        CASE
                            WHEN f->>'key' = 'respondent_name' AND f->>'description' = 'test eng'
                                THEN f - 'description'
                            ELSE f
                        END
                    ) FROM jsonb_array_elements(s->'fields') f)
                )
            ELSE s
        END
    )
    FROM jsonb_array_elements(sections) s
),
updated_at = NOW()
WHERE questionnaire_type = 'non_financial' AND is_active;

-- ── 4. Prune orphaned translation entries: any section or field key under
--      translations.<lang>.sections that no longer exists in the live
--      `sections` is debris from editing that was since undone (or, here,
--      test sections/fields that were added and removed) — never real
--      content for a field that still exists, so this is safe to run
--      anywhere, not just on this dev DB. ─────────────────────────────────
UPDATE questionnaire_templates t
SET translations = (
    SELECT jsonb_object_agg(lang, lang_val)
    FROM (
        SELECT
            lang,
            jsonb_set(
                lang_data,
                '{sections}',
                COALESCE((
                    SELECT jsonb_object_agg(sec_id, sec_val)
                    FROM (
                        SELECT
                            sec_id,
                            CASE WHEN sec_val ? 'fields' THEN
                                jsonb_set(
                                    sec_val,
                                    '{fields}',
                                    COALESCE((
                                        SELECT jsonb_object_agg(field_key, field_val)
                                        FROM jsonb_each(sec_val->'fields') AS tf(field_key, field_val)
                                        WHERE EXISTS (
                                            SELECT 1 FROM jsonb_array_elements(live_sec->'fields') lf
                                            WHERE lf->>'key' = field_key
                                        )
                                    ), '{}'::jsonb)
                                )
                            ELSE sec_val END AS sec_val
                        FROM jsonb_each(lang_data->'sections') AS ts(sec_id, sec_val)
                        JOIN LATERAL (
                            SELECT s AS live_sec FROM jsonb_array_elements(t.sections) s
                            WHERE s->>'id' = sec_id
                        ) live ON true
                    ) pruned_sections
                ), '{}'::jsonb)
            ) AS lang_val
        FROM jsonb_each(t.translations) AS tl(lang, lang_data)
        WHERE lang_data ? 'sections'
    ) pruned_langs
)
WHERE t.questionnaire_type = 'non_financial' AND t.is_active AND t.translations != '{}'::jsonb;
