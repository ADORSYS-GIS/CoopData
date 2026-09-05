# KPI Database Mapping Specification

This document defines all Key Performance Indicators (KPIs) and Non-Financial (NF) indicators that will be calculated immediately upon submission of a cooperative assessment and stored in the PostgreSQL database under the `kpi_records` table.

## 1. Table Schema Design

The `kpi_records` table is designed to store computed metrics in a key-value relational format. This design enables easy scaling for custom KPIs and simplifies database aggregations.

```sql
CREATE TABLE kpi_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    reporting_year INT NOT NULL,
    kpi_name VARCHAR(100) NOT NULL,
    kpi_type VARCHAR(50) NOT NULL, -- 'financial' | 'non_financial'
    value DOUBLE PRECISION NOT NULL,
    formatted VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL, -- 'percent' | 'currency' | 'ratio' | 'count'
    status VARCHAR(20), -- 'green' | 'amber' | 'red' | NULL
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_submission_kpi UNIQUE (submission_id, kpi_name)
);
```

---

## 2. Financial KPIs Mapping

Calculated using `KpiEngine` from the uploaded Balance Sheet line items.

| KPI Identifier (`kpi_name`) | Type | Unit | Description | Thresholds / Status Mapping |
| :--- | :--- | :--- | :--- | :--- |
| `total_assets` | `financial` | `currency` | Total value of all assets owned by the cooperative | None |
| `gross_loan_portfolio` | `financial` | `currency` | Total outstanding loan balance including arrears | None |
| `net_loan_portfolio` | `financial` | `currency` | Gross Loan Portfolio minus Loan Loss Provisions | None |
| `total_member_deposits` | `financial` | `currency` | Total member savings and deposits | None |
| `total_equity` | `financial` | `currency` | Total institutional capital and reserves | None |
| `net_surplus` | `financial` | `currency` | Net income after all expenses | None |
| `par30` | `financial` | `percent` | Portfolio at Risk >30 days ratio | $\le 5\%$ (Green), $\le 10\%$ (Amber), $> 10\%$ (Red) |
| `par90` | `financial` | `percent` | Portfolio at Risk >90 days ratio | $\le 2\%$ (Green), $\le 5\%$ (Amber), $> 5\%$ (Red) |
| `npl_ratio` | `financial` | `percent` | Non-performing loans (>90 days) percentage | $\le 2\%$ (Green), $\le 5\%$ (Amber), $> 5\%$ (Red) |
| `loan_loss_coverage` | `financial` | `percent` | Provisions / Loans in arrears >30 days | $\ge 100\%$ (Green), $\ge 80\%$ (Amber), $< 80\%$ (Red) |
| `roa` | `financial` | `percent` | Return on Assets (Net surplus / Total assets) | $\ge 3\%$ (Green), $\ge 1\%$ (Amber), $< 1\%$ (Red) |
| `roe` | `financial` | `percent` | Return on Equity (Net surplus / Total equity) | $\ge 8\%$ (Green), $\ge 4\%$ (Amber), $< 4\%$ (Red) |
| `operating_expense_ratio` | `financial` | `percent` | Operating expenses / Total assets | $\le 5\%$ (Green), $\le 8\%$ (Amber), $> 8\%$ (Red) |
| `capital_adequacy_ratio` | `financial` | `percent` | Total Equity / Total Assets | $\ge 10\%$ (Green), $\ge 8\%$ (Amber), $< 8\%$ (Red) |
| `liquid_funds_ratio` | `financial` | `percent` | Liquid Assets / Total Assets | $\ge 15\%$ (Green), $\ge 10\%$ (Amber), $< 10\%$ (Red) |
| `operational_self_sufficiency`| `financial` | `percent` | Total Income / Total Operating Expenses | $\ge 110\%$ (Green), $\ge 100\%$ (Amber), $< 100\%$ (Red) |
| `net_interest_margin` | `financial` | `percent` | Financial spread / Total assets | None |
| `deposits_to_loans` | `financial` | `percent` | Total Member Deposits / Gross Loan Portfolio | None |

---

## 3. Non-Financial (NF) Indicators Mapping

