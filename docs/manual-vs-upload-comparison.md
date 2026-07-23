# Manual Questionnaire vs Upload Extraction — KPI Comparison

> **Status**: Analysis document  
> **Date**: 2026-07-22  
> **Scope**: Financial (backend `KpiEngine`, frontend `kpi-calculations.ts`) and non-financial (backend `NfIndicatorEngine`)

---

## 1. Data Flow Difference

| Aspect | Upload (Excel/PDF) | Manual Questionnaire |
|---|---|---|
| **Financial data** | Extraction pipeline → LLM maps to CoA codes → `balance_sheet_line_items` | `FinancialQuestionnaireRequest` → `questionnaire_converter.rs` → 28 line items → same table |
| **Non-financial data** | `nf_excel_parser.rs` → 5 sheets parsed → individual records in `members`, `savings_accounts`, `loans`, `fixed_deposits`, `farm_coop` | `NonFinancialQuestionnaireRequest` → stored as JSON blob in `submissions.metadata["non_financial_questionnaire"]` — **no individual records created** |

---

## 2. Financial KPI Coverage (Backend `KpiEngine`)

### Account Codes Available from Each Flow

| Code | Name | Upload | Manual | Manual source field(s) |
|---|---|---|---|---|
| 1101 | Cash in Hand | ✅ LLM | ❌ | Not in questionnaire |
| 1102 | Cash at Bank | ✅ | ✅ | `savings_portfolio.invested_in_bank` |
| 1103 | Short-term Investments (securities) | ✅ | ❌ | Not in questionnaire |
| 1104 | Short-term Investments (shares/other) | ✅ | ✅ | `invested_in_shares + other_investments` |
| 1201 | Performing Loans | ✅ | ✅ | `loan_portfolio.outstanding_value_male+female+coops` |
| 1202 | Arrears 1-30 Days | ✅ | ✅ | `loan_portfolio.delinquent_value_0_30_days` |
| 1203 | Arrears 31-60 Days | ✅ | ❌ | Not in questionnaire (uses single 31-365 bucket) |
| 1204 | Arrears 61-90 Days | ✅ | ❌ | Not in questionnaire |
| 1205 | Non-Performing Loans (91+) | ✅ | ✅ | `loan_portfolio.delinquent_value_31_365_days` |
| 1251 | General Provision | ✅ | ✅ | `loan_portfolio.provision_0_30_days` |
| 1252 | Specific Provision | ✅ | ✅ | `loan_portfolio.provision_31_365_days` |
| 1999 | Total Assets | ✅ | ✅ | `non_current_assets + total_current_assets` |
| 2101 | Member Savings Deposits | ✅ | ✅ | `total_savings_male + total_savings_female` |
| 2102 | Voluntary Savings | ✅ | ❌ | Not in questionnaire |
| 2103 | Fixed/Time Deposits | ✅ | ❌ | Not in questionnaire |
| 2999 | Total Liabilities | ✅ | ✅ | `current_liabilities + long_term_liabilities` |
| 3101 | Share Capital | ✅ | ✅ | `total_share_capital_male + total_share_capital_female` |
| 3201 | Statutory Reserves | ✅ | ✅ | `capitalization.accumulated_statutory_reserves_book_value` |
| 3301 | Retained Earnings | ✅ | ✅ | `capitalization.retained_earnings` |
| 3999 | Total Equity | ✅ | ✅ | `periodic_financial_reporting.total_equity` |
| 4101 | Financial Income | ✅ | ✅ (⚠️ **double**) | `PFR.current_total_income` **AND** `activities.annual_income` → two line items, same code |
| 4102 | Fees & Commissions | ✅ | ✅ | Sum of 5 fee types from loan portfolio |
| 4201 | Donations & Grants | ✅ | ✅ | `capitalization.donations_grants` |
| 5101 | Other Activities Expenditure | ✅ | ✅ | `activities.annual_expenditure` (if > 0) |
| 5102 | Other Financial Expenses | ✅ | ❌ | Not in questionnaire |
| 5201 | Personnel Expenses | ✅ | ❌ | Not in questionnaire |
| 5202 | Administrative Expenses | ✅ | ❌ | Not in questionnaire |
| 5203 | Depreciation | ✅ | ❌ | Not in questionnaire |
| 5204 | Other Operating Expenses | ✅ | ❌ | Not in questionnaire |
| 5301 | Credit Loss Expense | ✅ | ✅ | `loan_portfolio.written_off_value` |
| 5999 | Total Expenses | ✅ | ✅ | `periodic_financial_reporting.current_expenditure` |
| 6999 | Net Surplus | ✅ | ✅ | `periodic_financial_reporting.current_net_income` |

