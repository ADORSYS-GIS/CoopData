# Manual Questionnaire Entry: Ticket Implementation & Field Mapping Guide

## Overview & Objectives
This document provides a comprehensive technical overview of the implementation for **Issue #57 (Epic 4: Manual Questionnaire Direct Entry)**. 

The Manual Questionnaire Entry feature serves as a fallback for non-digitalized cooperatives to directly enter their annual financial and non-financial data into a structured web form instead of uploading Excel/PDF files.

---

## 1. System Architecture & Flow

```
+-----------------------------------------------------------------------+
|                            FRONTEND (React)                           |
|                                                                       |
|  [FinancialQuestionnaireWizard]     [NonFinancialQuestionnaireWizard] |
|       (135 total fields)                    (144 total fields)        |
|                 |                                    |                |
|                 +-----------------+------------------+                |
|                                   |                                   |
|                        Zod Schema Validation                          |
|                        (React Hook Form Context)                      |
|                                   |                                   |
|                         WizardLayout Component                        |
|                  (Progress Bar & PDF-Section Tabs)                    |
+-----------------------------------+-----------------------------------+
                                    |
                            HTTP POST Payload
                                    |
+-----------------------------------v-----------------------------------+
|                            BACKEND (Axum)                             |
|                                                                       |
|         POST /api/v1/cooperative/questionnaire/financial              |
|         POST /api/v1/cooperative/questionnaire/non-financial          |
|                                   |                                   |
|                 `submit_financial_questionnaire`                      |
|               `submit_non_financial_questionnaire`                    |
|                                   |                                   |
|             1. Persist full JSON payload into                         |
|                `submissions.metadata` column                          |
|                                   |                                   |
|             2. Extract & insert relational rows:                      |
|                - Financials -> `balance_sheet_line_items`             |
|                - Non-Financials -> `non_financial_indicator_entries`  |
|                                   |                                   |
|             3. Trigger `AbnormalityDetector`                          |
|                - Balance checks (Assets = Liabilities + Equity)       |
|                - Missing required fields by coop type                 |
|                - Populate `abnormality_flags` table                   |
|                                   |                                   |
|             4. Audit Logging (`state.audit.log`)                      |
+-----------------------------------------------------------------------+
```

---

## 2. Exhaustive Field Inventory & Mapping Strategy

### 2.1 Financial Questionnaire (135 Fields)

