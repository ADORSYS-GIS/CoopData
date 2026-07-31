-- Migration 25: Questionnaire Templates
-- Adds a questionnaire_templates table for admin-configurable form definitions

-- ── questionnaire_templates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questionnaire_templates (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_type VARCHAR(50)  NOT NULL,   -- 'financial' or 'non_financial'
    version            INT          NOT NULL DEFAULT 1,
    label              VARCHAR(200) NOT NULL,
    sections           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    -- sections schema:
    -- [{
    --   "id": "general",
    --   "title": "General Information",
    --   "icon": "Building2",
    --   "description": "Basic details about the cooperative",
    --   "fields": [{
    --     "key": "society_name",
    --     "label": "Name of Society",
    --     "type": "text",           -- text | number | select | textarea | date
    --     "required": true,
    --     "options": []             -- only for type=select
    --   }]
    -- }]
    is_active          BOOLEAN      NOT NULL DEFAULT false,
    created_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only one active template per questionnaire_type at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_templates_active_type
    ON questionnaire_templates (questionnaire_type)
    WHERE is_active = true;

-- ── Fix: allow multiple questionnaire types per cooperative per year ──────────
-- Remove the old constraint that blocked financial + non-financial in same year
ALTER TABLE questionnaire_responses
    DROP CONSTRAINT IF EXISTS unique_coop_year_questionnaire;

-- Add a new constraint: one questionnaire per type per cooperative per year
ALTER TABLE questionnaire_responses
    DROP CONSTRAINT IF EXISTS unique_coop_year_type_questionnaire;
ALTER TABLE questionnaire_responses
    ADD CONSTRAINT unique_coop_year_type_questionnaire
    UNIQUE (cooperative_id, reporting_year, questionnaire_type);

-- ── Seed default Financial template ───────────────────────────────────────────
INSERT INTO questionnaire_templates (questionnaire_type, version, label, is_active, sections)
VALUES (
    'financial',
    1,
    'Financial Primary Cooperatives Questionnaire v1',
    true,
    '[
      {"id":"general","title":"General Information","icon":"Building2","description":"Basic details about your SACCO","fields":[
        {"key":"respondent_name","label":"Respondent Name","type":"text","required":false},
        {"key":"respondent_position","label":"Position","type":"text","required":false},
        {"key":"respondent_tel","label":"Tel/Cell","type":"text","required":false},
        {"key":"society_name","label":"Name of Society","type":"text","required":true},
        {"key":"registration_no","label":"Registration No","type":"text","required":true},
        {"key":"reg_status","label":"Registration Status","type":"select","required":false,"options":["Provisional","Fully"]},
        {"key":"common_bond","label":"Common Bond","type":"text","required":false},
        {"key":"postal_address","label":"Postal Address","type":"textarea","required":false},
        {"key":"physical_address","label":"Physical Address","type":"textarea","required":false},
        {"key":"tel_cell","label":"Tel/Cell (Society)","type":"text","required":false},
        {"key":"email","label":"Email","type":"text","required":false},
        {"key":"website","label":"Website","type":"text","required":false},
        {"key":"inkhundla","label":"Inkhundla","type":"text","required":false},
        {"key":"region","label":"Region","type":"select","required":false,"options":["Hhohho","Manzini","Shiselweni","Lubombo"]},
        {"key":"office_status","label":"Society Office Is?","type":"select","required":false,"options":["Rented","Provided Free","Owned","Don''t have"]},
        {"key":"affiliated_to","label":"Affiliated To","type":"text","required":false}
      ]},
      {"id":"leadership","title":"Leadership & Management","icon":"Users","description":"Committee and staff composition","fields":[
        {"key":"board_male","label":"Board/Management Committee – Male","type":"number","required":false},
        {"key":"board_female","label":"Board/Management Committee – Female","type":"number","required":false},
        {"key":"exec_male","label":"Executive Committee – Male","type":"number","required":false},
        {"key":"exec_female","label":"Executive Committee – Female","type":"number","required":false},
        {"key":"credit_committee_male","label":"Credit Committee – Male","type":"number","required":false},
        {"key":"credit_committee_female","label":"Credit Committee – Female","type":"number","required":false},
        {"key":"chairperson_education","label":"Chairperson Highest Education","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
        {"key":"manager_academic_level","label":"Manager Academic Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
        {"key":"manager_coop_training","label":"Manager Cooperative Training","type":"text","required":false}
      ]},
      {"id":"training","title":"Training & Capacity","icon":"BookOpen","description":"Training activities in the last year","fields":[
        {"key":"members_trained_last_year","label":"Members Trained Last Year","type":"number","required":false},
        {"key":"leaders_trained_last_year","label":"Leaders Trained Last Year","type":"number","required":false},
        {"key":"staff_trained_last_year","label":"Staff Trained Last Year","type":"number","required":false},
        {"key":"training_sponsor","label":"Who Mainly Sponsored Training?","type":"select","required":false,"options":["SACCO","The Government","Apex","Others"]},
        {"key":"training_quality","label":"Training Quality Rating","type":"select","required":false,"options":["Very good","Good","Fair","Poor","Very Poor"]},
        {"key":"training_cost_proportion","label":"Training Cost Coverage (%)","type":"number","required":false}
      ]},
      {"id":"membership","title":"SACCO Membership","icon":"Users","description":"Member counts and activity","fields":[
        {"key":"registered_members_male","label":"Registered Members – Male","type":"number","required":false},
        {"key":"registered_members_female","label":"Registered Members – Female","type":"number","required":false},
        {"key":"active_members_male","label":"Active Members – Male","type":"number","required":false},
        {"key":"active_members_female","label":"Active Members – Female","type":"number","required":false},
        {"key":"age_18_25_male","label":"Age 18-25 – Male","type":"number","required":false},
        {"key":"age_18_25_female","label":"Age 18-25 – Female","type":"number","required":false},
        {"key":"age_26_35_male","label":"Age 26-35 – Male","type":"number","required":false},
        {"key":"age_26_35_female","label":"Age 26-35 – Female","type":"number","required":false},
        {"key":"age_36_60_male","label":"Age 36-60 – Male","type":"number","required":false},
        {"key":"age_36_60_female","label":"Age 36-60 – Female","type":"number","required":false},
        {"key":"age_61plus_male","label":"Age 61+ – Male","type":"number","required":false},
        {"key":"age_61plus_female","label":"Age 61+ – Female","type":"number","required":false},
        {"key":"society_status","label":"Society Status","type":"select","required":false,"options":["Active","Dormant","New","Under Liquidation"]}
      ]},
      {"id":"capitalization","title":"Capitalization","icon":"DollarSign","description":"Share capital and reserves","fields":[
        {"key":"share_nominal_value","label":"Share Nominal Value (E per share)","type":"number","required":false},
        {"key":"total_share_capital","label":"Total Share Capital Aggregated (E)","type":"number","required":false},
        {"key":"borrowed_funds_total","label":"Borrowed Funds – Total (E)","type":"number","required":false},
        {"key":"donations_grants","label":"Donations/Grants (E)","type":"number","required":false},
        {"key":"accumulated_statutory_reserves","label":"Accumulated Statutory Reserves (E)","type":"number","required":false},
        {"key":"retained_earnings","label":"Retained Earnings (E)","type":"number","required":false}
      ]},
      {"id":"savings","title":"Savings Portfolio","icon":"DollarSign","description":"Deposits and savings accounts","fields":[
        {"key":"savings_accounts_male","label":"Savings Accounts – Male","type":"number","required":false},
        {"key":"savings_accounts_female","label":"Savings Accounts – Female","type":"number","required":false},
        {"key":"savings_value_male","label":"Net Savings Value – Male (E)","type":"number","required":false},
        {"key":"savings_value_female","label":"Net Savings Value – Female (E)","type":"number","required":false},
        {"key":"bank_investment","label":"Money in Bank (E)","type":"number","required":false},
        {"key":"share_investment","label":"Money in Shares (E)","type":"number","required":false},
        {"key":"other_investments","label":"Other Investments (E)","type":"number","required":false}
      ]},
      {"id":"loans","title":"Loan Portfolio","icon":"TrendingUp","description":"Loans issued and outstanding","fields":[
        {"key":"loans_issued_male","label":"Loan Accounts Issued – Male","type":"number","required":false},
        {"key":"loans_issued_female","label":"Loan Accounts Issued – Female","type":"number","required":false},
        {"key":"outstanding_value_male","label":"Outstanding Loans – Male (E)","type":"number","required":false},
        {"key":"outstanding_value_female","label":"Outstanding Loans – Female (E)","type":"number","required":false},
        {"key":"delinquent_value_0_30","label":"Delinquent Loans 0–30 Days (E)","type":"number","required":false},
        {"key":"delinquent_value_31_365","label":"Delinquent Loans 31–365 Days (E)","type":"number","required":false},
        {"key":"written_off_loans","label":"Written-off Loans (E)","type":"number","required":false},
        {"key":"avg_loan_term_months","label":"Average Loan Term (Months)","type":"number","required":false},
        {"key":"avg_interest_rate","label":"Average Interest Rate (% per month)","type":"number","required":false},
        {"key":"interest_rate_method","label":"Interest Rate Method","type":"select","required":false,"options":["Declining balance","Flat rate","Both"]}
      ]},
      {"id":"financials","title":"Financial Performance","icon":"BarChart3","description":"Income, expenditure and balance sheet summary","fields":[
        {"key":"current_total_income","label":"Current Year Total Income (E)","type":"number","required":false},
        {"key":"current_total_expenditure","label":"Current Year Total Expenditure (E)","type":"number","required":false},
        {"key":"current_net_income","label":"Current Year Net Income (E)","type":"number","required":false},
        {"key":"last_total_income","label":"Last Year Total Income (E)","type":"number","required":false},
        {"key":"last_total_expenditure","label":"Last Year Total Expenditure (E)","type":"number","required":false},
        {"key":"non_current_assets","label":"Non-Current Assets (E)","type":"number","required":false},
        {"key":"total_current_assets","label":"Total Current Assets (E)","type":"number","required":false},
        {"key":"current_liabilities","label":"Current Liabilities (E)","type":"number","required":false},
        {"key":"total_equity","label":"Total Equity (E)","type":"number","required":false},
        {"key":"challenges","label":"Main Challenges/Failures","type":"textarea","required":false},
        {"key":"success_reasons","label":"Main Success Reasons","type":"textarea","required":false}
      ]}
    ]'::jsonb
) ON CONFLICT DO NOTHING;

-- ── Seed default Non-Financial template ───────────────────────────────────────
INSERT INTO questionnaire_templates (questionnaire_type, version, label, is_active, sections)
VALUES (
    'non_financial',
    1,
    'Non-Financial Primary Cooperatives Questionnaire v1',
    true,
    '[
      {"id":"general","title":"General Information","icon":"Building2","description":"Basic cooperative details","fields":[
        {"key":"respondent_name","label":"Respondent Name","type":"text","required":false},
        {"key":"respondent_position","label":"Position","type":"text","required":false},
        {"key":"society_name","label":"Name of Society","type":"text","required":true},
        {"key":"registration_no","label":"Registration No","type":"text","required":true},
        {"key":"reg_status","label":"Registration Status","type":"select","required":false,"options":["Provisional","Fully"]},
        {"key":"common_bond","label":"Common Bond","type":"text","required":false},
        {"key":"postal_address","label":"Postal Address","type":"textarea","required":false},
        {"key":"physical_address","label":"Physical Address","type":"textarea","required":false},
        {"key":"region","label":"Region","type":"select","required":false,"options":["Hhohho","Manzini","Shiselweni","Lubombo"]},
        {"key":"office_status","label":"Society Office Is?","type":"select","required":false,"options":["Rented","Provided Free","Owned","Don''t have"]},
        {"key":"affiliated_to","label":"Affiliated To","type":"text","required":false},
        {"key":"sub_sector","label":"Cooperative Sub-Sector","type":"text","required":false}
      ]},
      {"id":"membership","title":"Membership Data","icon":"Users","description":"Member counts by gender and age","fields":[
        {"key":"total_registered_male","label":"Total Registered Members – Male","type":"number","required":false},
        {"key":"total_registered_female","label":"Total Registered Members – Female","type":"number","required":false},
        {"key":"total_active_male","label":"Total Active Members – Male","type":"number","required":false},
        {"key":"total_active_female","label":"Total Active Members – Female","type":"number","required":false},
        {"key":"age_18_25_male","label":"Age 18-25 – Male","type":"number","required":false},
        {"key":"age_18_25_female","label":"Age 18-25 – Female","type":"number","required":false},
        {"key":"age_26_35_male","label":"Age 26-35 – Male","type":"number","required":false},
        {"key":"age_26_35_female","label":"Age 26-35 – Female","type":"number","required":false},
        {"key":"age_36_60_male","label":"Age 36-60 – Male","type":"number","required":false},
        {"key":"age_36_60_female","label":"Age 36-60 – Female","type":"number","required":false},
        {"key":"joining_fee","label":"Member Joining Fee (E)","type":"number","required":false},
        {"key":"annual_subscription_fee","label":"Annual Subscription Fee (E)","type":"number","required":false},
        {"key":"society_status","label":"Society Status","type":"select","required":false,"options":["Active","Dormant","New","Under Liquidation"]}
      ]},
      {"id":"leadership","title":"Leadership & Committees","icon":"ClipboardList","description":"Committee composition and governance","fields":[
        {"key":"board_male","label":"Board/Management Committee – Male","type":"number","required":false},
        {"key":"board_female","label":"Board/Management Committee – Female","type":"number","required":false},
        {"key":"exec_male","label":"Executive Committee – Male","type":"number","required":false},
        {"key":"exec_female","label":"Executive Committee – Female","type":"number","required":false},
        {"key":"chairperson_education","label":"Chairperson Education Level","type":"select","required":false,"options":["None","Informal","Primary","Secondary","High School","Tertiary"]},
        {"key":"committee_last_elected","label":"Date Management Committee Elected","type":"date","required":false},
        {"key":"last_agm_date","label":"Date Last AGM Held","type":"date","required":false},
        {"key":"agm_attendance_male","label":"Last AGM Attendance – Male","type":"number","required":false},
        {"key":"agm_attendance_female","label":"Last AGM Attendance – Female","type":"number","required":false}
      ]},
      {"id":"training","title":"Training & Capacity","icon":"BookOpen","description":"Training and empowerment activities","fields":[
        {"key":"members_trained_last_year","label":"Members Trained Last Year","type":"number","required":false},
        {"key":"leaders_trained_last_year","label":"Leaders Trained Last Year","type":"number","required":false},
        {"key":"staff_trained_last_year","label":"Staff Trained Last Year","type":"number","required":false},
        {"key":"training_sponsor","label":"Who Mainly Sponsored Training?","type":"select","required":false,"options":["The Co-operative","The Government","Apex","Others"]},
        {"key":"training_quality","label":"Training Quality Rating","type":"select","required":false,"options":["Very good","Good","Fair","Poor","Very Poor"]},
        {"key":"training_cost_proportion","label":"Training Cost Coverage (%)","type":"number","required":false}
      ]},
      {"id":"capitalization","title":"Capitalization","icon":"DollarSign","description":"Share capital, reserves and borrowed funds","fields":[
        {"key":"share_nominal_value","label":"Share Nominal Value (E per share)","type":"number","required":false},
        {"key":"total_share_capital","label":"Total Share Capital (E)","type":"number","required":false},
        {"key":"borrowed_funds","label":"Borrowed Funds (E)","type":"number","required":false},
        {"key":"donations_grants","label":"Donations/Grants (E)","type":"number","required":false},
        {"key":"accumulated_book_reserves","label":"Accumulated Statutory Reserves (E)","type":"number","required":false}
      ]},
      {"id":"performance","title":"Activity Performance","icon":"BarChart3","description":"Main activities, savings and key threats","fields":[
        {"key":"main_activity_1","label":"Main Activity 1","type":"text","required":false},
        {"key":"main_activity_1_income","label":"Main Activity 1 – Annual Income (E)","type":"number","required":false},
        {"key":"main_activity_1_expenses","label":"Main Activity 1 – Annual Expenses (E)","type":"number","required":false},
        {"key":"main_activity_2","label":"Main Activity 2","type":"text","required":false},
        {"key":"main_activity_2_income","label":"Main Activity 2 – Annual Income (E)","type":"number","required":false},
        {"key":"main_activity_2_expenses","label":"Main Activity 2 – Annual Expenses (E)","type":"number","required":false},
        {"key":"creditors_outsiders","label":"Total Owed to Creditors – Outsiders (E)","type":"number","required":false},
        {"key":"amount_owed_by_members","label":"Amount Owed by Members (E)","type":"number","required":false},
        {"key":"number_of_competitors","label":"Number of Competitors","type":"number","required":false}
      ]},
      {"id":"financials","title":"Financial Summary","icon":"TrendingUp","description":"Balance sheet and income comparison","fields":[
        {"key":"current_total_income","label":"Current Year Total Income (E)","type":"number","required":false},
        {"key":"current_total_expenditure","label":"Current Year Total Expenditure (E)","type":"number","required":false},
        {"key":"current_net_income","label":"Current Year Net Income (E)","type":"number","required":false},
        {"key":"last_total_income","label":"Last Year Total Income (E)","type":"number","required":false},
        {"key":"last_total_expenditure","label":"Last Year Total Expenditure (E)","type":"number","required":false},
        {"key":"non_current_assets","label":"Non-Current Assets (E)","type":"number","required":false},
        {"key":"total_current_assets","label":"Total Current Assets (E)","type":"number","required":false},
        {"key":"total_liabilities","label":"Total Liabilities (E)","type":"number","required":false},
        {"key":"total_equity","label":"Total Equity (E)","type":"number","required":false},
        {"key":"success_reasons","label":"Main Success Reasons","type":"textarea","required":false},
        {"key":"challenges","label":"Main Challenges/Failures","type":"textarea","required":false}
      ]}
    ]'::jsonb
) ON CONFLICT DO NOTHING;
