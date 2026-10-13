-- Migration 55: bring the non_financial questionnaire template to full parity
-- with the Eswatini "Non-Financial Primary Cooperatives Questionnaire"
-- (Parts I & II, 53 questions) and add the fields needed for the core +
-- secondary indicators in "Non-Financial Questionnaire Indicators.docx".
-- Uses the same additive, admin-edit-safe helpers as migration 43. Idempotent.

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

-- ── Part I: respondent / general information ─────────────────────────────────
SELECT _qt_add_fields('non_financial', 'general', $j$
[
  {"key":"respondent_tel","label":"Respondent Tel/Cell","type":"text","required":false},
  {"key":"date_registered","label":"Date Registered","type":"date","required":false},
  {"key":"reg_before_act","label":"Registration No — Before Act","type":"text","required":false},
  {"key":"reg_after_act","label":"Registration No — After Act","type":"text","required":false},
  {"key":"tel_cell","label":"Tel/Cell (Society)","type":"text","required":false},
  {"key":"fax","label":"Fax","type":"text","required":false},
  {"key":"email","label":"Email","type":"text","required":false},
  {"key":"website","label":"Website","type":"text","required":false},
  {"key":"inkhundla","label":"Inkhundla","type":"text","required":false},
  {"key":"interviewer_name","label":"Interviewer Name","type":"text","required":false},
  {"key":"interviewer_tel","label":"Interviewer Tel","type":"text","required":false},
  {"key":"interviewer_email","label":"Interviewer Email","type":"text","required":false},
  {"key":"survey_date","label":"Date of Survey","type":"date","required":false}
]
$j$::jsonb);

-- ── Membership: share capital contribution split by sex (Q10c) ──────────────
SELECT _qt_add_fields('non_financial', 'membership', $j$
[
  {"key":"share_capital_contrib_male","label":"Share Capital Contribution — Male (E)","type":"number","required":false},
  {"key":"share_capital_contrib_female","label":"Share Capital Contribution — Female (E)","type":"number","required":false}
]
$j$::jsonb);