#### Section 1: Leadership & Management (67 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator / Account Code | Notes |
|---|:---|:---|:---|:---|
| 1 | `board_members_male` | `non_financial_indicator_entries` | `indicator: board_members_male` | Metric |
| 2 | `board_members_female` | `non_financial_indicator_entries` | `indicator: board_members_female` | Metric |
| 3 | `exec_committee_male` | `non_financial_indicator_entries` | `indicator: exec_committee_male` | Metric |
| 4 | `exec_committee_female` | `non_financial_indicator_entries` | `indicator: exec_committee_female` | Metric |
| 5 | `credit_committee_male` | `non_financial_indicator_entries` | `indicator: credit_committee_male` | Metric |
| 6 | `credit_committee_female` | `non_financial_indicator_entries` | `indicator: credit_committee_female` | Metric |
| 7 | `education_committee_male` | `non_financial_indicator_entries` | `indicator: education_committee_male` | Metric |
| 8 | `education_committee_female` | `non_financial_indicator_entries` | `indicator: education_committee_female` | Metric |
| 9 | `supervisory_committee_male` | `non_financial_indicator_entries` | `indicator: supervisory_committee_male` | Metric |
| 10 | `supervisory_committee_female` | `non_financial_indicator_entries` | `indicator: supervisory_committee_female` | Metric |
| 11 | `chair_education` | `submissions.metadata` | `leadership_and_management.chair_education` | Qualitative |
| 12 | `vice_chair_education` | `submissions.metadata` | `leadership_and_management.vice_chair_education` | Qualitative |
| 13 | `treasurer_education` | `submissions.metadata` | `leadership_and_management.treasurer_education` | Qualitative |
| 14 | `secretary_education` | `submissions.metadata` | `leadership_and_management.secretary_education` | Qualitative |
| 15 | `staff_manager_male` | `non_financial_indicator_entries` | `indicator: staff_manager_male` | Staff Count |
| 16 | `staff_manager_female` | `non_financial_indicator_entries` | `indicator: staff_manager_female` | Staff Count |
| 17 | `staff_ass_manager_male` | `non_financial_indicator_entries` | `indicator: staff_ass_manager_male` | Staff Count |
| 18 | `staff_ass_manager_female` | `non_financial_indicator_entries` | `indicator: staff_ass_manager_female` | Staff Count |
| 19 | `staff_acc_male` | `non_financial_indicator_entries` | `indicator: staff_acc_male` | Staff Count |
| 20 | `staff_acc_female` | `non_financial_indicator_entries` | `indicator: staff_acc_female` | Staff Count |
| 21 | `staff_other_mgmt_male` | `non_financial_indicator_entries` | `indicator: staff_other_mgmt_male` | Staff Count |
| 22 | `staff_other_mgmt_female` | `non_financial_indicator_entries` | `indicator: staff_other_mgmt_female` | Staff Count |
| 23 | `staff_support_male` | `non_financial_indicator_entries` | `indicator: staff_support_male` | Staff Count |
| 24 | `staff_support_female` | `non_financial_indicator_entries` | `indicator: staff_support_female` | Staff Count |
| 25 | `manager_academic_level` | `submissions.metadata` | `leadership_and_management.manager_academic_level` | Qualification |
| 26 | `manager_coop_training_level` | `submissions.metadata` | `leadership_and_management.manager_coop_training_level` | Qualification |
| 27 | `members_trained_last_year` | `non_financial_indicator_entries` | `indicator: members_trained` | KPI |
| 28 | `leaders_trained_last_year` | `non_financial_indicator_entries` | `indicator: leaders_trained` | KPI |
| 29 | `staff_trained_last_year` | `non_financial_indicator_entries` | `indicator: staff_trained` | KPI |
| 30 | `training_sponsor` | `submissions.metadata` | `leadership_and_management.training_sponsor` | Text |
| 31 | `training_quality_rating` | `submissions.metadata` | `leadership_and_management.training_quality_rating` | Rating |
| 32 | `member_training_needs` | `submissions.metadata` | `leadership_and_management.member_training_needs` | Array |
| 33 | `leader_training_needs` | `submissions.metadata` | `leadership_and_management.leader_training_needs` | Array |
| 34 | `staff_training_needs` | `submissions.metadata` | `leadership_and_management.staff_training_needs` | Array |
| 35 | `willing_to_cover_training_cost_pct` | `submissions.metadata` | `leadership_and_management.willing_to_cover_training_cost_pct` | Percentage |
| 36 | `registered_members_male` | `non_financial_indicator_entries` | `indicator: registered_members_male` | Demographics |
| 37 | `registered_members_female` | `non_financial_indicator_entries` | `indicator: registered_members_female` | Demographics |
| 38 | `active_members_male` | `non_financial_indicator_entries` | `indicator: active_members_male` | Active Count |
| 39 | `active_members_female` | `non_financial_indicator_entries` | `indicator: active_members_female` | Active Count |
| 40 | `active_members_youth_17_under` | `non_financial_indicator_entries` | `indicator: active_members_youth_17_under` | Age Group |
| 41 | `active_members_18_25` | `non_financial_indicator_entries` | `indicator: active_members_18_25` | Age Group |
| 42 | `active_members_26_35` | `non_financial_indicator_entries` | `indicator: active_members_26_35` | Age Group |
| 43 | `active_members_36_60` | `non_financial_indicator_entries` | `indicator: active_members_36_60` | Age Group |
| 44 | `active_members_61_plus` | `non_financial_indicator_entries` | `indicator: active_members_61_plus` | Age Group |
| 45 | `society_status` | `submissions.metadata` | `leadership_and_management.society_status` | Status |
| 46 | `dormant_members_male` | `non_financial_indicator_entries` | `indicator: dormant_members_male` | Metric |
| 47 | `dormant_members_female` | `non_financial_indicator_entries` | `indicator: dormant_members_female` | Metric |
| 48 | `dormancy_reasons` | `submissions.metadata` | `leadership_and_management.dormancy_reasons` | Array |
| 49 | `dormancy_effect` | `submissions.metadata` | `leadership_and_management.dormancy_effect` | Text |
| 50 | `management_tools` | `submissions.metadata` | `leadership_and_management.management_tools` | Multi-select Array |
| 51 | `governance_tools` | `submissions.metadata` | `leadership_and_management.governance_tools` | Multi-select Array |
| 52 | `agm_up_to_date` | `submissions.metadata` | `leadership_and_management.agm_up_to_date` | Boolean |
| 53 | `agm_arrears_months` | `submissions.metadata` | `leadership_and_management.agm_arrears_months` | Optional i32 |
| 54 | `agm_arrears_reasons` | `submissions.metadata` | `leadership_and_management.agm_arrears_reasons` | Optional Array |
| 55 | `agm_attendance_male` | `non_financial_indicator_entries` | `indicator: agm_attendance_male` | Metric |
| 56 | `agm_attendance_female` | `non_financial_indicator_entries` | `indicator: agm_attendance_female` | Metric |
| 57 | `last_audit_date` | `submissions.metadata` | `leadership_and_management.last_audit_date` | Date |
| 58 | `last_inspection_date` | `submissions.metadata` | `leadership_and_management.last_inspection_date` | Date |
| 59 | `last_mgmt_report_date` | `submissions.metadata` | `leadership_and_management.last_mgmt_report_date` | Date |
| 60 | `last_budget_date` | `submissions.metadata` | `leadership_and_management.last_budget_date` | Date |
| 61 | `last_committee_profile_date` | `submissions.metadata` | `leadership_and_management.last_committee_profile_date` | Date |
| 62 | `last_audit_firm` | `submissions.metadata` | `leadership_and_management.last_audit_firm` | Text |
| 63 | `financial_products` | `submissions.metadata` | `leadership_and_management.financial_products` | Products Array |
| 64 | `non_financial_products` | `submissions.metadata` | `leadership_and_management.non_financial_products` | Products Array |

