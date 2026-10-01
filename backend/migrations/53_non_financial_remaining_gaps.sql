-- Migration 53: three genuine gaps found during a full question-by-question
-- re-check of the non_financial template against the source PDF (Q10b, Q30,
-- Q47's last-year equity). Additive, admin-edit-safe. Idempotent.

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

-- Q10b: share capital contribution per member (distinct from Q10c's
-- aggregated total, already covered by total_share_capital).
SELECT _qt_add_fields('non_financial', 'membership', $j$
[
  {"key":"share_capital_contrib_per_member","label":"Share Capital Contribution per Member (E)","type":"number","required":false}
]
$j$::jsonb);

-- Q30: interest rate on savings/deposits. The PDF asks for a rate per
-- product (name + %); captured here as a single representative rate since
-- the template schema does not have a repeating-row field type outside
-- account_grid — labelled accordingly rather than implying per-product detail.
SELECT _qt_add_fields('non_financial', 'savings', $j$
[
  {"key":"savings_interest_rate_pct","label":"Interest Rate on Savings/Deposits (% per year, typical/average across products)","type":"number","required":false}
]
$j$::jsonb);

-- Q47: last-year total equity (current-year total_equity already existed).
SELECT _qt_add_fields('non_financial', 'financials', $j$
[
  {"key":"total_equity_last_year","label":"Total Equity — Last Year (E)","type":"number","required":false}
]
$j$::jsonb);

DROP FUNCTION IF EXISTS _qt_add_fields(TEXT, TEXT, JSONB);
