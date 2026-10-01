-- Migration 51: rebuild the FINANCIAL questionnaire as a chart-of-accounts
-- mapping form, matching "MPC FINANCE QUESTIONNAIRE.xlsx" (Super Chart of
-- Accounts + KPI Data Mapping). SACCO cooperatives no longer use any
-- questionnaire (upload/manual only — see migration 49); the financial
-- questionnaire is now multipurpose-only, and its old SACCO-narrative shape
-- (leadership/training/membership/capitalization/savings/loans/financials/
-- loan_quality/liquidity sections, built for the old survey-style Financial
-- Primary Cooperatives Questionnaire) no longer matches what multipurpose
-- cooperatives need to report.
--
-- Rather than overwrite the active template in place, this inserts a new
-- version and activates it the same way the ministry template editor does
-- (see QuestionnaireTemplateRepository::create / ::activate) — non-
-- destructive: the old version stays in the table, deactivated, and can be
-- reactivated from the ministry UI if ever needed. Idempotent (guarded by
-- label).
--
-- Each of the 7 sections below is one Level-1 chart-of-accounts category
-- (Assets, Liabilities, Equity, Revenue, Direct Costs, Operating Expenses,
-- Finance & Other Costs) holding one "account_grid" field: a fixed table of
-- Level-2/Level-3 standard accounts (from the xlsx), each row capturing the
-- MPC's own account name/code, opening balance, closing balance and annual
-- movement. Rows marked "mandatory": false are conditional — only relevant
-- to some MPCs (e.g. member deposits, financial income, borrowing).

