-- Migration 60: optional "Cash flow and receivables" section on the active
-- financial (chart-of-accounts) questionnaire.
--
-- The KPI Data Mapping sheet of "MPC FINANCE QUESTIONNAIRE.xlsx" needs figures
-- the account grid cannot give: operating cash flow, principal repayments,
-- credit sales, cash operating expenses and receivables over 90 days. All five
-- fields are optional; a KPI whose figure is missing is simply not generated.
--
-- Appended in place to the active template (idempotent, guarded by section id)
-- so answers already saved against it stay valid.

UPDATE questionnaire_templates
SET sections = sections || $j$[
  {
    "id": "cashflow",
    "title": "Cash Flow & Receivables",
    "icon": "💧",
    "description": "Optional. These figures come from your cash-flow statement and debtors listing. Leave a field empty if you do not have it: the ratios that need it are then not generated.",
    "fields": [
      {
        "key": "cf_operating_cash_flow",
        "label": "Net cash from operating activities (year)",
        "type": "number",
        "required": false,
        "description": "From the cash-flow statement. Used for the Operating Cash Flow Ratio and DSCR."
      },
      {
        "key": "cf_principal_repayments",
        "label": "Principal repayments on loans (year)",
        "type": "number",
        "required": false,
        "description": "Capital repaid on borrowings during the year. Used for DSCR."
      },
      {
        "key": "cf_credit_sales",
        "label": "Credit sales (year)",
        "type": "number",
        "required": false,
        "description": "Sales made on credit, excluding cash sales. Used for Days Sales Outstanding."
      },
      {
        "key": "cf_cash_operating_expenses",
        "label": "Cash operating expenses (year)",
        "type": "number",
        "required": false,
        "description": "Operating expenses paid in cash, excluding depreciation and other non-cash items. Used for Cash Liquidity Coverage."
      },
      {
        "key": "cf_receivables_over_90",
        "label": "Receivables overdue more than 90 days (closing)",
        "type": "number",
        "required": false,
        "description": "Part of trade receivables (account 1400) unpaid after 90 days. Used for the Receivables Risk Ratio."
      }
    ]
  }
]$j$::jsonb,
    updated_at = NOW()
WHERE questionnaire_type = 'financial'
  AND is_active
  AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(sections) s WHERE s->>'id' = 'cashflow'
  );
