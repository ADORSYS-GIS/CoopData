# Manual Questionnaire Field Redundancy Analysis

> Maps every manual questionnaire field against what the digital upload pipeline can already produce, to identify which form questions are redundant.

---

## FINANCIAL QUESTIONNAIRE

### A. LEADERSHIP & MANAGEMENT

#### Committee Composition

| # | Manual Field | Derivable from Upload? | Upload Equivalent |
|---|---|---|---|
| 1 | board_members_male / female | ❌ Unique | Upload `members.leadership_role` doesn't distinguish committees |
| 2 | exec_committee_male / female | ❌ Unique | Same — no committee-type breakdown in upload |
| 3 | credit_committee_male / female | ❌ Unique | Same |
| 4 | education_committee_male / female | ❌ Unique | Same |
| 5 | supervisory_committee_male / female | ❌ Unique | Same |
| 6 | chair_education | ❌ Unique | No education data on any upload table |
| 7 | vice_chair_education | ❌ Unique | Same |
| 8 | treasurer_education | ❌ Unique | Same |
| 9 | secretary_education | ❌ Unique | Same |

#### Staff Count by Role

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 10 | staff_manager_male / female | ❌ Unique | Upload has no staff table |
| 11 | staff_ass_manager_male / female | ❌ Unique | Same |
| 12 | staff_acc_male / female | ❌ Unique | Same |
| 13 | staff_other_mgmt_male / female | ❌ Unique | Same |
| 14 | staff_support_male / female | ❌ Unique | Same |
| 15 | manager_academic_level | ❌ Unique | No manager data in upload |
| 16 | manager_coop_training_level | ❌ Unique | Same |

#### Training

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 17 | members_trained_last_year | ❌ Unique | No training records in upload |
| 18 | leaders_trained_last_year | ❌ Unique | Same |
| 19 | staff_trained_last_year | ❌ Unique | Same |
| 20 | training_sponsor | ❌ Unique | Not captured |
| 21 | training_quality_rating | ❌ Unique | Qualitative — not in upload |
| 22 | member_training_needs | ❌ Unique | Free-text, not in upload |
| 23 | leader_training_needs | ❌ Unique | Same |
| 24 | staff_training_needs | ❌ Unique | Same |
| 25 | willing_to_cover_training_cost_pct | ❌ Unique | Not captured |

#### Membership Counts (Overlap Section)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 26 | registered_members_male / female | ✅ Redundant | NfEngine: `members.total` broken by `gender` |
| 27 | active_members_male / female | ✅ Redundant | NfEngine: count where `status == Active`, by `gender` |
| 28 | active_members_youth_17_under | ✅ Redundant | NfEngine: `under_18` (age_group == Under18) |
| 29 | active_members_18_25 | ⚠️ Partial (18–25 vs 18–35) | NfEngine: `age_18_35` groups 18–35 together — can't isolate 18–25 |
| 30 | active_members_26_35 | ⚠️ Partial (same bucket issue) | Subsumed in `age_18_35` |
| 31 | active_members_36_60 | ✅ Redundant | NfEngine: `age_36_50` + `over_50` combined cover this |
| 32 | active_members_61_plus | ✅ Redundant | NfEngine: `over_50` |
| 33 | dormant_members_male / female | ✅ Redundant | NfEngine: `dormant` by `gender` |
| 34 | agm_attendance_male / female | ✅ Redundant | NfEngine: `agm_attendance` by `gender` |

#### Governance & Operations (Unique Data)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 35 | society_status | ❌ Unique | Qualitative — not in upload |
| 36 | dormancy_reasons | ❌ Unique | Free-text, not in upload |
| 37 | dormancy_effect | ❌ Unique | Same |
| 38 | management_tools | ❌ Unique | Not captured |
| 39 | governance_tools | ❌ Unique | Not captured |
| 40 | agm_up_to_date | ❌ Unique | Not in upload |
| 41 | agm_arrears_months | ❌ Unique | Not in upload |
| 42 | agm_arrears_reasons | ❌ Unique | Free-text |
| 43 | last_audit_date | ❌ Unique | Not in upload |
| 44 | last_inspection_date | ❌ Unique | Same |
| 45 | last_mgmt_report_date | ❌ Unique | Same |
| 46 | last_budget_date | ❌ Unique | Same |
| 47 | last_committee_profile_date | ❌ Unique | Same |
| 48 | last_audit_firm | ❌ Unique | Same |
| 49 | financial_products | ❌ Unique | Upload NF doesn't list products offered |
| 50 | non_financial_products | ❌ Unique | Same |