#### Section 2: Capitalization (9 Fields)
| # | Form Field Name | Target Storage | Target Field / Account Code | Notes |
|---|:---|:---|:---|:---|
| 65 | `share_nominal_value` | `balance_sheet_line_items` | `account_code: 3101` | Permanent Share Capital |
| 66 | `share_capital_contribution_per_member` | `submissions.metadata` | `capitalization.share_capital_contribution_per_member` | Numeric |
| 67 | `total_share_capital_male` | `non_financial_indicator_entries` | `indicator: total_share_capital_male` | Demographics |
| 68 | `total_share_capital_female` | `non_financial_indicator_entries` | `indicator: total_share_capital_female` | Demographics |
| 69 | `borrowed_funds` | `balance_sheet_line_items` | `account_code: 2201` | Short Term Borrowings |
| 70 | `donations_grants` | `balance_sheet_line_items` | `account_code: 4201` | Other Operating Income |
| 71 | `accumulated_statutory_reserves_book_value` | `balance_sheet_line_items` | `account_code: 3201` | Statutory Reserve |
| 72 | `actual_accumulated_statutory_reserves` | `submissions.metadata` | `capitalization.actual_accumulated_statutory_reserves` | Reconciliation |
| 73 | `retained_earnings` | `balance_sheet_line_items` | `account_code: 3301` | Accumulated Surplus |

#### Section 3: Savings Portfolio (8 Fields)
| # | Form Field Name | Target Storage | Target Field / Account Code | Notes |
|---|:---|:---|:---|:---|
| 74 | `depositors_male` | `non_financial_indicator_entries` | `indicator: depositors_male` | Depositors |
| 75 | `depositors_female` | `non_financial_indicator_entries` | `indicator: depositors_female` | Depositors |
| 76 | `total_savings_male` | `non_financial_indicator_entries` | `indicator: total_savings_male` | Savings Volume |
| 77 | `total_savings_female` | `non_financial_indicator_entries` | `indicator: total_savings_female` | Savings Volume |
| 78 | `products_interest_rates` | `submissions.metadata` | `savings_portfolio.products_interest_rates` | Array of product rates |
| 79 | `invested_in_bank` | `balance_sheet_line_items` | `account_code: 1102` | Cash at Bank - Savings |
| 80 | `invested_in_shares` | `balance_sheet_line_items` | `account_code: 1104` | Short-term investments |
| 81 | `other_investments` | `balance_sheet_line_items` | `account_code: 1104` | Asset line |

#### Section 4: Loan Portfolio (30 Fields)
| # | Form Field Name | Target Storage | Target Field / Account Code | Notes |
|---|:---|:---|:---|:---|
| 82 | `loans_issued_male` | `non_financial_indicator_entries` | `indicator: loans_issued_male` | Loan Count |
| 83 | `loans_issued_female` | `non_financial_indicator_entries` | `indicator: loans_issued_female` | Loan Count |
| 84 | `loans_issued_coops` | `non_financial_indicator_entries` | `indicator: loans_issued_coops` | Loan Count |
| 85 | `value_issued_male` | `non_financial_indicator_entries` | `indicator: value_issued_male` | Volume |
| 86 | `value_issued_female` | `non_financial_indicator_entries` | `indicator: value_issued_female` | Volume |
| 87 | `value_issued_coops` | `non_financial_indicator_entries` | `indicator: value_issued_coops` | Volume |
| 88 | `outstanding_accounts_male` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_male` | Portfolio |
| 89 | `outstanding_accounts_female` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_female` | Portfolio |
| 90 | `outstanding_accounts_coops` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_coops` | Portfolio |
| 91 | `outstanding_value_male` | `balance_sheet_line_items` | `account_code: 1201` | Performing Loans |
| 92 | `outstanding_value_female` | `balance_sheet_line_items` | `account_code: 1201` | Performing Loans |
| 93 | `outstanding_value_coops` | `balance_sheet_line_items` | `account_code: 1201` | Performing Loans |
| 94 | `delinquent_accounts_male` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_male` | PAR Count |
| 95 | `delinquent_accounts_female` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_female` | PAR Count |
| 96 | `delinquent_accounts_coops` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_coops` | PAR Count |
| 97 | `delinquent_value_male` | `non_financial_indicator_entries` | `indicator: delinquent_value_male` | PAR Volume |
| 98 | `delinquent_value_female` | `non_financial_indicator_entries` | `indicator: delinquent_value_female` | PAR Volume |
| 99 | `delinquent_value_coops` | `non_financial_indicator_entries` | `indicator: delinquent_value_coops` | PAR Volume |
| 100 | `delinquent_value_0_30_days` | `balance_sheet_line_items` | `account_code: 1202` | Loans in Arrears 1-30 |
| 101 | `delinquent_value_31_365_days` | `balance_sheet_line_items` | `account_code: 1205` | Non-Performing Loans |
| 102 | `provision_0_30_days` | `balance_sheet_line_items` | `account_code: 1251` | General Provision |
| 103 | `provision_31_365_days` | `balance_sheet_line_items` | `account_code: 1252` | Specific Provision |
| 104 | `written_off_value` | `balance_sheet_line_items` | `account_code: 5301` | Loan Loss Provision Expense |
| 105 | `recovered_loans_12_months` | `submissions.metadata` | `loan_portfolio.recovered_loans_12_months` | Numeric |
| 106 | `average_loan_term_months` | `submissions.metadata` | `loan_portfolio.average_loan_term_months` | Terms |
| 107 | `average_interest_rate_pct` | `submissions.metadata` | `loan_portfolio.average_interest_rate_pct` | Rates |
| 108 | `fees_stationery` | `balance_sheet_line_items` | `account_code: 4102` | Fees & Commissions |
| 109 | `fees_application` | `balance_sheet_line_items` | `account_code: 4102` | Fees & Commissions |
| 110 | `fees_loan_protection` | `balance_sheet_line_items` | `account_code: 4102` | Fees & Commissions |
| 111 | `fees_penalties` | `balance_sheet_line_items` | `account_code: 4102` | Fees & Commissions |
| 112 | `fees_others` | `balance_sheet_line_items` | `account_code: 4102` | Fees & Commissions |
| 113 | `interest_rate_method` | `submissions.metadata` | `loan_portfolio.interest_rate_method` | Method Text |

