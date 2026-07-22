# Manual Questionnaire Entry: Implementation Guide

## Overview
The Manual Questionnaire Entry feature serves as a fallback for non-digitalized cooperatives to directly enter their annual financial and non-financial data into a structured web form instead of uploading Excel/PDF files.

This document describes the **actual implementation** — including the backend wiring that converges the manual flow with the upload flow.

---

## 1. System Flow

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (React)                │
│                                                  │
│  [FinancialQuestionnaireWizard]                  │
│       (13 steps, ~135 fields)                    │
│       submit: POST /cooperative/questionnaire/   │
│                financial                         │
│              onComplete → switch to Databases tab │
│                                                  │
│  [NonFinancialQuestionnaireWizard]               │
│       (9 steps, ~144 fields)                     │
│       submit: POST /cooperative/questionnaire/   │
│                non-financial                     │
│              onComplete → refetch sections        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              BACKEND (Axum) Handlers              │
│                                                   │
│  POST /api/v1/cooperative/questionnaire/financial │
│  ┌─────────────────────────────────────────────┐  │
│  │ 1. Save metadata under nested key:          │  │
│  │    metadata.financial_questionnaire = body   │  │
│  │ 2. Create financial_statement entity        │  │
│  │ 3. Create balance_sheet_line_item rows      │  │
│  │ 4. Update financial section → "ready"       │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  POST /api/v1/cooperative/questionnaire/          │
│                  non-financial                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ 1. Save metadata under nested key:          │  │
│  │    metadata.non_financial_questionnaire      │  │
│  │ 2. Update 6 NF sections → "ready"           │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           SUBMIT (SubmissionWorkflow)             │
│                                                   │
│  ✓ fs_repo.find_by_submission() → Some (created  │
│    by converter in step 2 above)                  │
│  ✓ All sections "ready"                          │
│  ✓ KPIs computed from line_items                  │
│  ✓ Abnormality flags (if detector wired)          │
└─────────────────────────────────────────────────┘
```

---

## 2. Metadata Storage Strategy

The `submissions.metadata` JSONB column now stores questionnaire data under **nested keys**:

```json
{
  "data_entry_mode": "manual",
  "financial_questionnaire": {
    "submission_id": "...",
    "leadership_and_management": { ... },
    "capitalization": { ... },
    "savings_portfolio": { ... },
    "loan_portfolio": { ... },
    "other_activities_income": [ ... ],
    "periodic_financial_reporting": { ... },
    "qualitative_assessment": { ... }
  },
  "non_financial_questionnaire": {
    "submission_id": "...",
    "basic_data": { ... },
    "member_empowerment": { ... },
    "main_activity_performance": [ ... ],
    "other_activities_income": [ ... ],
    "main_threats": { ... },
    "savings_portfolio": { ... },
    "loan_portfolio": { ... },
    "periodic_reporting": { ... },
    "qualitative_assessment": { ... }
  }
}
```

This eliminates the overwrite bug where the second wizard would overwrite the first wizard's data.

---

## 3. Questionnaire Converter (`questionnaire_converter.rs`)

**File:** `backend/src/services/questionnaire_converter.rs`

Converts `FinancialQuestionnaireRequest` into a `financial_statement` + aggregated `balance_sheet_line_item` rows.

### Created Line Items

| Account Code | Name | Category | Source Fields |
|---|---|---|---|
| 1999 | Total Assets | Assets | `non_current_assets + total_current_assets` |
| 2999 | Total Liabilities | Liabilities | `current_liabilities + long_term_liabilities` |
| 3999 | Total Equity | Equity | `total_equity` |
| 4101 | Financial Income | Income | `current_total_income` |
| 5999 | Total Expenses | Expenses | `current_expenditure` |
| 6999 | Net Surplus | Surplus | `current_net_income` |
| 1303 | Fixed Assets | Assets | `non_current_assets` |
| 1100 | Current Assets | Assets | `total_current_assets` |
| 2100 | Current Liabilities | Liabilities | `current_liabilities` |
| 2200 | Long-term Liabilities | Liabilities | `long_term_liabilities` |
| 3101 | Share Capital | Equity | `total_share_capital_male + total_share_capital_female` |
| 2201 | Borrowed Funds | Liabilities | `borrowed_funds` |
| 4201 | Donations & Grants | Income | `donations_grants` |
| 3201 | Statutory Reserves | Equity | `accumulated_statutory_reserves_book_value` |
| 3301 | Retained Earnings | Equity | `retained_earnings` |
| 2101 | Member Savings Deposits | Liabilities | `total_savings_male + total_savings_female` |
| 1102 | Cash at Bank | Assets | `invested_in_bank` |
| 1104 | Short-term Investments | Assets | `invested_in_shares + other_investments` |
| 1201 | Performing Loans | Assets | `outstanding_value_male+female+coops` |
| 1202 | Arrears 1-30 Days | Assets | `delinquent_value_0_30_days` |
| 1205 | Non-Performing Loans | Assets | `delinquent_value_31_365_days` |
| 1251 | General Provision | Assets | `provision_0_30_days` |
| 1252 | Specific Provision | Assets | `provision_31_365_days` |
| 5301 | Credit Loss Expense | Expenses | `written_off_value` |
| 4102 | Fees & Commissions | Income | Sum of all 5 fee fields |
| 4101 | Other Activities Income | Income | Sum of `other_activities_income[].annual_income` |
| 5101 | Other Activities Expenditure | Expenses | Sum of `other_activities_income[].annual_expenditure` |

All line items are created with:
- `month: 12` (annual)
- `ai_confidence: None` (manually entered)
- `ai_flagged: false`
- `manually_edited: true`

---

## 4. Field Mapping Statistics

Only the **Financial Questionnaire** has fields mapped to relational DB tables. The **Non-Financial Questionnaire** stores all data in `submissions.metadata` only.

### 4.1 Financial Questionnaire — Per-Section Breakdown

| Section | Total Fields | Mapped to `line_items` | Unmapped (metadata only) | Notes |
|---|---|---|---|---|
| `LeadershipAndManagement` | 64 | 0 | 64 | All governance/demographics/training data |
| `Capitalization` | 9 | **6** → 5 line items | 3 | `share_nominal_value`, `contribution_per_member`, `actual_accumulated_reserves` not mapped |
| `SavingsPortfolio` | 8 | **5** → 3 line items | 3 | `depositors_male/female`, `products_interest_rates` not mapped |
| `LoanPortfolio` | 32 | **13** → 7 line items | 19 | Only outstanding, delinquent, provision, fee, and write-off fields mapped; counts and metadata fields not mapped |
| `OtherActivitiesIncome` | 4 | **3** → 3 line items | 1 | `activity_name` not mapped |
| `PeriodicFinancialReporting` | 16 | **8** → 10 line items | 8 | Balance sheet totals mapped; prior-period values, surplus distribution, reserves book value not mapped |
| `QualitativeAssessment` | 5 | 0 | 5 | All text/qualitative |
| **Total** | **138** | **35 mapped → 28 line items** | **103** | |

### 4.2 Non-Financial Questionnaire — Per-Section Breakdown

| Section | Total Fields | Mapped to DB | Unmapped (metadata only) |
|---|---|---|---|
| `BasicData` | ~62 | 0 | 62 |
| `MemberEmpowerment` | 9 | 0 | 9 |
| `MainActivityPerformance` | 8 per activity | 0 | 8 per activity |
| `OtherActivitiesIncome` | 4 per activity | 0 | 4 per activity |
| `MainThreats` | 8 | 0 | 8 |
| `SavingsPortfolio` | 8 | 0 | 8 |
| `LoanPortfolio` | 30 | 0 | 30 |
| `PeriodicReporting` | 13 | 0 | 13 |
| `QualitativeAssessment` | 5 | 0 | 5 |
| **Total** | **~147** | **0** | **~147** |

#### Why Zero NF Fields Map to Relational Tables

The upload flow for non-financial data uses **individual-record tables**:

| Upload Table | Stores | Example Row |
|---|---|---|
| `members` | One row per cooperative member | `{ name, gender, age, join_date, status }` |
| `savings_accounts` | One row per savings account | `{ member_id, balance, product_type, opened_at }` |
| `loans` | One row per loan | `{ member_id, principal, outstanding, disbursed_at }` |
| `fixed_deposits` | One row per fixed deposit | `{ member_id, amount, term_months, maturity_date }` |
| `farm_coop_data` | One row per farming activity | `{ activity, output, income, members_count }` |

After upload, `NfIndicatorEngine` **computes aggregates** from these individual rows:
- `count members WHERE gender = 'male' AND status = 'active'` → active_members_male
- `SUM(balance) WHERE product_type = 'savings'` → total_savings
- `SUM(outstanding) WHERE status = 'active'` → gross_loan_portfolio

The **non-financial questionnaire** asks for those **same aggregates directly** (e.g., "How many active male members?"). The questionnaire already has the final number — it cannot be decomposed back into individual member/savings/loan records. This is fundamentally different from the financial questionnaire, where the aggregate values *are* the right level of detail for `balance_sheet_line_items`.

A `non_financial_indicator_entries` table exists that stores pre-computed aggregates directly as key-value pairs `(submission_id, catalog_id → value)`. In the future, the 147 questionnaire fields could be mapped to this table for cross-submission analytics — but that requires matching each field to a `catalog_id` (one-time mapping work).

### 4.3 Aggregate Statistics

| Questionnaire | Total Fields | Mapped to Relational Tables | Stored in Metadata Only |
|---|---|---|---|
| Financial Questionnaire | **138** | **35 (25.4%)** | **103 (74.6%)** |
| Non-Financial Questionnaire | **~147** | **0 (0%)** | **~147 (100%)** |
| **Combined Total** | **~285** | **35 (~12.3%)** | **~250 (~87.7%)** |

### 4.4 Detailed Mapping: Which Fields Go Where

**Fields mapped to `balance_sheet_line_items` (35 source fields → 28 rows):**

| Source Section | Source Fields | Mapped To | Aggregation |
|---|---|---|---|
| `periodic_financial_reporting` | `non_current_assets` | `account_code: 1303` (Fixed Assets) | Direct |
| `periodic_financial_reporting` | `total_current_assets` | `account_code: 1100` (Current Assets) | Direct |
| `periodic_financial_reporting` | `non_current_assets + total_current_assets` | `account_code: 1999` (Total Assets) | Summed |
| `periodic_financial_reporting` | `current_liabilities` | `account_code: 2100` (Current Liabilities) | Direct |
| `periodic_financial_reporting` | `long_term_liabilities` | `account_code: 2200` (Long-term Liabilities) | Direct |
| `periodic_financial_reporting` | `current_liabilities + long_term_liabilities` | `account_code: 2999` (Total Liabilities) | Summed |
| `periodic_financial_reporting` | `total_equity` | `account_code: 3999` (Total Equity) | Direct |
| `periodic_financial_reporting` | `current_total_income` | `account_code: 4101` (Financial Income) | Direct |
| `periodic_financial_reporting` | `current_expenditure` | `account_code: 5999` (Total Expenses) | Direct |
| `periodic_financial_reporting` | `current_net_income` | `account_code: 6999` (Net Surplus) | Direct |
| `capitalization` | `total_share_capital_male + total_share_capital_female` | `account_code: 3101` (Share Capital) | Summed |
| `capitalization` | `borrowed_funds` | `account_code: 2201` (Borrowed Funds) | Direct |
| `capitalization` | `donations_grants` | `account_code: 4201` (Donations & Grants) | Direct |
| `capitalization` | `accumulated_statutory_reserves_book_value` | `account_code: 3201` (Statutory Reserves) | Direct |
| `capitalization` | `retained_earnings` | `account_code: 3301` (Retained Earnings) | Direct |
| `savings_portfolio` | `total_savings_male + total_savings_female` | `account_code: 2101` (Member Savings) | Summed |
| `savings_portfolio` | `invested_in_bank` | `account_code: 1102` (Cash at Bank) | Direct |
| `savings_portfolio` | `invested_in_shares + other_investments` | `account_code: 1104` (Short-term Investments) | Summed |
| `loan_portfolio` | `outstanding_value_male + female + coops` | `account_code: 1201` (Performing Loans) | Summed |
| `loan_portfolio` | `delinquent_value_0_30_days` | `account_code: 1202` (Arrears 1-30) | Direct |
| `loan_portfolio` | `delinquent_value_31_365_days` | `account_code: 1205` (Non-Performing Loans) | Direct |
| `loan_portfolio` | `provision_0_30_days` | `account_code: 1251` (General Provision) | Direct |
| `loan_portfolio` | `provision_31_365_days` | `account_code: 1252` (Specific Provision) | Direct |
| `loan_portfolio` | `written_off_value` | `account_code: 5301` (Credit Loss Expense) | Direct |
| `loan_portfolio` | sum of all 5 fee fields | `account_code: 4102` (Fees & Commissions) | Summed |
| `other_activities_income[]` | sum of all `annual_income` | `account_code: 4101` (Financial Income) | Summed |
| `other_activities_income[]` | sum of all `annual_expenditure` | `account_code: 5101` (Financial Expenses) | Summed |

**Fields stored in `submissions.metadata` only (all others):**
- Every field in `LeadershipAndManagement` (64 fields including board/committee composition, staff counts, member demographics, training data, management tools, AGM info, audit dates, product offerings)
- `Capitalization.share_nominal_value`, `share_capital_contribution_per_member`, `actual_accumulated_statutory_reserves`
- `SavingsPortfolio.depositors_male`, `depositors_female`, `products_interest_rates`
- `LoanPortfolio` count fields and metadata (loans_issued, value_issued, outstanding_accounts, delinquent_accounts, delinquent_value by gender/coop, recovered_loans, average_term/rate, interest_rate_method) — 19 fields
- `OtherActivitiesIncome.activity_name` per activity
- `PeriodicFinancialReporting` prior-period and distribution fields — 8 fields
- `QualitativeAssessment` — all 5 fields
- **Every field** in the Non-Financial Questionnaire — all ~147 fields

---

## 5. Section Status Updates

After each wizard saves, the backend auto-updates submission section statuses:

| Wizard | Sections Updated → "ready" |
|---|---|
| Financial Questionnaire | `financial` |
| Non-Financial Questionnaire | `members`, `savings`, `loans`, `fixed_deposits`, `farm_coop`, `indicators` |

This unblocks the `SubmissionWorkflow::submit()` check that requires all sections to be `"ready"`.

---

## 6. Convergence with Upload Flow

**Before fix**, manual submissions were dead on arrival because:
- No `financial_statement` entity → `workflow.submit()` blocked with "must be uploaded"
- No line items → KPIs, exports, benchmarks all empty
- Metadata overwrite → data loss between wizards
- Sections stayed `"pending"` → submit blocked

**After fix**, the manual flow converges with the upload flow at submit time:
- ✅ `financial_statement` entity exists
- ✅ `balance_sheet_line_item` rows exist for KPI computation
- ✅ All sections marked `"ready"`
- ✅ Metadata stored under separate keys (no collision)
- ✅ Submit succeeds
- ✅ KPIs computed
- ✅ Exports work

---

## 7. Files Changed

| File | Change |
|---|---|
| `backend/src/services/questionnaire_converter.rs` | **NEW** — converts questionnaire to FS + line items |
| `backend/src/services/mod.rs` | Register `questionnaire_converter` module |
| `backend/src/api/handlers/questionnaire.rs` | Rewritten — nested metadata, FS creation, line items, section status |

---

## 8. Remaining Gaps (Future Work)

- **Abnormality detection**: Not yet wired for manual line items. The `AbnormalityDetector` could be run after converter creates items.
- **NF questionnaire → `non_financial_indicator_entries` mapping**: All 147 NF questionnaire fields stay in metadata only (see §4.2 for why). They could be mapped to `non_financial_indicator_entries` for cross-submission NF analytics dashboards — requires a one-time field-to-catalog_id mapping.
- **Edit/Re-submit**: When a submission is returned to Draft, the wizard should re-load existing metadata for editing.