---

### B. CAPITALIZATION

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 51 | share_nominal_value | ❌ Unique | Not captured anywhere in upload |
| 52 | share_capital_contribution_per_member | ❌ Unique | Same |
| 53 | total_share_capital_male / female | ✅ Redundant | Account code 3101 → KpiEngine sums it from line items |
| 54 | borrowed_funds | ✅ Redundant | Account code 2201 → KpiEngine |
| 55 | donations_grants | ✅ Redundant | Account code 4201 → KpiEngine |
| 56 | accumulated_statutory_reserves_book_value | ✅ Redundant | Account code 3201 → KpiEngine |
| 57 | actual_accumulated_statutory_reserves | ❌ Unique | No "actual vs book" distinction in upload |
| 58 | retained_earnings | ✅ Redundant | Account code 3301 → KpiEngine |

---

### C. SAVINGS PORTFOLIO (Financial)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 59 | depositors_male / female | ❌ Unique | NF upload has individual savings accounts linked to members, so potentially derivable from `savings_accounts` joined with `members` — but NfEngine doesn't compute depositor gender counts today |
| 60 | total_savings_male / female | ⚠️ Partial | Account code 2101 covers total savings (both genders combined). Gender split not available from balance sheet codes |
| 61 | products_interest_rates | ❌ Unique | Upload savings accounts have per-account `interest_rate` but no product-level summary |
| 62 | invested_in_bank | ✅ Redundant | Account code 1102 → KpiEngine |
| 63 | invested_in_shares | ✅ Redundant | Account code 1104 component → KpiEngine |
| 64 | other_investments | ✅ Redundant | Account code 1104 component → KpiEngine |

---

### D. LOAN PORTFOLIO (Financial)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 65 | loans_issued_male / female / coops | ❌ Unique | Upload `loans` table has individual loans but NfEngine doesn't report gender-disaggregated counts of loans issued |
| 66 | value_issued_male / female / coops | ❌ Unique | Same — NfEngine reports `total_loan_amount` but not by gender |
| 67 | outstanding_accounts_male / female / coops | ❌ Unique | Same limitation |
| 68 | outstanding_value_male / female | ✅ Redundant | Account 1201 components → KpiEngine (`outstanding_value_male+female+coops` mapped to 1201) |
| 69 | outstanding_value_coops | ✅ Redundant | Same (part of 1201) |
| 70 | delinquent_accounts_male / female / coops | ❌ Unique | Gender split not available from balance sheet codes |
| 71 | delinquent_value_male / female / coops | ❌ Unique | Same |
| 72 | delinquent_value_0_30_days | ✅ Redundant | Account 1202 → KpiEngine |
| 73 | delinquent_value_31_365_days | ✅ Redundant | Account 1205 → KpiEngine |
| 74 | provision_0_30_days | ✅ Redundant | Account 1251 → KpiEngine |
| 75 | provision_31_365_days | ✅ Redundant | Account 1252 → KpiEngine |
| 76 | written_off_value | ✅ Redundant | Account 5301 → KpiEngine |
| 77 | recovered_loans_12_months | ❌ Unique | Not tracked in upload balance sheet |
| 78 | average_loan_term_months | ❌ Unique | Upload `loans` has per-loan `loan_maturity_date` and `loan_start_date` — derivable but NfEngine doesn't compute it |
| 79 | average_interest_rate_pct | ❌ Unique | Upload `loans` has per-loan `interest_rate` — derivable but not computed |
| 80 | fees_stationery / application / loan_protection / penalties / others | ✅ Redundant | All summed → Account 4102 → KpiEngine |
| 81 | interest_rate_method | ❌ Unique | Not in upload |

---