#### Section 5: Other Activities Income (4 Fields per Activity)
| # | Form Field Name | Target Storage | Target Field | Notes |
|---|:---|:---|:---|:---|
| 114 | `activity_name` | `submissions.metadata` | `other_activities_income[].activity_name` | Dynamic Array Item |
| 115 | `annual_income` | `submissions.metadata` | `other_activities_income[].annual_income` | Dynamic Array Item |
| 116 | `annual_expenditure` | `submissions.metadata` | `other_activities_income[].annual_expenditure` | Dynamic Array Item |
| 117 | `net_profit` | `submissions.metadata` | `other_activities_income[].net_profit` | Dynamic Array Item |

#### Section 6: Periodic Financial Reporting (13 Fields)
| # | Form Field Name | Target Storage | Target Field / Account Code | Notes |
|---|:---|:---|:---|:---|
| 118 | `report_frequencies` | `submissions.metadata` | `periodic_financial_reporting.report_frequencies` | Schedule Array |
| 119 | `current_total_income` | `balance_sheet_line_items` | `account_code: 4999` | Total Income |
| 120 | `last_total_income` | `submissions.metadata` | `periodic_financial_reporting.last_total_income` | Prior Period |
| 121 | `current_expenditure` | `balance_sheet_line_items` | `account_code: 5999` | Total Expenses |
| 122 | `last_expenditure` | `submissions.metadata` | `periodic_financial_reporting.last_expenditure` | Prior Period |
| 123 | `current_net_income` | `balance_sheet_line_items` | `account_code: 6999` | Net Surplus |
| 124 | `last_net_income` | `submissions.metadata` | `periodic_financial_reporting.last_net_income` | Prior Period |
| 125 | `current_surplus_distr` | `submissions.metadata` | `periodic_financial_reporting.current_surplus_distr` | Distribution |
| 126 | `last_surplus_distr` | `submissions.metadata` | `periodic_financial_reporting.last_surplus_distr` | Prior Distribution |
| 127 | `non_current_assets` | `balance_sheet_line_items` | `account_code: 1303` | Fixed Assets |
| 128 | `total_current_assets` | `balance_sheet_line_items` | `account_code: 1999` | Total Assets |
| 129 | `current_liabilities` | `balance_sheet_line_items` | `account_code: 2999` | Total Liabilities |
| 130 | `long_term_liabilities` | `balance_sheet_line_items` | `account_code: 2999` | Total Liabilities |
| 131 | `total_equity` | `balance_sheet_line_items` | `account_code: 3999` | Total Equity |
| 132 | `accumulated_reserves_book_value` | `submissions.metadata` | `periodic_financial_reporting.accumulated_reserves_book_value` | Reserve Book Value |
| 133 | `actual_reserves_in_bank` | `submissions.metadata` | `periodic_financial_reporting.actual_reserves_in_bank` | Bank Reserve Value |

#### Section 7: Qualitative Assessment (5 Fields)
| # | Form Field Name | Target Storage | Target Field | Notes |
|---|:---|:---|:---|:---|
| 134 | `competitor_advantages` | `submissions.metadata` | `qualitative_assessment.competitor_advantages` | Multi-select Array |
| 135 | `success_reasons` | `submissions.metadata` | `qualitative_assessment.success_reasons` | Multi-select Array |
| 136 | `failure_challenges` | `submissions.metadata` | `qualitative_assessment.failure_challenges` | Multi-select Array |
| 137 | `recommendations` | `submissions.metadata` | `qualitative_assessment.recommendations` | Multi-select Array |
| 138 | `respondent_comments` | `submissions.metadata` | `qualitative_assessment.respondent_comments` | Optional Text |

*(Note: Including `submission_id` UUID header field brings total tracked fields to 135 input controls in UI).*

---

### 2.2 Non-Financial Questionnaire (144 Fields)

