# Manual Questionnaire vs Upload Extraction — KPI Comparison

> **Status**: Analysis document  
> **Date**: 2026-07-22  
> **Scope**: Financial (backend `KpiEngine`, frontend `kpi-calculations.ts`) and non-financial (backend `NfIndicatorEngine`)

---


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

## 6. Questionnaire Field vs Digital Pipeline Overlap

### 6.1 Field Counts by Questionnaire

| Questionnaire | Total Fields on PDF | Maps to Digital Pipeline | Unique to Manual Form |
|---|---|---|---|
| **Financial** | ~141 | ~34 (24%) | ~107 (76%) |
| **Non-Financial** | ~133 | ~33 (25%) | ~100 (75%) |
| **Combined** | ~274 | ~67 (24%) | ~207 (76%) |

> Counts are individual data-entry fields (text inputs, numbers, checkboxes). Multi-value lists (e.g. "training needs", "management tools") and repeated sub-forms (e.g. "other activities") counted once.

### 6.2 What Maps (Derivable from Digital Upload)

**From KpiEngine (balance_sheet_line_items)** → 24 financial fields

Share capital, borrowed funds, donations/grants, statutory reserves, retained earnings, invested in bank/shares/other, outstanding loan values, delinquent values (0-30 and 31-365), provisions (0-30 and 31-365), written-off value, fees (5 types summed), activity expenditure, total income, net income, non-current assets, total current assets, current liabilities, long-term liabilities, total equity.

**From NfIndicatorEngine (members table)** → 9 membership fields

Total members (male+female), active members (male+female), members under 18, members 36-60, members 61+, dormant members (male+female), AGM attendance (male+female).

**From NfIndicatorEngine (loans/savings tables)** → 2 fields

Outstanding owed by members, total savings balance.

### 6.3 What Does NOT Map (Unique to Manual Form)

| Category | Count | Examples |
|---|---|---|
| Committee & staff composition | ~40 | Board/exec/credit/education/supervisory by gender; all staff roles by gender |
| Education & training | ~14 | Chair/vice/treasurer/secretary education; manager levels; training counts, sponsor, quality, needs |
| Governance & compliance dates | ~10 | Last audit, inspection, mgmt report, budget, committee profile, audit firm |
| Products offered | ~2 | Financial & non-financial product lists |
| Share structure & fees | ~4 | Share nominal value, per-member contribution, joining fee, subscription fee |
| Loan gender disaggregation | ~16 | Loans issued, outstanding, delinquent accounts/values broken by male/female/coop |
| Loan terms & recoveries | ~4 | Average loan term, average interest rate, recovered loans, rate method |
| Year-over-year comparison | ~6 | Last year's income, expenditure, net income, surplus distribution |
| Activity-level financials | ~8 | Per-activity income/expense/surplus, output, unit of measure, distribution |
| Threats & disputes | ~6 | Creditor breakdowns, competitors, resolved/unresolved disputes |
| Qualitative / free-text | ~5 | Success reasons, challenges, recommendations, comments |
| Non-financial engine stats | ~84 | All NfIndicatorEngine stats (membership detail, savings stats, loan stats, FD stats, farm coop stats) |

### 6.4 KPI Coverage Summary (Backend Engines)

| Dimension | Upload Coverage | Manual Coverage |
|---|---|---|
| Financial KPIs — fully accurate | 18/18 | 6/18 |
| Financial KPIs — compute with drift | 0 | 10/18 |
| Financial KPIs — broken (0 or NaN) | 0 | 1/18 (operating_expense_ratio) |
| Financial KPIs — bug (double-count) | 0 | 1 (4101 inflates 2 more KPIs) |
| Non-financial engine stats | 84+ | 0 |
| Frontend NF KPIs | 32+ | 0 |
| Ministry NF indicators | 0 (unused) | 0 (unused) |

### 6.5 Key Takeaway

**~76% of the manual questionnaire fields provide information that the digital upload pipeline cannot produce.** These are primarily governance, staff, training, activity-level financials, qualitative assessments, and gender-disaggregated breakdowns. The remaining **~24% overlap** — mostly aggregate financial figures and basic membership counts — could be auto-populated from the digital submission, reducing data entry effort.