### E. OTHER ACTIVITIES INCOME

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 82 | activity_name | ❌ Unique | Upload doesn't break down activities by name |
| 83 | annual_income | ⚠️ Bug (double-count) | Mapped to 4101 — already covered by KpiEngine from balance sheet. **If user fills this, it double-counts with PFR.current_total_income** |
| 84 | annual_expenditure | ✅ Redundant | Mapped to 5101 → KpiEngine |
| 85 | net_profit | ✅ Redundant | Derived from income - expenditure per activity |

---

### F. PERIODIC FINANCIAL REPORTING

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 86 | report_frequencies | ❌ Unique | Not captured in upload |
| 87 | current_total_income | ✅ Redundant | KpiEngine: 4101+4102+4201 from line items |
| 88 | last_total_income | ❌ Unique | Previous year's data not stored in submission context |
| 89 | current_expenditure | ⚠️ Partial | Account 5999 is provided by manual, but KpiEngine sum is: 5101+5102+5201+5202+5203+5204+5301 (more granular). Upload covers **all** operating expenses; manual only a single "total" |
| 90 | last_expenditure | ❌ Unique | Previous year |
| 91 | current_net_income | ✅ Redundant | Account 6999 → KpiEngine |
| 92 | last_net_income | ❌ Unique | Previous year |
| 93 | current_surplus_distr | ❌ Unique | Not in upload |
| 94 | last_surplus_distr | ❌ Unique | Previous year |
| 95 | non_current_assets | ✅ Redundant | Account 1303 → KpiEngine |
| 96 | total_current_assets | ✅ Redundant | Account 1100 → KpiEngine |
| 97 | current_liabilities | ✅ Redundant | Account 2100 → KpiEngine |
| 98 | long_term_liabilities | ✅ Redundant | Account 2200 → KpiEngine |
| 99 | total_equity | ✅ Redundant | Account 3999 → KpiEngine |
| 100 | accumulated_reserves_book_value | ✅ Redundant | Account 3201 → KpiEngine |
| 101 | actual_reserves_in_bank | ❌ Unique | "Actual vs book" distinction not in upload |

---

### G. QUALITATIVE ASSESSMENT

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| 102 | competitor_advantages | ❌ Unique | Free-text, not in upload |
| 103 | success_reasons | ❌ Unique | Same |
| 104 | failure_challenges | ❌ Unique | Same |
| 105 | recommendations | ❌ Unique | Same |
| 106 | respondent_comments | ❌ Unique | Same |

---

## NON-FINANCIAL QUESTIONNAIRE

### NF-A. BASIC DATA

#### Membership (same overlap as Financial A)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| NF1 | registered_members_male / female | ✅ Redundant | NfEngine: `total` by `gender` |
| NF2 | active_members_male / female | ✅ Redundant | NfEngine: `active` by `gender` |
| NF3 | active_members_17_under_male / female | ✅ Redundant | NfEngine: `under_18` by `gender` |
| NF4 | active_members_18_25_male / female | ⚠️ Partial | Subsumed in `age_18_35` — can't isolate 18–25 |
| NF5 | active_members_26_35_male / female | ⚠️ Partial | Subsumed in `age_18_35` |
| NF6 | active_members_36_60_male / female | ✅ Redundant | `age_36_50` + `over_50` |
| NF7 | active_members_61_plus_male / female | ✅ Redundant | `over_50` |
| NF8 | board_members_male / female | ❌ Unique | Upload has `leadership_role` but no committee breakdown |
| NF9 | exec_committee_male / female | ❌ Unique | Same |
| NF10 | credit_committee_male / female | ❌ Unique | Same |
| NF11 | education_committee_male / female | ❌ Unique | Same |
| NF12 | supervisory_committee_male / female | ❌ Unique | Same |
| NF13–16 | chair/vice/treasurer/secretary_education | ❌ Unique | No education data |
| NF17 | committee_elected_date | ❌ Unique | Not captured |
| NF18 | committee_oriented_date | ❌ Unique | Not captured |
| NF19 | agm_last_held_date | ❌ Unique | Not captured |
| NF20 | agm_attendance_male / female | ✅ Redundant | NfEngine: `agm_attendance` by gender |

#### Fees & Capital (Double coverage with Financial B)