Calculated using `NfIndicatorEngine` from raw tables: `members`, `savings_accounts`, `loans`, `fixed_deposits`, and `farm_coop`.

### 3.1 Membership Metrics (`kpi_type = 'non_financial'`)

| KPI Identifier (`kpi_name`) | Unit | Description |
| :--- | :--- | :--- |
| `membership_total` | `count` | Total registered members |
| `membership_active` | `count` | Active members |
| `membership_dormant` | `count` | Dormant members |
| `membership_exited` | `count` | Exited members |
| `membership_male` | `count` | Male members |
| `membership_female` | `count` | Female members |
| `membership_other` | `count` | Other gender members |
| `membership_under_18` | `count` | Members under 18 years old |
| `membership_age_18_35` | `count` | Members aged 18 to 35 |
| `membership_age_36_50` | `count` | Members aged 36 to 50 |
| `membership_over_50` | `count` | Members over 50 years old |
| `membership_urban` | `count` | Members in urban locations |
| `membership_rural` | `count` | Members in rural locations |
| `membership_agm_attendance` | `count` | Members attending the Annual General Meeting |
| `membership_leadership_count` | `count` | Members in leadership roles |
| `membership_voting_count` | `count` | Members exercising voting rights |
| `membership_active_pct` | `percent` | Percentage of active members |
| `membership_dormancy_pct` | `percent` | Percentage of dormant members |
| `membership_exit_pct` | `percent` | Percentage of exited members |
| `membership_male_pct` | `percent` | Percentage of male members |
| `membership_female_pct` | `percent` | Percentage of female members |
| `membership_other_pct` | `percent` | Percentage of other gender members |
| `membership_youth_pct` | `percent` | Percentage of youth members (<35 years) |
| `membership_adult_pct` | `percent` | Percentage of adult members (>=35 years) |
| `membership_urban_pct` | `percent` | Percentage of urban members |
| `membership_rural_pct` | `percent` | Percentage of rural members |
| `membership_agm_participation_pct`| `percent` | AGM Attendance rate |
| `membership_women_in_governance_pct`| `percent` | Share of women in leadership roles |
| `membership_youth_in_governance_pct`| `percent` | Share of youth in leadership roles |

### 3.2 Savings Metrics (`kpi_type = 'non_financial'`)

| KPI Identifier (`kpi_name`) | Unit | Description |
| :--- | :--- | :--- |
| `savings_total_accounts` | `count` | Total savings accounts |
| `savings_active_accounts` | `count` | Active savings accounts |
| `savings_dormant_accounts` | `count` | Dormant savings accounts |
| `savings_zero_balance_count` | `count` | Accounts with a zero balance |
| `savings_increasing_trend` | `count` | Accounts with increasing balance trend |
| `savings_stable_trend` | `count` | Accounts with stable balance trend |
| `savings_declining_trend` | `count` | Accounts with declining balance trend |
| `savings_high_withdrawal_count` | `count` | Accounts with high withdrawal frequency |
| `savings_emergency_withdrawal_count`| `count` | Accounts with emergency withdrawals |
| `savings_total_balance` | `currency` | Total savings balance |
| `savings_average_balance` | `currency` | Average savings account balance |
| `savings_penetration_pct` | `percent` | Share of members holding savings accounts |
| `savings_active_savers_pct` | `percent` | Active savers ratio |
| `savings_dormant_savings_pct` | `percent` | Dormant savings ratio |
| `savings_zero_balance_pct` | `percent` | Zero balance accounts percentage |
| `savings_increasing_trend_pct` | `percent` | Increasing balance ratio |
| `savings_regular_savers_pct` | `percent` | Regular savers ratio |

### 3.3 Credit/Loans Metrics (`kpi_type = 'non_financial'`)

