-- Migration 52: fix data corruption found in the live non_financial
-- questionnaire template's "financials" section — a stray test field
-- ({"key":"h","label":"h",...}, almost certainly left behind by someone
-- testing the ministry template editor) had replaced three original fields
-- from migration 25 (total_equity, success_reasons, challenges) that a
-- wholesale section save must have dropped. Confirmed by diffing the live
-- template against this migration's own source and against the untouched
-- financial template, which still has all three. Idempotent.

DO $$
DECLARE
    tpl RECORD;
    new_sections JSONB;
BEGIN
    FOR tpl IN
        SELECT id, sections FROM questionnaire_templates
        WHERE questionnaire_type = 'non_financial' AND is_active
    LOOP
        -- Drop the stray "h" field from every section.
        SELECT jsonb_agg(
            jsonb_set(
                s, '{fields}',
                COALESCE((
                    SELECT jsonb_agg(f) FROM jsonb_array_elements(s->'fields') f
                    WHERE f->>'key' != 'h'
                ), '[]'::jsonb)
            ) ORDER BY ord
        )
        INTO new_sections
        FROM jsonb_array_elements(tpl.sections) WITH ORDINALITY AS t(s, ord);

        UPDATE questionnaire_templates SET sections = new_sections, updated_at = NOW() WHERE id = tpl.id;
    END LOOP;

    -- Restore the three dropped fields to the "financials" section (skipped
    -- automatically if somehow already present).
    UPDATE questionnaire_templates
    SET sections = (
        SELECT jsonb_agg(
            CASE
                WHEN s->>'id' = 'financials' THEN
                    jsonb_set(s, '{fields}',
                        COALESCE(s->'fields', '[]'::jsonb) || COALESCE((
                            SELECT jsonb_agg(f)
                            FROM jsonb_array_elements($j$
                            [
                              {"key":"total_equity","label":"Total Equity (E)","type":"number","required":false},
                              {"key":"success_reasons","label":"Main Success Reasons","type":"textarea","required":false},
                              {"key":"challenges","label":"Main Challenges/Failures","type":"textarea","required":false}
                            ]
                            $j$::jsonb) f
                            WHERE NOT EXISTS (
                                SELECT 1 FROM jsonb_array_elements(COALESCE(s->'fields', '[]'::jsonb)) e
                                WHERE e->>'key' = f->>'key'
                            )
                        ), '[]'::jsonb))
                ELSE s
            END
        )
        FROM jsonb_array_elements(sections) s
    ),
    updated_at = NOW()
    WHERE questionnaire_type = 'non_financial' AND is_active;
END $$;