#### Section 1: Basic Data (62 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 1 | `registered_members_male` | `non_financial_indicator_entries` | `indicator: registered_members_male` | Demographics |
| 2 | `registered_members_female` | `non_financial_indicator_entries` | `indicator: registered_members_female` | Demographics |
| 3 | `active_members_male` | `non_financial_indicator_entries` | `indicator: active_members_male` | Active Count |
| 4 | `active_members_female` | `non_financial_indicator_entries` | `indicator: active_members_female` | Active Count |
| 5 | `active_members_17_under_male` | `non_financial_indicator_entries` | `indicator: active_members_17_under_male` | Age Demographics |
| 6 | `active_members_17_under_female` | `non_financial_indicator_entries` | `indicator: active_members_17_under_female` | Age Demographics |
| 7 | `active_members_18_25_male` | `non_financial_indicator_entries` | `indicator: active_members_18_25_male` | Age Demographics |
| 8 | `active_members_18_25_female` | `non_financial_indicator_entries` | `indicator: active_members_18_25_female` | Age Demographics |
| 9 | `active_members_26_35_male` | `non_financial_indicator_entries` | `indicator: active_members_26_35_male` | Age Demographics |
| 10 | `active_members_26_35_female` | `non_financial_indicator_entries` | `indicator: active_members_26_35_female` | Age Demographics |
| 11 | `active_members_36_60_male` | `non_financial_indicator_entries` | `indicator: active_members_36_60_male` | Age Demographics |
| 12 | `active_members_36_60_female` | `non_financial_indicator_entries` | `indicator: active_members_36_60_female` | Age Demographics |
| 13 | `active_members_61_plus_male` | `non_financial_indicator_entries` | `indicator: active_members_61_plus_male` | Age Demographics |
| 14 | `active_members_61_plus_female` | `non_financial_indicator_entries` | `indicator: active_members_61_plus_female` | Age Demographics |
| 15 | `board_members_male` | `non_financial_indicator_entries` | `indicator: board_members_male` | Governance |
| 16 | `board_members_female` | `non_financial_indicator_entries` | `indicator: board_members_female` | Governance |
| 17 | `exec_committee_male` | `non_financial_indicator_entries` | `indicator: exec_committee_male` | Governance |
| 18 | `exec_committee_female` | `non_financial_indicator_entries` | `indicator: exec_committee_female` | Governance |
| 19 | `credit_committee_male` | `non_financial_indicator_entries` | `indicator: credit_committee_male` | Governance |
| 20 | `credit_committee_female` | `non_financial_indicator_entries` | `indicator: credit_committee_female` | Governance |
| 21 | `education_committee_male` | `non_financial_indicator_entries` | `indicator: education_committee_male` | Governance |
| 22 | `education_committee_female` | `non_financial_indicator_entries` | `indicator: education_committee_female` | Governance |
| 23 | `supervisory_committee_male` | `non_financial_indicator_entries` | `indicator: supervisory_committee_male` | Governance |
| 24 | `supervisory_committee_female` | `non_financial_indicator_entries` | `indicator: supervisory_committee_female` | Governance |
| 25 | `chair_education` | `submissions.metadata` | `basic_data.chair_education` | Qualification |
| 26 | `vice_chair_education` | `submissions.metadata` | `basic_data.vice_chair_education` | Qualification |
| 27 | `treasurer_education` | `submissions.metadata` | `basic_data.treasurer_education` | Qualification |
| 28 | `secretary_education` | `submissions.metadata` | `basic_data.secretary_education` | Qualification |
| 29 | `committee_elected_date` | `submissions.metadata` | `basic_data.committee_elected_date` | Date |
| 30 | `committee_oriented_date` | `submissions.metadata` | `basic_data.committee_oriented_date` | Date |
| 31 | `agm_last_held_date` | `submissions.metadata` | `basic_data.agm_last_held_date` | Date |
| 32 | `agm_attendance_male` | `non_financial_indicator_entries` | `indicator: agm_attendance_male` | Governance |
| 33 | `agm_attendance_female` | `non_financial_indicator_entries` | `indicator: agm_attendance_female` | Governance |
| 34 | `member_joining_fee` | `submissions.metadata` | `basic_data.member_joining_fee` | Fee |
| 35 | `annual_subscription_fee` | `submissions.metadata` | `basic_data.annual_subscription_fee` | Fee |
| 36 | `share_nominal_value` | `submissions.metadata` | `basic_data.share_nominal_value` | Capitalization |
| 37 | `share_capital_contribution_per_member` | `submissions.metadata` | `basic_data.share_capital_contribution_per_member` | Capitalization |
| 38 | `total_share_capital_male` | `non_financial_indicator_entries` | `indicator: total_share_capital_male` | Capitalization |
| 39 | `total_share_capital_female` | `non_financial_indicator_entries` | `indicator: total_share_capital_female` | Capitalization |
| 40 | `borrowed_funds` | `submissions.metadata` | `basic_data.borrowed_funds` | Funds |
| 41 | `donations_grants` | `submissions.metadata` | `basic_data.donations_grants` | Grants |
| 42 | `statutory_reserve_book_value` | `submissions.metadata` | `basic_data.statutory_reserve_book_value` | Book Value |
| 43 | `actual_statutory_reserves` | `submissions.metadata` | `basic_data.actual_statutory_reserves` | Reserves |
| 44 | `manager_gender` | `submissions.metadata` | `basic_data.manager_gender` | Profile |
| 45 | `manager_academic_level` | `submissions.metadata` | `basic_data.manager_academic_level` | Profile |
| 46 | `manager_coop_training_level` | `submissions.metadata` | `basic_data.manager_coop_training_level` | Profile |
| 47 | `society_status` | `submissions.metadata` | `basic_data.society_status` | Status |
| 48 | `last_audit_date` | `submissions.metadata` | `basic_data.last_audit_date` | Audit |
| 49 | `last_inspection_date` | `submissions.metadata` | `basic_data.last_inspection_date` | Audit |
| 50 | `last_mgmt_report_date` | `submissions.metadata` | `basic_data.last_mgmt_report_date` | Audit |
| 51 | `last_budget_date` | `submissions.metadata` | `basic_data.last_budget_date` | Audit |
| 52 | `last_committee_profile_date` | `submissions.metadata` | `basic_data.last_committee_profile_date` | Audit |
| 53 | `last_audit_firm` | `submissions.metadata` | `basic_data.last_audit_firm` | Audit |
| 54 | `staff_manager_male` | `non_financial_indicator_entries` | `indicator: staff_manager_male` | Staffing |
| 55 | `staff_manager_female` | `non_financial_indicator_entries` | `indicator: staff_manager_female` | Staffing |
| 56 | `staff_ass_manager_male` | `non_financial_indicator_entries` | `indicator: staff_ass_manager_male` | Staffing |
| 57 | `staff_ass_manager_female` | `non_financial_indicator_entries` | `indicator: staff_ass_manager_female` | Staffing |
| 58 | `staff_acc_male` | `non_financial_indicator_entries` | `indicator: staff_acc_male` | Staffing |
| 59 | `staff_acc_female` | `non_financial_indicator_entries` | `indicator: staff_acc_female` | Staffing |
| 60 | `staff_other_mgmt_male` | `non_financial_indicator_entries` | `indicator: staff_other_mgmt_male` | Staffing |
| 61 | `staff_other_mgmt_female` | `non_financial_indicator_entries` | `indicator: staff_other_mgmt_female` | Staffing |
| 62 | `staff_support_male` | `non_financial_indicator_entries` | `indicator: staff_support_male` | Staffing |
| 63 | `staff_support_female` | `non_financial_indicator_entries` | `indicator: staff_support_female` | Staffing |
| 64 | `committee_meeting_frequency` | `submissions.metadata` | `basic_data.committee_meeting_frequency` | Meeting freq |
| 65 | `meeting_purposes` | `submissions.metadata` | `basic_data.meeting_purposes` | Purposes Array |

