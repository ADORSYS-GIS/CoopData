# Fields Available from Both Manual Form and Digital Upload

Fields in the manual questionnaire that can also be derived from the digital upload pipeline, organized by source.

---

## From Financial Questionnaire ← KpiEngine (balance_sheet_line_items)

| Manual Field(s) | Account Code(s) | Notes |
|---|---|---|
| total_share_capital_male, total_share_capital_female | 3101 | Combined total (no gender split in upload) |
| borrowed_funds | 2201 | |
| donations_grants | 4201 | |
| accumulated_statutory_reserves_book_value | 3201 | |
| retained_earnings | 3301 | |
| invested_in_bank | 1102 | |
| invested_in_shares, other_investments | 1104 | Combined as "short-term investments" |
| outstanding_value_male, outstanding_value_female, outstanding_value_coops | 1201 | Combined as "performing loans" |
| delinquent_value_0_30_days | 1202 | |
| delinquent_value_31_365_days | 1205 | |
| provision_0_30_days | 1251 | |
| provision_31_365_days | 1252 | |
| written_off_value | 5301 | |
| fees_stationery, fees_application, fees_loan_protection, fees_penalties, fees_others | 4102 | All summed to "fees & commissions" |
| annual_expenditure (activities) | 5101 | |
| current_total_income | 4101+4102+4201 | But 4101 has double-count bug with activity income |
| current_net_income | 6999 | |
| non_current_assets | 1303 | |
| total_current_assets | 1100 | |
| current_liabilities | 2100 | |
| long_term_liabilities | 2200 | |
| total_equity | 3999 | |

---

## From Financial + Non-Financial Questionnaire ← NfIndicatorEngine (members table)

| Manual Field(s) | NfEngine Stat | Filter |
|---|---|---|
| registered_members_male + registered_members_female | total | |
| registered_members_male | male | gender=Male |
| registered_members_female | female | gender=Female |
| active_members_male + active_members_female | active | status=Active |
| active_members_youth_17_under | under_18 | age_group=Under18 |
| active_members_36_60 | age_36_50 + over_50 | Combined from two buckets |
| active_members_61_plus | over_50 | age_group=Over50 |
| dormant_members_male + dormant_members_female | dormant | status=Dormant |
| agm_attendance_male + agm_attendance_female | agm_attendance | agm_attendance=true |

---

## From Non-Financial Questionnaire Only ← NfIndicatorEngine (additional tables)

| Manual Field(s) | NfEngine Stat | Source Table |
|---|---|---|
| outstanding_owed_by_members | total_balance | loans |
| total_savings_male + total_savings_female | total_balance | savings_accounts |

---

## Summary

| Source | Redundant Fields |
|---|---|
| KpiEngine (28 account codes → 24 manual fields) | 24 |
| NfEngine — members (5 stats → 9 manual fields) | 9 |
| NfEngine — loans/savings (2 stats → 2 manual fields) | 2 |
| **Total fields that match both manual and digital** | **~35** |
| **Total fields unique to manual form** | **~204** |