### KPI-by-KPI Comparison

#### Currency KPIs

| KPI | Formula | Upload | Manual | Verdict |
|---|---|---|---|---|
| `total_assets` | 1999 | ✅ | ✅ | **Identical** |
| `gross_loan_portfolio` | 1201+1202+1203+1204+1205 | ✅ | ⚠️ Missing 1203,1204 → understated | **Understated** |
| `net_loan_portfolio` | GLP - (1251+1252) | ✅ | ⚠️ GLP understated, provisions OK | **Understated** |
| `total_member_deposits` | 2101+2102+2103 | ✅ | ⚠️ Only 2101 available | **Understated** |
| `total_equity` | 3999 | ✅ | ✅ | **Identical** |
| `net_surplus` | 6999 | ✅ | ✅ | **Identical** |

#### Percentage KPIs

| KPI | Formula | Upload | Manual | Drift Direction |
|---|---|---|---|---|
| `par30` | (1202+1203+1204+1205)/GLP | ✅ | ⚠️ Numerator & denominator both missing 1203,1204 | **Understated** (looks better than reality) |
| `par90` | 1205/GLP | ✅ | ⚠️ Numerator OK, GLP understated | **Inflated** (looks worse than reality) |
| `npl_ratio` | Same as PAR90 | ✅ | ⚠️ Same | **Inflated** |
| `loan_loss_coverage` | (1251+1252)/arrears | ✅ | ⚠️ Provisions OK, arrears understated | **Inflated** (looks better) |
| `roa` | 6999/1999 | ✅ | ✅ | **Identical** |
| `roe` | 6999/3999 | ✅ | ✅ | **Identical** |
| `operating_expense_ratio` | (5201+5202+5203+5204)/1999 | ✅ | ❌ All four codes absent → **0%** | **Broken** (misleading) |
| `capital_adequacy_ratio` | 3999/1999 | ✅ | ✅ | **Identical** |
| `liquid_funds_ratio` | (1101+1102+1103+1104)/1999 | ✅ | ⚠️ Only 1102,1104 → understated | **Understated** |
| `operational_self_sufficiency` | (4101+4102+4201)/(5101+5102+5201-4+5301) | ✅ | ⚠️ Income OK (+ double-count bug); expenses missing 5102,5201-4 | **Highly inflated** |
| `net_interest_margin` | ((4101+4102)-(5101+5102))/1999 | ✅ | ⚠️ 5102 missing | **Inflated** |
| `deposits_to_loans` | (2101+2102+2103)/GLP | ✅ | ⚠️ Deposits understated, GLP understated | **Unreliable** |

### 2.1 Known Bug: 4101 Double-Count

In `questionnaire_converter.rs`:
- Line 70-77: `PFR.current_total_income` → account_code `4101`
- Line 298-306: `activities.annual_income` → account_code `4101` (separate line item)

KpiEngine line 127 uses `sum_codes(&[4101, 4102])` — adds **both** 4101 values. If the cooperative reports total income in PFR AND separately lists activity incomes, those incomes are double-counted.

**Impact**: Inflates `financial_income` → inflates `operational_self_sufficiency` and `net_interest_margin`.

---

## 3. Non-Financial KPI Coverage (Backend `NfIndicatorEngine`)

The NF engine queries 6 database tables. Manual questionnaire produces rows in **zero** of these tables.

### 3.1 MembershipStats (18 stats)

| Stat | Upload | Manual | Manual data location |
|---|---|---|---|
| `total` | ✅ `members` table | ❌ 0 | Stored in `metadata.leadership_and_management.{registered,active}_members_{male,female}` |
| `active` | ✅ | ❌ 0 | Same |
| `dormant` | ✅ | ❌ 0 | `dormant_members_male + dormant_members_female` in metadata |
| `exited` | ✅ | ❌ 0 | Not even in questionnaire |
| `male`, `female`, `other` | ✅ | ❌ 0 | Metadata has separate male/female counts |
| `under_18`, `age_18_35`, `age_36_50`, `over_50` | ✅ | ❌ 0 | Metadata has `active_members_*` age groups |
| `urban`, `rural` | ✅ | ❌ 0 | Not in questionnaire |
| `agm_attendance` | ✅ | ❌ 0 | `agm_attendance_male + agm_attendance_female` in metadata |
| `leadership_count`, `voting_count` | ✅ | ❌ 0 | Not in questionnaire |
| `women_in_governance_pct` | ✅ | ❌ 0 | Not computable — no individual governance data |
| `youth_in_governance_pct` | ✅ | ❌ 0 | Not computable |

