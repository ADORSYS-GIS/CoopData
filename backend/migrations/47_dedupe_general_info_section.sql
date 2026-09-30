-- Migration 47: stop asking the same "General Information" questions twice.
--
-- The financial and non_financial questionnaire templates each carry their
-- own independent "general" section, copy-pasted from one another: 11 of
-- their fields are byte-identical (society_name, registration_no, reg_status,
-- common_bond, postal_address, physical_address, region, office_status,
-- affiliated_to, respondent_name, respondent_position). A cooperative filing
-- both questionnaires for one period re-types the same answers twice.
--
-- Consolidate: the non_financial "general" section becomes the single place
-- that asks for organisation/contact details (gaining the financial-only
-- contact fields it didn't have: respondent_tel, tel_cell, email, website,
-- inkhundla). The financial template's "general" section is dropped
-- entirely — everything it asked is now covered by the non_financial one.
--
-- Fully idempotent and additive/subtractive only: existing fields an admin
-- may have since added are left untouched, and re-running this migration is
-- a no-op once applied.

CREATE OR REPLACE FUNCTION _qt_add_fields(p_type TEXT, p_section_id TEXT, p_fields JSONB) RETURNS VOID AS $$
DECLARE
    tpl RECORD;
    new_sections JSONB;
BEGIN
    FOR tpl IN SELECT id, sections FROM questionnaire_templates WHERE questionnaire_type = p_type AND is_active LOOP
        SELECT COALESCE(jsonb_agg(
            CASE
                WHEN s->>'id' = p_section_id THEN
                    jsonb_set(s, '{fields}',
                        COALESCE(s->'fields', '[]'::jsonb) || COALESCE((
                            SELECT jsonb_agg(f)
                            FROM jsonb_array_elements(p_fields) f
                            WHERE NOT EXISTS (
                                SELECT 1 FROM jsonb_array_elements(COALESCE(s->'fields', '[]'::jsonb)) e
                                WHERE e->>'key' = f->>'key'
                            )
                        ), '[]'::jsonb))
                ELSE s
            END ORDER BY ord), '[]'::jsonb)
        INTO new_sections
        FROM jsonb_array_elements(tpl.sections) WITH ORDINALITY AS t(s, ord);

        UPDATE questionnaire_templates SET sections = new_sections, updated_at = NOW() WHERE id = tpl.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _qt_remove_section(p_type TEXT, p_section_id TEXT) RETURNS VOID AS $$
BEGIN
    UPDATE questionnaire_templates
    SET sections = COALESCE((
            SELECT jsonb_agg(s ORDER BY ord)
            FROM jsonb_array_elements(sections) WITH ORDINALITY AS t(s, ord)
            WHERE s->>'id' != p_section_id
        ), '[]'::jsonb),
        updated_at = NOW()
    WHERE questionnaire_type = p_type
      AND is_active
      AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(sections) s WHERE s->>'id' = p_section_id
      );
END;
$$ LANGUAGE plpgsql;

-- ── 1. Give non_financial's "general" section the contact fields only
--      financial's copy had ─────────────────────────────────────────────────
SELECT _qt_add_fields('non_financial', 'general', $j$
[
  {"key":"respondent_tel","label":"Tel/Cell","type":"text","required":false},
  {"key":"tel_cell","label":"Tel/Cell (Society)","type":"text","required":false},
  {"key":"email","label":"Email","type":"text","required":false},
  {"key":"website","label":"Website","type":"text","required":false},
  {"key":"inkhundla","label":"Inkhundla","type":"text","required":false}
]
$j$::jsonb);

-- ── 2. Drop the now fully-redundant "general" section from financial ────────
SELECT _qt_remove_section('financial', 'general');

DROP FUNCTION IF EXISTS _qt_add_fields(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS _qt_remove_section(TEXT, TEXT);