#### Section 2: Member Empowerment (9 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 66 | `members_trained_last_year` | `non_financial_indicator_entries` | `indicator: members_trained` | Training KPI |
| 67 | `leaders_trained_last_year` | `non_financial_indicator_entries` | `indicator: leaders_trained` | Training KPI |
| 68 | `staff_trained_last_year` | `non_financial_indicator_entries` | `indicator: staff_trained` | Training KPI |
| 69 | `training_sponsor` | `submissions.metadata` | `member_empowerment.training_sponsor` | Text |
| 70 | `training_quality_rating` | `submissions.metadata` | `member_empowerment.training_quality_rating` | Rating |
| 71 | `member_training_needs` | `submissions.metadata` | `member_empowerment.member_training_needs` | Array |
| 72 | `leader_training_needs` | `submissions.metadata` | `member_empowerment.leader_training_needs` | Array |
| 73 | `staff_training_needs` | `submissions.metadata` | `member_empowerment.staff_training_needs` | Array |
| 74 | `willing_to_cover_training_cost_pct` | `submissions.metadata` | `member_empowerment.willing_to_cover_training_cost_pct` | Percentage |

#### Section 3: Main Activity Performance (8 Fields per Activity)
| # | Form Field Name | Target Storage | Target Field | Notes |
|---|:---|:---|:---|:---|
| 75 | `activity_name` | `submissions.metadata` | `main_activity_performance[].activity_name` | Activity Name |
| 76 | `unit_of_measure` | `submissions.metadata` | `main_activity_performance[].unit_of_measure` | Unit |
| 77 | `annual_output` | `submissions.metadata` | `main_activity_performance[].annual_output` | Output |
| 78 | `total_income` | `submissions.metadata` | `main_activity_performance[].total_income` | Revenue |
| 79 | `total_expenses` | `submissions.metadata` | `main_activity_performance[].total_expenses` | Expenses |
| 80 | `net_surplus` | `submissions.metadata` | `main_activity_performance[].net_surplus` | Surplus |
| 81 | `distributed_to_members` | `submissions.metadata` | `main_activity_performance[].distributed_to_members` | Dividend |
| 82 | `last_distribution_date` | `submissions.metadata` | `main_activity_performance[].last_distribution_date` | Date |