-- ── Leadership & Committees: full committee breakdown, officer education,
--    manager, audit/inspection dates, staff composition, meetings ──────────
SELECT _qt_add_fields('non_financial', 'leadership', $j$
[
  {"key":"credit_committee_male","label":"Credit Committee — Male","type":"number","required":false},
  {"key":"credit_committee_female","label":"Credit Committee — Female","type":"number","required":false},
  {"key":"education_committee_male","label":"Education Committee — Male","type":"number","required":false},
  {"key":"education_committee_female","label":"Education Committee — Female","type":"number","required":false},
  {"key":"supervisory_committee_male","label":"Supervisory Committee — Male","type":"number","required":false},
  {"key":"supervisory_committee_female","label":"Supervisory Committee — Female","type":"number","required":false},
  {"key":"vice_chair_education","label":"Vice Chairperson Education Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
  {"key":"treasurer_education","label":"Treasurer Education Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
  {"key":"secretary_education","label":"Secretary Education Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
  {"key":"committee_oriented_date","label":"Date Management Committee Oriented","type":"date","required":false},
  {"key":"manager_sex","label":"Manager/CEO Sex","type":"select","required":false,"options":["Male","Female"]},
  {"key":"manager_academic_level","label":"Manager Academic Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
  {"key":"manager_coop_training_level","label":"Manager Cooperative Training Level","type":"text","required":false},
  {"key":"last_audit_date","label":"Date of Last Audit","type":"date","required":false},
  {"key":"last_inspection_date","label":"Date of Last Inspection","type":"date","required":false},
  {"key":"last_mgmt_report_date","label":"Date of Last Management Report","type":"date","required":false},
  {"key":"last_budget_date","label":"Date of Last Budget","type":"date","required":false},
  {"key":"last_committee_profile_date","label":"Date of Last Committee Profile","type":"date","required":false},
  {"key":"last_audit_firm_name","label":"Name of Last Audit Firm","type":"text","required":false},
  {"key":"staff_manager_male","label":"Staff — Manager/CEO/GM — Male","type":"number","required":false},
  {"key":"staff_manager_female","label":"Staff — Manager/CEO/GM — Female","type":"number","required":false},
  {"key":"staff_ass_manager_male","label":"Staff — Assistant Manager — Male","type":"number","required":false},
  {"key":"staff_ass_manager_female","label":"Staff — Assistant Manager — Female","type":"number","required":false},
  {"key":"staff_accountant_male","label":"Staff — Accountant/Bookkeeper — Male","type":"number","required":false},
  {"key":"staff_accountant_female","label":"Staff — Accountant/Bookkeeper — Female","type":"number","required":false},
  {"key":"staff_other_mgmt_male","label":"Staff — Other Management Level — Male","type":"number","required":false},
  {"key":"staff_other_mgmt_female","label":"Staff — Other Management Level — Female","type":"number","required":false},
  {"key":"staff_other_support_male","label":"Staff — Other Support/Contract — Male","type":"number","required":false},
  {"key":"staff_other_support_female","label":"Staff — Other Support/Contract — Female","type":"number","required":false},
  {"key":"meeting_frequency","label":"Management Committee Meeting Frequency","type":"select","required":false,"options":["Once a Month","Twice a Month","Quarterly","Other"]},
  {"key":"meetings_held_count","label":"Actual Number of Meetings Held (Last 12 Months)","type":"number","required":false},
  {"key":"meeting_purpose","label":"Purpose of Meetings","type":"textarea","required":false}
]
$j$::jsonb);

-- ── Training: recommended future training areas (Q23) ───────────────────────
SELECT _qt_add_fields('non_financial', 'training', $j$
[
  {"key":"training_areas_members","label":"Recommended Future Training Areas — Members","type":"textarea","required":false},
  {"key":"training_areas_leaders","label":"Recommended Future Training Areas — Leaders","type":"textarea","required":false},
  {"key":"training_areas_staff","label":"Recommended Future Training Areas — Staff","type":"textarea","required":false}
]
$j$::jsonb);

-- ── Capitalization: actual statutory reserves, last-year reserves, actual
--    monetary reserves in the bank (current + last year), capital growth ────
SELECT _qt_add_fields('non_financial', 'capitalization', $j$
[
  {"key":"actual_statutory_reserves","label":"Actual Statutory Reserves (E)","type":"number","required":false},
  {"key":"accumulated_book_reserves_last_year","label":"Accumulated Statutory Reserves — Last Year (E)","type":"number","required":false},
  {"key":"actual_monetary_reserves_bank","label":"Actual Monetary Reserves in the Bank (E)","type":"number","required":false},
  {"key":"actual_monetary_reserves_bank_last_year","label":"Actual Monetary Reserves in the Bank — Last Year (E)","type":"number","required":false},
  {"key":"total_share_capital_last_year","label":"Total Share Capital — Last Year (E)","type":"number","required":false}
]
$j$::jsonb);

-- ── Activity performance: full main-activity table, other-activities income,
--    full threats list, competitor advantage, recommendations ──────────────
SELECT _qt_add_fields('non_financial', 'performance', $j$
[
  {"key":"main_activity_1_unit","label":"Main Activity 1 — Unit of Measure","type":"text","required":false},
  {"key":"main_activity_1_output","label":"Main Activity 1 — Annual Output","type":"number","required":false},
  {"key":"main_activity_1_net_surplus","label":"Main Activity 1 — Net Surplus/(Deficit) (E)","type":"number","required":false},
  {"key":"main_activity_1_distrib_members","label":"Main Activity 1 — Distributed to Members (E)","type":"number","required":false},
  {"key":"main_activity_1_last_distrib_date","label":"Main Activity 1 — Date of Last Distribution","type":"date","required":false},
  {"key":"main_activity_2_unit","label":"Main Activity 2 — Unit of Measure","type":"text","required":false},
  {"key":"main_activity_2_output","label":"Main Activity 2 — Annual Output","type":"number","required":false},
  {"key":"main_activity_2_net_surplus","label":"Main Activity 2 — Net Surplus/(Deficit) (E)","type":"number","required":false},
  {"key":"main_activity_2_distrib_members","label":"Main Activity 2 — Distributed to Members (E)","type":"number","required":false},
  {"key":"other_activities_income","label":"Other Activities — Total Annual Income (E)","type":"number","required":false},
  {"key":"other_activities_expenditure","label":"Other Activities — Total Annual Expenditure (E)","type":"number","required":false},
  {"key":"creditors_members","label":"Total Owed to Creditors — Members (E)","type":"number","required":false},
  {"key":"outstanding_bank_loans","label":"Outstanding Loans Owed to Banks (E)","type":"number","required":false},
  {"key":"payments_owed_to_members","label":"Outstanding Payments Owed to Members (E)","type":"number","required":false},
  {"key":"disputes_resolved","label":"Number of Disputes — Resolved","type":"number","required":false},
  {"key":"disputes_unresolved","label":"Number of Disputes — Unresolved","type":"number","required":false},
  {"key":"competitor_advantage_factors","label":"Main Factors Giving Competitors an Advantage","type":"textarea","required":false},
  {"key":"future_recommendations","label":"Main Recommendations to Current Challenges","type":"textarea","required":false}
]
$j$::jsonb);

-- ── Financial Summary: last-year balance sheet, reporting frequency ──────────
SELECT _qt_add_fields('non_financial', 'financials', $j$
[
  {"key":"non_current_assets_last_year","label":"Non-Current Assets — Last Year (E)","type":"number","required":false},
  {"key":"total_current_assets_last_year","label":"Total Current Assets — Last Year (E)","type":"number","required":false},
  {"key":"total_liabilities_last_year","label":"Total Liabilities — Last Year (E)","type":"number","required":false},
  {"key":"reporting_frequency","label":"Periodic Financial Reporting Frequency","type":"select","required":false,"options":["Weekly","Monthly","Quarterly","Annually","Other"]}
]
$j$::jsonb);

-- ── New section: Savings Portfolio (Q28-31) ──────────────────────────────────
SELECT _qt_add_section('non_financial', $j$
{"id":"savings","title":"Savings Portfolio","icon":"💰","description":"Deposit accounts, savings values and investments","fields":[
  {"key":"savings_accounts_male","label":"Savings Accounts — Male","type":"number","required":false},
  {"key":"savings_accounts_female","label":"Savings Accounts — Female","type":"number","required":false},
  {"key":"savings_value_male","label":"Net Savings Value — Male (E)","type":"number","required":false},
  {"key":"savings_value_female","label":"Net Savings Value — Female (E)","type":"number","required":false},
  {"key":"bank_investment","label":"Money Invested in Bank — Balance to Date (E)","type":"number","required":false},
  {"key":"share_investment","label":"Money Invested in Shares — Balance to Date (E)","type":"number","required":false},
  {"key":"other_investments","label":"Other Investments — Balance to Date (E)","type":"number","required":false}
]}
$j$::jsonb);

-- ── New section: Loan Portfolio (Q32-44), PAR buckets aligned with the
--    financial questionnaire's loan_quality section for a real PAR 30+ calc ─
SELECT _qt_add_section('non_financial', $j$
{"id":"loans","title":"Loan Portfolio","icon":"📈","description":"Loans issued, outstanding and delinquent, and loan terms","fields":[
  {"key":"loans_issued_male","label":"Loan Accounts Issued — Male","type":"number","required":false},
  {"key":"loans_issued_female","label":"Loan Accounts Issued — Female","type":"number","required":false},
  {"key":"loans_issued_coops","label":"Loan Accounts Issued — Cooperatives","type":"number","required":false},
  {"key":"loans_value_issued_male","label":"Total Value of Loans Issued — Male (E)","type":"number","required":false},
  {"key":"loans_value_issued_female","label":"Total Value of Loans Issued — Female (E)","type":"number","required":false},
  {"key":"loans_value_issued_coops","label":"Total Value of Loans Issued — Cooperatives (E)","type":"number","required":false},
  {"key":"loans_outstanding_accounts_male","label":"Outstanding Loan Accounts — Male","type":"number","required":false},
  {"key":"loans_outstanding_accounts_female","label":"Outstanding Loan Accounts — Female","type":"number","required":false},
  {"key":"loans_outstanding_accounts_coops","label":"Outstanding Loan Accounts — Cooperatives","type":"number","required":false},
  {"key":"loans_outstanding_value_male","label":"Total Value of Outstanding Loans — Male (E)","type":"number","required":false},
  {"key":"loans_outstanding_value_female","label":"Total Value of Outstanding Loans — Female (E)","type":"number","required":false},
  {"key":"loans_outstanding_value_coops","label":"Total Value of Outstanding Loans — Cooperatives (E)","type":"number","required":false},
  {"key":"loans_delinquent_accounts_male","label":"Delinquent Loan Accounts — Male","type":"number","required":false},
  {"key":"loans_delinquent_accounts_female","label":"Delinquent Loan Accounts — Female","type":"number","required":false},
  {"key":"loans_delinquent_accounts_coops","label":"Delinquent Loan Accounts — Cooperatives","type":"number","required":false},
  {"key":"par_1_7_value","label":"Outstanding Balance of Loans 1–7 Days Overdue (E)","type":"number","required":false},
  {"key":"par_8_30_value","label":"Outstanding Balance of Loans 8–30 Days Overdue (E)","type":"number","required":false},
  {"key":"par_31_90_value","label":"Outstanding Balance of Loans 31–90 Days Overdue (E)","type":"number","required":false},
  {"key":"par_91_180_value","label":"Outstanding Balance of Loans 91–180 Days Overdue (E)","type":"number","required":false},
  {"key":"par_181_360_value","label":"Outstanding Balance of Loans 181–360 Days Overdue (E)","type":"number","required":false},
  {"key":"par_over_360_value","label":"Outstanding Balance of Loans Over 360 Days Overdue (E)","type":"number","required":false},
  {"key":"written_off_loans_value","label":"Total Value of Written-off Loans (Beyond 12 Months) (E)","type":"number","required":false},
  {"key":"recovered_loans_last_12mo","label":"Total Value of Recovered Loans — Last 12 Months (E)","type":"number","required":false},
  {"key":"avg_loan_term_months","label":"Average Loan Term / Repayment Period (Months)","type":"number","required":false},
  {"key":"avg_interest_rate_monthly","label":"Average Interest Rate on Loans (% per month)","type":"number","required":false},
  {"key":"fee_stationery","label":"Fees/Charges — Stationery","type":"number","required":false},
  {"key":"fee_application","label":"Fees/Charges — Application","type":"number","required":false},
  {"key":"fee_loan_protection","label":"Fees/Charges — Loan Protection","type":"number","required":false},
  {"key":"fee_penalties","label":"Fees/Charges — Penalties/Fines","type":"number","required":false},
  {"key":"fee_other","label":"Fees/Charges — Other","type":"number","required":false},
  {"key":"interest_rate_method","label":"Interest Rate Calculation Method","type":"select","required":false,"options":["Declining balance","Flat rate","Both"]}
]}
$j$::jsonb);

DROP FUNCTION IF EXISTS _qt_add_section(TEXT, JSONB);
DROP FUNCTION IF EXISTS _qt_add_fields(TEXT, TEXT, JSONB);