| # | Manual Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| NF21 | member_joining_fee | ❌ Unique | Not in upload |
| NF22 | annual_subscription_fee | ❌ Unique | Not in upload |
| NF23 | share_nominal_value | ❌ Unique | Not in upload (same as Fin Q #51) |
| NF24 | share_capital_contribution_per_member | ❌ Unique | Not in upload (same as Fin Q #52) |
| NF25 | total_share_capital_male / female | ✅ Redundant | Account 3101 |
| NF26 | borrowed_funds | ✅ Redundant | Account 2201 |
| NF27 | donations_grants | ✅ Redundant | Account 4201 |
| NF28 | statutory_reserve_book_value | ✅ Redundant | Account 3201 |
| NF29 | actual_statutory_reserves | ❌ Unique | "Actual vs book" distinction |
| NF30 | manager_gender | ❌ Unique | Not in upload |
| NF31 | manager_academic_level | ❌ Unique | Not in upload |
| NF32 | manager_coop_training_level | ❌ Unique | Not in upload |
| NF33 | society_status | ❌ Unique | Qualitative (same as Fin #35) |

#### Governance Dates

| # | Manual Field | Derivable? |
|---|---|---|
| NF34–38 | last_audit/inspection/mgmt_report/budget/committee_profile dates | ❌ All Unique |
| NF39 | last_audit_firm | ❌ Unique |

#### Staff (same as Financial A)

| # | Manual Field | Derivable? |
|---|---|---|
| NF40–49 | staff_*_male/female (all 8 role/gender combos) | ❌ All Unique |
| NF50 | committee_meeting_frequency | ❌ Unique |
| NF51 | meeting_purposes | ❌ Unique |

---

### NF-B. MEMBER EMPOWERMENT (same as Financial A training)

| # | Field | Derivable? |
|---|---|---|
| NF52–60 | members/leaders/staff trained, sponsor, quality, needs, cost_pct | ❌ All Unique — no training data in upload |

---

### NF-C. MAIN ACTIVITY PERFORMANCE

| # | Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| NF61 | activity_name | ❌ Unique | Upload `farm_coop` has `primary_activities` but no per-activity financial breakdown |
| NF62 | unit_of_measure | ❌ Unique | Not captured |
| NF63 | annual_output | ❌ Unique | Farm_coop doesn't track production volume |
| NF64 | total_income | ❌ Unique | Per-activity income not in farm_coop |
| NF65 | total_expenses | ❌ Unique | Per-activity expenses not tracked |
| NF66 | net_surplus | ❌ Unique | Derived from NF64-NF65 |
| NF67 | distributed_to_members | ❌ Unique | Farm_coop has no distribution tracking |
| NF68 | last_distribution_date | ❌ Unique | Same |

---

### NF-D. OTHER ACTIVITIES INCOME (same structure as Financial E)

| # | Field | Derivable? |
|---|---|---|
| NF69–73 | Same 5 fields as Financial Q82–86 | ❌ All Unique (activity-level breakdown not in upload) |

---

### NF-E. MAIN THREATS

| # | Field | Derivable? | Upload Equivalent |
|---|---|---|---|
| NF74 | owed_to_creditors_outsiders | ⚠️ Partial | Account 2100 (current liabilities) covers all short-term payables but isn't broken down by creditor type |
| NF75 | owed_to_creditors_members | ❌ Unique | Not separately tracked in CoA |
| NF76 | outstanding_owed_to_banks | ❌ Unique | Not separately tracked |
| NF77 | outstanding_owed_by_members | ✅ Redundant | Loan portfolio outstanding balances (account 1201) |
| NF78 | outstanding_payments_to_members | ❌ Unique | Not tracked in CoA |
| NF79 | number_of_competitors | ❌ Unique | Qualitative, not in upload |
| NF80 | disputes_resolved | ❌ Unique | Not in upload |
| NF81 | disputes_unresolved | ❌ Unique | Not in upload |

---

### NF-F. SAVINGS PORTFOLIO (same structure as Financial C)

| # | Field | Derivable? |
|---|---|---|
| NF82–87 | Same 6 fields as Financial Q59–64 | Same mappings |

---

### NF-G. LOAN PORTFOLIO (same structure as Financial D)

| # | Field | Derivable? |
|---|---|---|
| NF88–113 | Same 26 fields as Financial Q65–81 | Same mappings |

---

### NF-H. PERIODIC REPORTING (same structure as Financial F)

| # | Field | Derivable? |
|---|---|---|
| NF114–129 | Same 16 fields as Financial Q86–101 | Same mappings — with one difference: here `total_liabilities` (single field) is mapped to `current + long-term`, not broken into 2100+2200 separately |

---

### NF-I. QUALITATIVE ASSESSMENT (same as Financial G)

| # | Field | Derivable? |
|---|---|---|
| NF130–134 | Same 5 fields | ❌ All Unique |

---

## SUMMARY

### Financial Questionnaire: 106 fields total

| Category | Count | Redundant with Upload | Unique to Manual |
|---|---|---|---|
| Leadership & Management | 50 | **8** (membership counts, AGM attendance) | **42** (committees, staff, training, governance, products) |
| Capitalization | 8 | **4** (share capital, borrowed funds, donations, reserves, retained earnings) | **3** (nominal value, per-member contribution, actual reserves) |
| Savings Portfolio | 6 | **3** (bank, shares, other investments) | **2** (depositors by gender, interest rate products) |
| Loan Portfolio | 17 | **7** (outstanding values, delinquencies, provisions, write-offs, fees) | **10** (gender-disaggregated counts, recoveries, avg term, avg rate, method) |
| Activities Income | 4 | **3** (income, expenditure, net) | **1** (activity name) — but income has **double-count bug** |
| Periodic Reporting | 16 | **9** (current income, net income, assets, liabilities, equity, reserves, non-current assets, current assets) | **7** (last year comparisons, surplus distribution, current expenditure as total, actual reserves) |
| Qualitative | 5 | **0** | **5** (all free-text) |
| **Total** | **106** | **34** (32%) | **72** (68%) |

### Non-Financial Questionnaire: 134 fields

| Category | Count | Redundant with Upload | Unique to Manual |
|---|---|---|---|
| Basic Data | 51 | **10** (membership counts, AGM, share capital, borrowed funds, donations, reserves) | **41** (committee breakdown, staff, education, fees, dates, products) |
| Member Empowerment | 9 | **0** | **9** (all training data) |
| Main Activity Performance | 8 | **0** | **8** (all per-activity financials) |
| Other Activities Income | ~4 | **0** | **4** |
| Main Threats | 8 | **1** (owed_by_members) | **7** |
| Savings Portfolio | 6 | **3** (bank, shares, investments) | **3** |
| Loan Portfolio | 26 | **10** (financial items shared with Fin Q) | **16** |
| Periodic Reporting | 16 | **9** (same financial items) | **7** |
| Qualitative | 5 | **0** | **5** |
| **Total** | **~133** | **33** (25%) | **100** (75%) |

### Combined Deduplication Opportunity

If a cooperative submitted via **digital upload** (Excel/PDF), the following manual questionnaire sections are **fully redundant** and could be auto-populated or skipped:

**Fully redundant field groups:**
- All member counts (total, active, by gender, by age group) — NfEngine
- All dormant member counts — NfEngine
- AGM attendance — NfEngine
- Share capital, borrowed funds, donations, reserves, retained earnings — KpiEngine (accounts 3101, 2201, 4201, 3201, 3301)
- Invested in bank/shares/other — KpiEngine (accounts 1102, 1104)
- Outstanding loan values, delinquencies, provisions, write-offs — KpiEngine (accounts 1201, 1202, 1205, 1251, 1252, 5301)
- Loan fees (stationery, application, protection, penalties, others) — KpiEngine (account 4102)
- Total income, net income, assets, liabilities, equity — KpiEngine (accounts 6999, 1999, 2999, 3999, etc.)

**Total redundant fields: ~67 out of ~239 (28%)**

**Unique to manual questionnaire (cannot be derived from upload):**
- Committee composition by type and gender
- Staff composition by role and gender
- Education levels of leadership
- Training data (counts, sponsors, quality, needs)
- Governance dates and audit history
- Products offered (financial and non-financial)
- Share structure (nominal value, per-member contribution)
- Gender-disaggregated depositor/borrower counts
- Loan terms and average interest rate
- Recovered loans
- Activity-level financial performance (farm and other)
- Threats assessment (creditors, disputes, competitors)
- All qualitative assessments
- Year-over-year comparisons (last year's income/expenses/surplus)
- Surplus distribution data