DO $$
DECLARE
    v_next_version INT;
    v_new_id UUID := gen_random_uuid();
    v_old_active_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM questionnaire_templates
        WHERE questionnaire_type = 'financial'
          AND label = 'MPC Chart of Accounts Questionnaire'
    ) THEN
        SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
        FROM questionnaire_templates WHERE questionnaire_type = 'financial';

        INSERT INTO questionnaire_templates (id, questionnaire_type, version, label, sections, is_active)
        VALUES (
            v_new_id,
            'financial',
            v_next_version,
            'MPC Chart of Accounts Questionnaire',
            $j$[
  {
    "id": "assets",
    "title": "Assets",
    "icon": "🏦",
    "description": "Map your MPC's own accounts to the standard assets categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_assets",
        "label": "Assets",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "1100",
            "level2": "Current Assets",
            "level3": "Cash on Hand",
            "mandatory": true
          },
          {
            "code": "1200",
            "level2": "Current Assets",
            "level3": "Bank Accounts",
            "mandatory": true
          },
          {
            "code": "1300",
            "level2": "Current Assets",
            "level3": "Short-term Investments",
            "mandatory": false
          },
          {
            "code": "1400",
            "level2": "Current Assets",
            "level3": "Trade Receivables",
            "mandatory": true
          },
          {
            "code": "1500",
            "level2": "Current Assets",
            "level3": "Member Receivables",
            "mandatory": true
          },
          {
            "code": "1600",
            "level2": "Current Assets",
            "level3": "Inventory",
            "mandatory": true
          },
          {
            "code": "1700",
            "level2": "Current Assets",
            "level3": "Other Current Assets",
            "mandatory": true
          },
          {
            "code": "1800",
            "level2": "Non-current Assets",
            "level3": "Property, Plant & Equipment",
            "mandatory": true
          },
          {
            "code": "1900",
            "level2": "Non-current Assets",
            "level3": "Other Non-current Assets",
            "mandatory": false
          }
        ]
      }
    ]
  },
  {
    "id": "liabilities",
    "title": "Liabilities",
    "icon": "📑",
    "description": "Map your MPC's own accounts to the standard liabilities categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_liabilities",
        "label": "Liabilities",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "2100",
            "level2": "Current Liabilities",
            "level3": "Trade Payables",
            "mandatory": true
          },
          {
            "code": "2200",
            "level2": "Current Liabilities",
            "level3": "Other Current Payables",
            "mandatory": true
          },
          {
            "code": "2300",
            "level2": "Current Liabilities",
            "level3": "Short-term Loans / Borrowings",
            "mandatory": true
          },
          {
            "code": "2400",
            "level2": "Current Liabilities",
            "level3": "Member Deposits / Savings Payable",
            "mandatory": false,
            "note": "Only where MPC accepts member savings/deposits"
          },
          {
            "code": "2500",
            "level2": "Non-current Liabilities",
            "level3": "Long-term Loans / Borrowings",
            "mandatory": true
          },
          {
            "code": "2600",
            "level2": "Non-current Liabilities",
            "level3": "Other Non-current Liabilities",
            "mandatory": false
          }
        ]
      }
    ]
  },
  {
    "id": "equity",
    "title": "Equity",
    "icon": "🧾",
    "description": "Map your MPC's own accounts to the standard equity categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_equity",
        "label": "Equity",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "3100",
            "level2": "Member Equity",
            "level3": "Member Share Capital",
            "mandatory": true
          },
          {
            "code": "3200",
            "level2": "Reserves",
            "level3": "Statutory / Legal Reserves",
            "mandatory": true
          },
          {
            "code": "3300",
            "level2": "Reserves",
            "level3": "Other Reserves",
            "mandatory": false
          },
          {
            "code": "3400",
            "level2": "Accumulated Results",
            "level3": "Retained Earnings",
            "mandatory": true
          },
          {
            "code": "3500",
            "level2": "Current Result",
            "level3": "Current-year Surplus / (Deficit)",
            "mandatory": true
          }
        ]
      }
    ]
  },
  {
    "id": "revenue",
    "title": "Revenue",
    "icon": "💵",
    "description": "Map your MPC's own accounts to the standard revenue categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_revenue",
        "label": "Revenue",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "4100",
            "level2": "Operating Revenue",
            "level3": "Sales - Activity 1",
            "mandatory": true,
            "activityCode": "Activity 1",
            "note": "Repeat/add for each material activity"
          },
          {
            "code": "4200",
            "level2": "Operating Revenue",
            "level3": "Sales - Activity 2",
            "mandatory": false,
            "activityCode": "Activity 2",
            "note": "Repeat/add for each material activity"
          },
          {
            "code": "4300",
            "level2": "Operating Revenue",
            "level3": "Sales - Activity 3",
            "mandatory": false,
            "activityCode": "Activity 3",
            "note": "Repeat/add for each material activity"
          },
          {
            "code": "4400",
            "level2": "Operating Revenue",
            "level3": "Sales - Other Activities",
            "mandatory": false,
            "activityCode": "Other"
          },
          {
            "code": "4500",
            "level2": "Operating Revenue",
            "level3": "Service Income",
            "mandatory": false,
            "activityCode": "Activity code"
          },
          {
            "code": "4600",
            "level2": "Other Operating Revenue",
            "level3": "Other Operating Income",
            "mandatory": true
          },
          {
            "code": "4700",
            "level2": "Financial Revenue",
            "level3": "Interest / Financial Income",
            "mandatory": false
          },
          {
            "code": "4800",
            "level2": "Other Revenue",
            "level3": "Grants / Donations",
            "mandatory": false,
            "note": "Keep separate from operating revenue"
          }
        ]
      }
    ]
  },
  {
    "id": "direct_costs",
    "title": "Direct Costs",
    "icon": "📦",
    "description": "Map your MPC's own accounts to the standard direct costs categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_direct_costs",
        "label": "Direct Costs",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "5100",
            "level2": "Direct Costs",
            "level3": "Purchases / Cost of Goods Sold",
            "mandatory": true,
            "activityCode": "Activity code"
          },
          {
            "code": "5200",
            "level2": "Direct Costs",
            "level3": "Direct Production Costs",
            "mandatory": false,
            "activityCode": "Activity code"
          },
          {
            "code": "5300",
            "level2": "Direct Costs",
            "level3": "Direct Service Costs",
            "mandatory": false,
            "activityCode": "Activity code"
          }
        ]
      }
    ]
  },
  {
    "id": "operating_expenses",
    "title": "Operating Expenses",
    "icon": "🧮",
    "description": "Map your MPC's own accounts to the standard operating expenses categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_operating_expenses",
        "label": "Operating Expenses",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "6100",
            "level2": "Personnel",
            "level3": "Personnel Expenses",
            "mandatory": true
          },
          {
            "code": "6200",
            "level2": "Administration",
            "level3": "Administrative Expenses",
            "mandatory": true
          },
          {
            "code": "6300",
            "level2": "Distribution",
            "level3": "Transport / Distribution",
            "mandatory": false,
            "activityCode": "Activity code"
          },
          {
            "code": "6400",
            "level2": "Marketing",
            "level3": "Marketing Expenses",
            "mandatory": false,
            "activityCode": "Activity code"
          },
          {
            "code": "6500",
            "level2": "Maintenance",
            "level3": "Repairs & Maintenance",
            "mandatory": true
          },
          {
            "code": "6600",
            "level2": "Utilities",
            "level3": "Utilities / Communication",
            "mandatory": true
          },
          {
            "code": "6700",
            "level2": "Depreciation",
            "level3": "Depreciation Expense",
            "mandatory": true
          },
          {
            "code": "6800",
            "level2": "Other Operating Expenses",
            "level3": "Other Operating Expenses",
            "mandatory": true
          }
        ]
      }
    ]
  },
  {
    "id": "finance_costs",
    "title": "Finance & Other Costs",
    "icon": "🏛️",
    "description": "Map your MPC's own accounts to the standard finance & other costs categories. Enter data only for accounts relevant to your cooperative.",
    "fields": [
      {
        "key": "coa_finance_costs",
        "label": "Finance & Other Costs",
        "type": "account_grid",
        "required": false,
        "rows": [
          {
            "code": "7100",
            "level2": "Finance Costs",
            "level3": "Interest Expense",
            "mandatory": false
          },
          {
            "code": "7200",
            "level2": "Finance Costs",
            "level3": "Bank / Financial Charges",
            "mandatory": false
          },
          {
            "code": "7300",
            "level2": "Other Non-operating Costs",
            "level3": "Other Non-operating Expenses",
            "mandatory": false
          }
        ]
      }
    ]
  }
]$j$::jsonb,
            false
        );

        SELECT id INTO v_old_active_id FROM questionnaire_templates
        WHERE questionnaire_type = 'financial' AND is_active = true AND id != v_new_id;

        IF v_old_active_id IS NOT NULL THEN
            UPDATE questionnaire_templates SET is_active = false, updated_at = NOW() WHERE id = v_old_active_id;
        END IF;

        UPDATE questionnaire_templates SET is_active = true, updated_at = NOW() WHERE id = v_new_id;
    END IF;
END $$;
