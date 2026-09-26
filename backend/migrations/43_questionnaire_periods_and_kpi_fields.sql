-- Migration 43: period-aware questionnaire responses and the extra questionnaire
-- fields needed to compute the regulator KPI set (PAR buckets, liquidity,
-- arrears counts, interest in suspense, ...). Fully idempotent.

-- ── 1. Period on questionnaire responses ─────────────────────────────────────
ALTER TABLE questionnaire_responses
    ADD COLUMN IF NOT EXISTS period_type  VARCHAR(20) NOT NULL DEFAULT 'YEARLY',
    ADD COLUMN IF NOT EXISTS period_value VARCHAR(20) NOT NULL DEFAULT '';

UPDATE questionnaire_responses qr
SET period_type  = s.period_type::text,
    period_value = COALESCE(s.period_value, '')
FROM submissions s
WHERE s.id = qr.submission_id
  AND (qr.period_type IS DISTINCT FROM s.period_type::text
       OR qr.period_value IS DISTINCT FROM COALESCE(s.period_value, ''));

-- One response per submission and questionnaire type is the real key. The old
-- (cooperative, year, type) constraints made a Q1 and a Q4 return of the same
-- year collide, which blocks quarterly reporting.
ALTER TABLE questionnaire_responses DROP CONSTRAINT IF EXISTS unique_coop_year_type_questionnaire;
ALTER TABLE questionnaire_responses DROP CONSTRAINT IF EXISTS unique_coop_year_questionnaire_type;
ALTER TABLE questionnaire_responses DROP CONSTRAINT IF EXISTS unique_coop_year_questionnaire;

CREATE INDEX IF NOT EXISTS idx_qr_coop_period
    ON questionnaire_responses (cooperative_id, reporting_year, period_type, period_value);

-- ── 2. Helpers to extend the active templates without overwriting admin edits ─
CREATE OR REPLACE FUNCTION _qt_add_section(p_type TEXT, p_section JSONB) RETURNS VOID AS $$
BEGIN
    UPDATE questionnaire_templates
    SET sections = sections || jsonb_build_array(p_section),
        updated_at = NOW()
    WHERE questionnaire_type = p_type
      AND is_active
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(sections) s WHERE s->>'id' = p_section->>'id'
      );
END;
$$ LANGUAGE plpgsql;

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

-- ── 3. Financial questionnaire: loan quality & arrears ───────────────────────
SELECT _qt_add_section('financial', $j$
{"id":"loan_quality","title":"Loan Quality & Arrears","icon":"🛡️","description":"Arrears by days overdue and other risk indicators used for PAR and Value-at-Risk","fields":[
  {"key":"loans_outstanding_count","label":"Number of Loans Outstanding","type":"number","required":false},
  {"key":"loans_in_arrears_count","label":"Number of Loans in Arrears","type":"number","required":false},
  {"key":"loans_awaiting_approval","label":"Loans Awaiting Approval","type":"number","required":false},
  {"key":"female_borrowers_count","label":"Number of Female Borrowers","type":"number","required":false},
  {"key":"total_disbursed_active","label":"Total Disbursed on Active Loans (E)","type":"number","required":false},
  {"key":"par_1_7_value","label":"Outstanding Balance of Loans 1–7 Days Overdue (E)","type":"number","required":false},
  {"key":"par_8_30_value","label":"Outstanding Balance of Loans 8–30 Days Overdue (E)","type":"number","required":false},
  {"key":"par_31_90_value","label":"Outstanding Balance of Loans 31–90 Days Overdue (E)","type":"number","required":false},
  {"key":"par_91_180_value","label":"Outstanding Balance of Loans 91–180 Days Overdue (E)","type":"number","required":false},
  {"key":"par_181_360_value","label":"Outstanding Balance of Loans 181–360 Days Overdue (E)","type":"number","required":false},
  {"key":"par_over_360_value","label":"Outstanding Balance of Loans Over 360 Days Overdue (E)","type":"number","required":false},
  {"key":"interest_in_suspense","label":"Interest in Suspense (E)","type":"number","required":false},
  {"key":"interest_payable","label":"Interest Payable (E)","type":"number","required":false},
  {"key":"total_overdrafts","label":"Total Overdrafts (E)","type":"number","required":false},
  {"key":"number_of_groups","label":"Number of Member Groups","type":"number","required":false}
]}
$j$::jsonb);

-- ── 4. Financial questionnaire: liquidity ────────────────────────────────────
SELECT _qt_add_section('financial', $j$
{"id":"liquidity","title":"Liquidity & Cash","icon":"💧","description":"Cash holdings used for the liquidity-to-member-savings ratio","fields":[
  {"key":"cash_on_hand","label":"Cash on Hand (E)","type":"number","required":false},
  {"key":"cash_at_bank_current","label":"Cash at Bank – Current Account (E)","type":"number","required":false}
]}
$j$::jsonb);

-- ── 5. Non-financial questionnaire: complete the age bands ───────────────────
SELECT _qt_add_fields('non_financial', 'membership', $j$
[
  {"key":"age_61plus_male","label":"Age 61+ – Male","type":"number","required":false},
  {"key":"age_61plus_female","label":"Age 61+ – Female","type":"number","required":false}
]
$j$::jsonb);

DROP FUNCTION IF EXISTS _qt_add_section(TEXT, JSONB);
DROP FUNCTION IF EXISTS _qt_add_fields(TEXT, TEXT, JSONB);