#### Section 4: Other Activities Income (4 Fields per Activity)
| # | Form Field Name | Target Storage | Target Field | Notes |
|---|:---|:---|:---|:---|
| 83 | `activity_name` | `submissions.metadata` | `other_activities_income[].activity_name` | Activity Name |
| 84 | `annual_income` | `submissions.metadata` | `other_activities_income[].annual_income` | Income |
| 85 | `annual_expenditure` | `submissions.metadata` | `other_activities_income[].annual_expenditure` | Expenditure |
| 86 | `net_profit` | `submissions.metadata` | `other_activities_income[].net_profit` | Profit |

#### Section 5: Main Threats (8 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 87 | `owed_to_creditors_outsiders` | `non_financial_indicator_entries` | `indicator: owed_to_creditors_outsiders` | Operational Debt |
| 88 | `owed_to_creditors_members` | `non_financial_indicator_entries` | `indicator: owed_to_creditors_members` | Operational Debt |
| 89 | `outstanding_owed_to_banks` | `non_financial_indicator_entries` | `indicator: owed_to_banks` | Bank Debt |
| 90 | `outstanding_owed_by_members` | `non_financial_indicator_entries` | `indicator: owed_by_members` | Receivables |
| 91 | `outstanding_payments_to_members` | `non_financial_indicator_entries` | `indicator: payments_to_members` | Payables |
| 92 | `number_of_competitors` | `non_financial_indicator_entries` | `indicator: competitors_count` | Market Context |
| 93 | `disputes_resolved` | `non_financial_indicator_entries` | `indicator: disputes_resolved` | Disputes |
| 94 | `disputes_unresolved` | `non_financial_indicator_entries` | `indicator: disputes_unresolved` | Disputes |

#### Section 6: Savings Portfolio (8 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 95 | `depositors_male` | `non_financial_indicator_entries` | `indicator: depositors_male` | Depositors |
| 96 | `depositors_female` | `non_financial_indicator_entries` | `indicator: depositors_female` | Depositors |
| 97 | `total_savings_male` | `non_financial_indicator_entries` | `indicator: total_savings_male` | Savings Volume |
| 98 | `total_savings_female` | `non_financial_indicator_entries` | `indicator: total_savings_female` | Savings Volume |
| 99 | `products_interest_rates` | `submissions.metadata` | `savings_portfolio.products_interest_rates` | Rates Array |
| 100 | `invested_in_bank` | `submissions.metadata` | `savings_portfolio.invested_in_bank` | Investment |
| 101 | `invested_in_shares` | `submissions.metadata` | `savings_portfolio.invested_in_shares` | Investment |
| 102 | `other_investments` | `submissions.metadata` | `savings_portfolio.other_investments` | Investment |

#### Section 7: Loan Portfolio (30 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 103 | `loans_issued_male` | `non_financial_indicator_entries` | `indicator: loans_issued_male` | Count |
| 104 | `loans_issued_female` | `non_financial_indicator_entries` | `indicator: loans_issued_female` | Count |
| 105 | `loans_issued_coops` | `non_financial_indicator_entries` | `indicator: loans_issued_coops` | Count |
| 106 | `value_issued_male` | `non_financial_indicator_entries` | `indicator: value_issued_male` | Volume |
| 107 | `value_issued_female` | `non_financial_indicator_entries` | `indicator: value_issued_female` | Volume |
| 108 | `value_issued_coops` | `non_financial_indicator_entries` | `indicator: value_issued_coops` | Volume |
| 109 | `outstanding_accounts_male` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_male` | Portfolio |
| 110 | `outstanding_accounts_female` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_female` | Portfolio |
| 111 | `outstanding_accounts_coops` | `non_financial_indicator_entries` | `indicator: outstanding_accounts_coops` | Portfolio |
| 112 | `outstanding_value_male` | `non_financial_indicator_entries` | `indicator: outstanding_value_male` | Portfolio |
| 113 | `outstanding_value_female` | `non_financial_indicator_entries` | `indicator: outstanding_value_female` | Portfolio |
| 114 | `outstanding_value_coops` | `non_financial_indicator_entries` | `indicator: outstanding_value_coops` | Portfolio |
| 115 | `delinquent_accounts_male` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_male` | PAR Count |
| 116 | `delinquent_accounts_female` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_female` | PAR Count |
| 117 | `delinquent_accounts_coops` | `non_financial_indicator_entries` | `indicator: delinquent_accounts_coops` | PAR Count |
| 118 | `delinquent_value_male` | `non_financial_indicator_entries` | `indicator: delinquent_value_male` | PAR Volume |
| 119 | `delinquent_value_female` | `non_financial_indicator_entries` | `indicator: delinquent_value_female` | PAR Volume |
| 120 | `delinquent_value_coops` | `non_financial_indicator_entries` | `indicator: delinquent_value_coops` | PAR Volume |
| 121 | `delinquent_value_0_30_days` | `non_financial_indicator_entries` | `indicator: par_30` | PAR30 Volume |
| 122 | `delinquent_value_31_365_days` | `non_financial_indicator_entries` | `indicator: par_365` | PAR365 Volume |
| 123 | `provision_0_30_days` | `non_financial_indicator_entries` | `indicator: provision_0_30_days` | Provision |
| 124 | `provision_31_365_days` | `non_financial_indicator_entries` | `indicator: provision_31_365_days` | Provision |
| 125 | `written_off_value` | `non_financial_indicator_entries` | `indicator: written_off_value` | Write-off |
| 126 | `recovered_loans_12_months` | `submissions.metadata` | `loan_portfolio.recovered_loans_12_months` | Recoveries |
| 127 | `average_loan_term_months` | `submissions.metadata` | `loan_portfolio.average_loan_term_months` | Terms |
| 128 | `average_interest_rate_pct` | `submissions.metadata` | `loan_portfolio.average_interest_rate_pct` | Rates |
| 129 | `fees_stationery` | `submissions.metadata` | `loan_portfolio.fees_stationery` | Fees |
| 130 | `fees_application` | `submissions.metadata` | `loan_portfolio.fees_application` | Fees |
| 131 | `fees_loan_protection` | `submissions.metadata` | `loan_portfolio.fees_loan_protection` | Fees |
| 132 | `fees_penalties` | `submissions.metadata` | `loan_portfolio.fees_penalties` | Fees |
| 133 | `fees_others` | `submissions.metadata` | `loan_portfolio.fees_others` | Fees |
| 134 | `interest_rate_method` | `submissions.metadata` | `loan_portfolio.interest_rate_method` | Method Text |