| KPI Identifier (`kpi_name`) | Unit | Description |
| :--- | :--- | :--- |
| `loans_total_loans` | `count` | Total loans issued |
| `loans_active_loans` | `count` | Active/outstanding loans |
| `loans_performing` | `count` | Performing loans |
| `loans_arrears` | `count` | Loans in arrears |
| `loans_restructured` | `count` | Restructured loans |
| `loans_written_off` | `count` | Written-off loans |
| `loans_members_with_loans` | `count` | Number of members with loans |
| `loans_youth_borrowers` | `count` | Youth borrowers (<35 years) |
| `loans_women_borrowers` | `count` | Female borrowers |
| `loans_rural_borrowers` | `count` | Rural borrowers |
| `loans_multiple_loan_count` | `count` | Members with multiple active loans |
| `loans_large_borrower_count` | `count` | Large exposure borrowers count |
| `loans_total_balance` | `currency` | Total outstanding loan balance |
| `loans_total_loan_amount` | `currency` | Total disbursed loan amount |
| `loans_average_loan_size` | `currency` | Average loan size |
| `loans_on_time_repayment_pct` | `percent` | Repayments made on-time percentage |
| `loans_arrears_rate_pct` | `percent` | Portfolio arrears rate |
| `loans_restructured_pct` | `percent` | Restructured loans share |
| `loans_credit_penetration_pct` | `percent` | Share of members with active loans |
| `loans_youth_borrower_pct` | `percent` | Share of youth borrowers |
| `loans_women_borrower_pct` | `percent` | Share of female borrowers |
| `loans_rural_borrower_pct` | `percent` | Share of rural borrowers |

### 3.4 Fixed Deposits Metrics (`kpi_type = 'non_financial'`)

| KPI Identifier (`kpi_name`) | Unit | Description |
| :--- | :--- | :--- |
| `fds_total_fds` | `count` | Total fixed deposits accounts |
| `fds_active_fds` | `count` | Active fixed deposits |
| `fds_matured_fds` | `count` | Matured fixed deposits |
| `fds_withdrawn_fds` | `count` | Withdrawn fixed deposits |
| `fds_rolled_over_fds` | `count` | Rolled over fixed deposits |
| `fds_members_with_fds` | `count` | Members holding fixed deposits |
| `fds_early_withdrawal_count` | `count` | FDs withdrawn early |
| `fds_single_depositor_count` | `count` | Concentrated single depositors |
| `fds_total_balance` | `currency` | Total fixed deposits balance |
| `fds_average_balance` | `currency` | Average fixed deposit balance |
| `fds_fd_penetration_pct` | `percent` | FD member penetration rate |
| `fds_early_withdrawal_pct` | `percent` | Early withdrawal rate |
| `fds_rollover_rate_pct` | `percent` | Rollover loyalty rate |
| `fds_concentration_risk_pct` | `percent` | Single depositor dependency percentage |

### 3.5 Farm/Multi-Purpose Cooperative Metrics (`kpi_type = 'non_financial'`)

| KPI Identifier (`kpi_name`) | Unit | Description |
| :--- | :--- | :--- |
| `farm_total_coops` | `count` | Total farm cooperatives database entries |
| `farm_active_producers` | `count` | Cooperatives with active producers |
| `farm_using_planning` | `count` | Cooperatives using production planning |
| `farm_using_shared_inputs` | `count` | Cooperatives using shared inputs |
| `farm_with_offtake_agreement` | `count` | Cooperatives with formal offtake agreements |
| `farm_with_storage` | `count` | Cooperatives with storage facilities access |
| `farm_with_processing` | `count` | Cooperatives with processing facilities access |
| `farm_with_irrigation` | `count` | Cooperatives with irrigation access |
| `farm_with_climate_mitigation` | `count` | Cooperatives practicing climate mitigation |
| `farm_active_producer_pct` | `percent` | Active producer percentage |
| `farm_planning_adoption_pct` | `percent` | Production planning adoption rate |
| `farm_shared_services_pct` | `percent` | Shared inputs utilization rate |
| `farm_formal_offtake_pct` | `percent` | Offtake agreement coverage rate |
| `farm_storage_coverage_pct` | `percent` | Storage facilities access rate |
| `farm_processing_access_pct` | `percent` | Processing facilities access rate |
| `farm_irrigation_coverage_pct` | `percent` | Irrigation coverage rate |
| `farm_climate_mitigation_pct` | `percent` | Climate mitigation practices rate |