### 3.2 SavingsStats (16 stats)

| Stat | Upload | Manual | Notes |
|---|---|---|---|
| All 16 stats | ✅ `savings_accounts` table | ❌ All 0 | Manual has aggregate `depositors_male/female`, `total_savings_male/female`, `products_interest_rates` but no individual account records |

### 3.3 LoanStats (20 stats)

| Stat | Upload | Manual | Notes |
|---|---|---|---|
| All 20 stats | ✅ `loans` table | ❌ All 0 | Manual has aggregate counts/values (by gender, delinquency buckets) but no individual loan records |

### 3.4 FixedDepositStats (14 stats)

| Stat | Upload | Manual | Notes |
|---|---|---|---|
| All 14 stats | ✅ `fixed_deposits` table | ❌ All 0 | Not in questionnaire at all |

### 3.5 FarmCoopStats (17 stats)

| Stat | Upload | Manual | Notes |
|---|---|---|---|
| All 17 stats | ✅ `farm_coop` table | ❌ All 0 | Not in questionnaire |

---

## 4. Ministry-Level NF Indicators (`non_financial_indicator_entries`)

| Flow | Can populate? | Current behavior |
|---|---|---|
| Upload | ✅ Via `POST /submissions/{id}/non-financial-indicators` | Not used by upload pipeline today |
| Manual | ✅ Same endpoint available | Questionnaire stores in metadata, not in this endpoint |

Both flows *could* use the same endpoint. The manual questionnaire handler currently skips it entirely.

---

## 5. Frontend-Only KPIs (`kpi-calculations.ts`)

### 5.1 Additional Financial KPIs (11)

| KPI | Upload | Manual | Reason |
|---|---|---|---|
| `par60` | ✅ | ⚠️ Missing 1203,1204 | Same as PAR30 drift |
| `financialRevenueRatio` | ✅ | ⚠️ 4101 double-count bug | Inflated |
| `financialExpenseRatio` | ✅ | ❌ 5102 missing | Broken |
| `costOfFunds` | ✅ | ❌ No deposit interest data | Broken |
| `yieldOnPortfolio` | ✅ | ⚠️ Loan interest data is aggregate only | Approximate |
| `currentRatio` | ✅ | ⚠️ Only partial liquid assets | Understated |
| `cashRatio` | ✅ | ⚠️ Only cash at bank, no cash in hand | Understated |
| `debtToEquity` | ✅ | ⚠️ Liabilities via 2999, equity via 3999 | OK |
| `savingsToAssets` | ✅ | ⚠️ Only 2101 | Understated |
| `voluntarySavingsRatio` | ✅ | ❌ No 2102,2103 breakdown | Broken |
| `writeOffRatio` | ✅ | ✅ via 5301 | OK |

### 5.2 NF Record-Based Frontend KPIs

All require individual records from the 5 NF tables:

| Category | Count | Upload | Manual |
|---|---|---|---|
| Membership (growth, dormancy, exit, AGM, etc.) | 8 | ✅ | ❌ |
| Savings (active savers, regular savers, avg interest, etc.) | 10+ | ✅ | ❌ |
| Loans (on-time repayment, restructured ratio, women/youth/rural %, etc.) | 10+ | ✅ | ❌ |
| Fixed Deposits (long-term ratio, rollover rate) | 3 | ✅ | ❌ |
| Compliance Score | 1 | ✅ | ⚠️ Partial |

---

## 6. Conclusion

| Dimension | Upload Coverage | Manual Coverage |
|---|---|---|
| Financial KPIs — fully accurate | 18/18 | 6/18 |
| Financial KPIs — compute with drift | 0 | 10/18 |
| Financial KPIs — broken (0 or NaN) | 0 | 1/18 (operating_expense_ratio) |
| Financial KPIs — bug (double-count) | 0 | 1 (4101 inflates 2 more KPIs) |
| Non-financial engine stats | 84+ | 0 |
| Frontend NF KPIs | 32+ | 0 |
| Ministry NF indicators | 0 (unused) | 0 (unused) |

**The manual questionnaire captures valuable aggregate data but the system has no bridge** to convert it into the record-level structures that the KPI and NF indicator engines require. The financial half works mostly (with known drift); the non-financial half returns empty results.