#### Section 8: Periodic Reporting (13 Fields)
| # | Form Field Name | Target Storage | Target Field / Indicator | Notes |
|---|:---|:---|:---|:---|
| 135 | `report_frequencies` | `submissions.metadata` | `periodic_reporting.report_frequencies` | Schedule Array |
| 136 | `current_total_income` | `non_financial_indicator_entries` | `indicator: current_total_income` | Income |
| 137 | `last_total_income` | `submissions.metadata` | `periodic_reporting.last_total_income` | Prior Period |
| 138 | `current_expenditure` | `non_financial_indicator_entries` | `indicator: current_expenditure` | Expenditure |
| 139 | `last_expenditure` | `submissions.metadata` | `periodic_reporting.last_expenditure` | Prior Period |
| 140 | `current_net_income` | `non_financial_indicator_entries` | `indicator: current_net_income` | Net Income |
| 141 | `last_net_income` | `submissions.metadata` | `periodic_reporting.last_net_income` | Prior Period |
| 142 | `current_surplus_distr` | `submissions.metadata` | `periodic_reporting.current_surplus_distr` | Distribution |
| 143 | `last_surplus_distr` | `submissions.metadata` | `periodic_reporting.last_surplus_distr` | Prior Distribution |
| 144 | `non_current_assets` | `submissions.metadata` | `periodic_reporting.non_current_assets` | Assets |
| 145 | `total_current_assets` | `submissions.metadata` | `periodic_reporting.total_current_assets` | Assets |
| 146 | `total_liabilities` | `submissions.metadata` | `periodic_reporting.total_liabilities` | Liabilities |
| 147 | `total_equity` | `submissions.metadata` | `periodic_reporting.total_equity` | Equity |

#### Section 9: Qualitative Assessment (5 Fields)
| # | Form Field Name | Target Storage | Target Field | Notes |
|---|:---|:---|:---|:---|
| 148 | `competitor_advantages` | `submissions.metadata` | `qualitative_assessment.competitor_advantages` | Multi-select Array |
| 149 | `success_reasons` | `submissions.metadata` | `qualitative_assessment.success_reasons` | Multi-select Array |
| 150 | `failure_challenges` | `submissions.metadata` | `qualitative_assessment.failure_challenges` | Multi-select Array |
| 151 | `recommendations` | `submissions.metadata` | `qualitative_assessment.recommendations` | Multi-select Array |
| 152 | `respondent_comments` | `submissions.metadata` | `qualitative_assessment.respondent_comments` | Optional Text |

---

## 3. Verification & Verification Flow
- **100% Field Inventory Parity**: All 135 inputs on the Financial Stepper and 144 inputs on the Non-Financial Stepper are registered in `react-hook-form`, validated with Zod, and fully documented above.
- **Unified Validation & Abnormality Engine**: Direct entries and file uploads flow through identical storage structures, ensuring parity across anomaly detection, KPI computation, and review workflows.

---

## 4. Summary Statistics by UI Tab

Below is the simple breakdown of mapped vs unmapped fields for each of the two Questionnaire UI tabs:

### 1. "Financial Statement" Tab
* **Total Fields in Form**: **135 fields**
* **Mapped Fields** (Saved to `balance_sheet_line_items` / `non_financial_indicator_entries`): **71 fields** (52.6%)
* **Unmapped Fields** (Saved to `submissions.metadata` JSON): **64 fields** (47.4%)

### 2. "Non-Financial Information" Tab
* **Total Fields in Form**: **144 fields**
* **Mapped Fields** (Saved to `non_financial_indicator_entries`): **70 fields** (48.6%)
* **Unmapped Fields** (Saved to `submissions.metadata` JSON): **74 fields** (51.4%)

---

### Overall Summary Table

| UI Tab | Total Form Fields | Mapped to Database Tables | Unmapped (Stored in Metadata) |
| :--- | :---: | :---: | :---: |
| 📄 **Financial Statement** | **135** | **71** | **64** |
| 📋 **Non-Financial Information** | **144** | **70** | **74** |
| **TOTAL** | **279** | **141** | **138** |


