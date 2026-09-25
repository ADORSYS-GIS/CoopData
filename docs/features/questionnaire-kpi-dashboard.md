# Questionnaire KPI Dashboard and Report

Basic-tier cooperatives report through two questionnaires (`financial`,
`non_financial`) instead of financial statements plus sub-ledgers. This feature
computes the regulator KPI set and charts from those answers, shows them on the
Basic Analytics page, and produces a PDF report per questionnaire submission.

## Data flow

1. The cooperative answers the seeded forms (migrations 25 and 43). Each
   `questionnaire_responses` row stores `reporting_year`, `period_type` and
   `period_value` copied from its submission. Uniqueness is one row per
   `(submission_id, questionnaire_type)`, so a Q1 and a Q4 return of the same
   year no longer collide.
2. `services/questionnaire_kpi` merges the two forms (financial answers win),
   parses them into `Inputs` and derives every indicator. Pure functions, no I/O.
3. `services/basic_dashboard::build` selects the period, converts money to USD
   with each submission's frozen rate (or the current SZL rate), consolidates
   and builds the previous-period comparison, the series and the market share.
4. `GET /api/v1/analytics/basic-dashboard` exposes the result. Cooperatives see
   their own data. Apex, federation and ministry users see the consolidated view
   of their scope.
5. The report pipeline reuses `build` for one submission and adds the AI
   narratives (see the report section below).

## Consolidation rule

Consolidated ratios are computed from summed numerators and denominators, never
as an average of cooperative ratios.

## Indicators

Every indicator carries `status`: `computed`, `approximate` or `not_reported`.
A missing input is never shown as zero.

| Group | Indicator | Formula | Inputs |
|---|---|---|---|
| membership | active / inactive members | active; registered - active | registered_members_*, active_members_* |
| membership | women, youth share | female / registered; (18-25 + 26-35) / registered | registered_members_female, age_18_25_*, age_26_35_* |
| savings | total deposits, deposit accounts | male + female | savings_value_*, savings_accounts_* |
| loans | gross loan portfolio | male + female outstanding (members-owed only as fallback) | outstanding_value_* |
| loans | loans outstanding, average loan balance | count; portfolio / count | loans_outstanding_count (falls back to loans issued: approximate) |
| loans | projected interest earnings | portfolio x monthly rate x term (halved for reducing balance) | avg_interest_rate, avg_loan_term_months, interest_rate_method (always approximate) |
| risk | PAR > 7, > 30, > 90, 30-90, 180-360 | overdue balance / gross loans | par_*_value buckets |
| risk | portfolio at risk, value at risk | all overdue / gross loans; all overdue | par_*_value, or delinquent_value_* (approximate) |
| liquidity | liquidity ratio, gap | (cash + bank) / member savings; minimum 15 - ratio | cash_on_hand, cash_at_bank_current, bank_investment |
| structure | earning asset, savings, share, borrowed funds ratios | (loans + investments), savings, shares, borrowings over total assets | non_current_assets + total_current_assets |
| capital | institutional capital ratio, excess | (retained earnings + statutory reserves + donations) / assets; minus 8 | retained_earnings, accumulated_statutory_reserves, donations_grants |
| profitability | net income, ROA, expense ratio | net (or income - expenditure); / assets; expenditure / income | current_* |
| governance | women share of board, executive, credit committee; AGM attendance | female / total; attendance / active | board_*, exec_*, credit_committee_*, agm_attendance_* |

Regulatory minimums (liquidity 15%, institutional capital 8%) are constants in
`questionnaire_kpi/derived.rs`.

## Series returned for the charts

`asset_evolution`, `savings_trend`, `loan_portfolio`, `par_trend`, `liquidity`,
`financial_structure`, `profitability`, `institutional_capital`: up to eight
chronological periods of the selected period type, ending at the selected one.

## Known limits

- The questionnaires are entered in SZL. The dashboard converts to USD by
  default and can show the entered currency.
- Sector-wide figures outside the SACCO returns (banks, insurance, capital
  markets, FSP licensing) cannot come from these forms.
- Form labels have no fr/pt/ss translations (the existing forms have none).

## Report

Questionnaire submissions (`submission_method = 'questionnaire'`) generate their
PDF through the same pipeline as other submissions: narratives via
`ReportNarrativeGenerator`, stored in the submission metadata, passed to a
print page rendered by Gotenberg. Reports for other submission methods are
unchanged.
