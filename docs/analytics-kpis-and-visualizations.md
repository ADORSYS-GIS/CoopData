# Analytics KPIs & Visualizations – Detailed Documentation

> **Document Purpose:** A comprehensive reference of every KPI, stat, chart, and graph displayed on the analytics pages at each of the four organizational levels (Cooperative, Apex, Federation, Ministry).
>
> **Last Updated:** 2026-07-20

---

## Table of Contents

1. [Common Data Sources](#common-data-sources)
2. [Level 1: Cooperative Analytics](#level-1-cooperative-analytics)
3. [Level 2: Apex Analytics](#level-2-apex-analytics)
4. [Level 3: Federation Analytics](#level-3-federation-analytics)
5. [Level 4: Ministry Analytics](#level-4-ministry-analytics)
6. [Shared Components](#shared-components)
7. [Component Inventory](#component-inventory)

---

## Common Data Sources

All analytics views rely on these shared hooks:

| Hook | Purpose | Used By |
|---|---|---|
| `useLatestSubmission(reportingYear)` | Latest approved submission for a cooperative | Cooperative |
| `useCooperativeKpis(submissionId)` | KPI values (CAR, ROA, PAR30, etc.) for a submission | Cooperative, CooperativeDeepDive |
| `useMonthlyTrend(params)` | Month-over-month trend data (assets, savings, loans) | All levels |
| `useNfStatistics(...)` | Non-financial statistics (membership, savings, loans, fixed deposits, farm coops) | All levels |
| `useNationalOverview(params)` | Network overview with cooperatives array, distributions, totals | Apex, Federation, Ministry |
| `useMinistryStats()` | Ministry headline stats (total cooperatives, submissions, pending, approved) | Ministry |
| `useBenchmarks(params)` | Sector benchmark comparison data | Cooperative (imported) |

---

## Level 1: Cooperative Analytics

**Source File:** `frontend/src/pages/analytics/CooperativeAnalyticsView.tsx`

**Description:** Full analytics dashboard for a single cooperative. Shows KPIs from the cooperative's latest submission, NF stats, and monthly trends.

---

### 1.1 No Submission / No Data State

| Visual | Description |
|---|---|
| `Card` | "No Submission Data" — Shown when no submission exists. Info bubble: "Analytics are derived from your latest data submission. You must submit data to view these charts." |
| `Loader2` spinner | Shown while KPIs are loading. Text: "Loading financial KPIs…" |
| Yellow warning banner | Shown when submission is not yet approved. Text: "Submission pending approval — Full analytics are available after your submission is approved by the Apex." Contains `ShieldCheck` icon and amber border. |

---

### 1.2 KPI Scorecard

**Component:** `KpiScorecard`
**Source:** `frontend/src/components/analytics/KpiScorecard.tsx`

**Description:** A 3-column dense table displaying all financial KPIs from the submission. Each row shows the KPI name, formatted value, and a color-coded trend chip.

**Visual:** 3-column dense table within a bordered card. Each row:
- Left: KPI label (underscores replaced by spaces) + `Info` icon with popover showing `kpi.description`
- Right: Value + color-coded status chip (Healthy/Green, Watch/Amber, Risk/Red, Neutral)

**Sample KPIs listed:**
- `capital_adequacy_ratio` — Capital Adequacy Ratio
- `liquid_funds_ratio` — Liquid Funds Ratio
- `npl_ratio` — Non-Performing Loan Ratio
- `roa` — Return on Assets
- `roe` — Return on Equity
- `operating_expense_ratio` — Operating Expense Ratio
- `gross_loan_portfolio` — Gross Loan Portfolio
- `total_assets` — Total Assets
- `par30` — Portfolio at Risk (30 days)
- `loan_loss_coverage` — Loan Loss Coverage Ratio

---

### 1.3 Regulatory Compliance

**Component:** `ComplianceRadialGauges`
**Source:** `frontend/src/components/analytics/ComplianceRadialGauges.tsx`

**Info Popup:** "Monitors your cooperative's compliance with critical financial regulations. Capital Adequacy ensures sufficient equity against risk, Liquidity measures cash available for short-term obligations, and NPL tracks loan defaults."

| Gauge | Description | Target | Max Scale | Color Zones |
|---|---|---|---|---|
| **Capital Adequacy** (CAR) | Ensures sufficient equity to absorb losses | >15% | 30% | Green ≥15%, Amber 10-15%, Red <10% |
| **Liquidity** (LFR) | Measures cash available for short-term obligations | >20% | 100% | Green ≥25%, Amber 15-25%, Red <15% |
| **Non-Performing Loans** (NPL) | Tracks loans in default | <5% | 20% | Green ≤5%, Amber 5-10%, Red >10% |

**Visual:** 3 semi-circle (180°) radial gauges side by side. Each has a colored bar, centered value text, gauge name, and a target indicator line.

---

### 1.4 Savings Portfolio Health

**Component:** `SavingsRadialGauges`
**Source:** `frontend/src/components/analytics/SavingsRadialGauges.tsx`

**Info Popup:** "Analyzes the vitality of your savings base. Savings Penetration shows the percentage of members holding savings, Regular Savers tracks consistent monthly deposits, and Active Savers indicates recent deposit activity."

| Gauge | Description | Data Source |
|---|---|---|
| **Savings Penetration** | Percentage of members who hold savings accounts | `savings_penetration_pct` |
| **Regular Savers** | Members with consistent monthly deposits | `regular_savers_pct` |
| **Active Savers** | Members with deposits in the last 30 days | `active_savers_pct` |

**Visual:** 3 full-circle (360°) radial gauges. Below the gauges: "Total Savings Balance" with dollar amount (`$total_balance`).

---

### 1.5 Financial Trend

**Component:** `CoopTrendAreaChart`
**Source:** `frontend/src/components/analytics/CoopTrendAreaChart.tsx`

**Info Popup:** "Visualizes the month-over-month trajectory of your cooperative's core financial balances (Assets, Savings, and Loans) over the current reporting period."

| Line | Description | Color |
|---|---|---|
| **Liquid Assets** | Total liquid assets (cash, investments) month-over-month | Chart-1 (teal) |
| **Member Deposits** | Total member savings balances | Chart-2 (blue) |
| **Gross Loans** | Total outstanding loan balances | Chart-3 (indigo) |

**Visual:** Recharts `AreaChart` (300px height). 3 gradient-filled areas with legend below. Y-axis in $K. Shows "No historical trend data available yet" if all values are zero.

**Data Source:** `trendData` from `useMonthlyTrend()` — maps `assets` → `liquidity`, `savings`, `loans`

---

### 1.6 Loan Provisioning Gap

**Component:** `LoanProvisioningWaterfall`
**Source:** `frontend/src/components/analytics/LoanProvisioningWaterfall.tsx`

**Info Popup:** "A waterfall breakdown of your gross loan portfolio. It highlights 'At-Risk Capital' by subtracting your loan loss provisions from your non-performing loans (arrears), showing potential unprotected losses."

| Bar | Description | Calculation |
|---|---|---|
| **Gross Portfolio** | Total gross loan portfolio | `gross_loan_portfolio` |
| **Performing** | Performing loans (GLP minus PAR30) | `GLP - (GLP × PAR30%)` |
| **Provisions** | Loan loss provisions set aside | `GLP × provisions_pct` |
| **At-Risk Capital** | Unprotected non-performing exposure | `(GLP × PAR30%) - (GLP × provisions_pct)` |

**Visual:** Recharts `BarChart` (waterfall style, 250px). 4 stacked bars with color coding. Y-axis in $K/$M. Shows "No data available" if GLP is 0.

---

### 1.7 Liquidity Risk

**Component:** `DepositConcentrationGauge`
**Source:** `frontend/src/components/analytics/DepositConcentrationGauge.tsx`

**Info Popup:** "Assesses liquidity risk by examining the concentration of fixed (term) deposits. High concentration in a few accounts or short-term maturities can pose withdrawal risks."

**Visual:** Recharts `PieChart` (semi-circle, 180°). Two cells:
- "Top 5% Depositors" — colored by risk level (green <30%, amber 30-60%, red >60%)
- "Other Depositors" — neutral/muted color
- Center shows `concentration_risk_pct` percentage with "Concentration Risk" label
- Below: explanatory text about top 5% deposit dominance

**Data Source:** `nfStats.fixed_deposits` (FixedDepositStats), uses `concentration_risk_pct`

---

### 1.8 Democratic Engagement

**Component:** `GovernanceFunnel`
**Source:** `frontend/src/components/analytics/GovernanceFunnel.tsx`

**Info Popup:** "Measures the democratic health of the cooperative by tracking member participation in governance activities, such as voting in the Annual General Meeting (AGM)."

| Funnel Level | Description | Data Source |
|---|---|---|
| **Total Members** | Top of funnel — all registered members | `total` |
| **Attended AGM** | Members who attended the Annual General Meeting | `agm_attendance` |
| **Voted in Elections** | Members who exercised voting rights | `voting_count` |
| **Leadership Role** | Members in governance roles (board, committees) | `leadership_count` |

**Visual:** Recharts `FunnelChart` (250px). 4 trapezoidal levels decreasing in width. Each level shows label on right and count in white centered text. Color-coded from teal (top) through indigo (bottom).

---

### 1.9 Financial Inclusion

**Component:** `FinancialInclusionBar`
**Source:** `frontend/src/components/analytics/FinancialInclusionBar.tsx`

**Info Popup:** "Tracks the distribution of credit access across key demographics (e.g., Women, Youth) to ensure the cooperative is fulfilling its inclusive mandate."

| Bar | Description | Data Source |
|---|---|---|
| **Women** | Percentage of loans issued to women | `women_borrower_pct` |
| **Youth (<35)** | Percentage of loans issued to members under 35 | `youth_borrower_pct` |
| **Rural** | Percentage of loans issued to rural members | `rural_borrower_pct` |

**Visual:** Recharts `BarChart` (250px, horizontal layout). 3 bars with percentage labels on the right. X-axis: 0-100%. Tooltip shows "Inclusion Share".

---

### 1.10 Membership Overview Grid

**Component:** `MetricsGridCards`
**Source:** `frontend/src/components/analytics/MetricsGridCards.tsx`

Four grid cards showing membership metrics. Each card has a label, value, trend arrow, and `Info` popover tooltip.

| Card | Value | Tooltip |
|---|---|---|
| **Total Members** | `total` (number) | "Total number of registered cooperative members" |
| **Active Members** | `active` (number) | "Members with transactions in the last 90 days" |
| **Dormant Members** | `dormant` (number) | "Members with no transactions in the last 90 days" |
| **Youth Members** | `age_18_35` (number) | "Members under 35 years old" |

---

### 1.11 Savings Portfolio Metrics Grid

| Card | Value | Tooltip |
|---|---|---|
| **Savings Accounts** | `total_accounts` (number) | "Total number of active savings accounts" |
| **Total Savings** | `total_balance` ($K formatted) | "Total balance across all savings accounts" |
| **Active Savers** | `active_accounts` (number) | "Members with deposits in the last 30 days" |
| **Regular Savers** | `regular_savers_pct` (%) | "Percentage of members with consistent monthly deposits" |

---

### 1.12 Loan Portfolio Metrics Grid

| Card | Value | Tooltip |
|---|---|---|
| **Loan Accounts** | `total_loans` (number) | "Total number of active loan accounts" |
| **Total Loans** | `total_loan_amount` ($K formatted) | "Total outstanding loan balance" |
| **Loans in Arrears** | `arrears` (number) | "Number of loans with payments overdue by 30+ days" |
| **On-time Repayment** | `on_time_repayment_pct` (%) | "Percentage of loans repaid on schedule" |

---

### 1.13 Fixed Deposit Metrics Grid

| Card | Value | Tooltip |
|---|---|---|
| **FD Accounts** | `total_fds` (number) | "Total number of active fixed deposit accounts" |
| **Total FD Balance** | `total_balance` ($K formatted) | "Total balance across all fixed deposits" |
| **FD Penetration** | `fd_penetration_pct` (%) | "Percentage of members with fixed deposits" |
| **Rollover Rate** | `rollover_rate_pct` (%) | "Percentage of matured FDs rolled over" |

---

### 1.14 Loan Portfolio Breakdown

**Component:** `LoanDualBar`
**Source:** `frontend/src/components/analytics/LoanDualBar.tsx`

**Info Popup:** "A detailed breakdown of active loans, comparing performing loans (on-time) against loans in arrears (delayed payments), categorized by demographics."

| Chart | Bars |
|---|---|
| **Accounts Count** | Total, Active, Arrears, Restructured (counts) |
| **Value Amount ($K)** | Total, Outstanding, Arrears ($K amounts) |

**Visual:** Two side-by-side `BarChart` (grid-cols-2). Each has a legend. Shows the breakdown of loan accounts by count and by dollar value.

---

### 1.15 Membership Demographics

**Component:** `GenderStatusDoughnuts`
**Source:** `frontend/src/components/analytics/GenderStatusDoughnuts.tsx`

**Info Popup:** "Visualizes the demographic makeup of your member base, including gender ratios and the proportion of active versus dormant accounts."

| Doughnut | Segments |
|---|---|
| **Gender Breakdown** | Women (pink), Men (blue), Other (gray) |
| **Membership Status** | Active (green/success), Dormant (amber/warning), Exited (neutral/muted) |

**Visual:** Two side-by-side doughnut charts (grid-cols-2). Each has inner radius 50%, outer radius 70%, center shows total count. Below each: legend with percentage per slice.

---

### 1.16 Member Engagement Indicators

**Component:** `DormancyLeaderboard`
**Source:** `frontend/src/components/analytics/DormancyLeaderboard.tsx`

**Info Popup:** "A leaderboard showing the highest rates of member dormancy, helping identify areas where member re-engagement efforts are needed."

**Visual:** Recharts `BarChart` (horizontal layout). Single bar for "My Cooperative" colored by dormancy level:
- Green: <10% (Healthy)
- Amber: 10–20% (Watch)
- Red: >20% (Critical)

Tooltip shows dormancy%, total members, and active%.

---

### 1.17 Agricultural Resilience

**Component:** `AgriResilienceRadar`
**Source:** `frontend/src/components/analytics/AgriResilienceRadar.tsx`

**Info Popup:** "A radar analysis evaluating the cooperative's agricultural infrastructure, including storage capacity, processing facilities, and mechanization levels."

| Axis | Description |
|---|---|
| **Planning** | Agricultural planning adoption |
| **Shared Inputs** | Shared input utilization |
| **Formal Off-take** | Formal off-take agreements in place |
| **Storage** | Storage facility coverage |
| **Processing** | Processing facility access |
| **Irrigation** | Irrigation system coverage |
| **Climate Mitigation** | Climate resilience measures |

**Visual:** Recharts `RadarChart` (300px, 7-axis). Single radar area with 40% opacity. Shown only when `farm_coop.total_coops > 0`.

---

## Level 2: Apex Analytics

**Source File:** `frontend/src/pages/analytics/ApexAnalyticsView.tsx`

**Description:** Analytics dashboard for an Apex administrator. Shows consolidated network statistics with scatter plot, radar chart, leaderboard, and traffic-light compliance distribution. Supports filtering by individual cooperative for deep-dive.

### 2.1 Network Consolidated Metrics

**Component:** `NetworkConsolidatedMetrics`
**Source:** `frontend/src/components/analytics/NetworkConsolidatedMetrics.tsx`

This is the main shared component used across Apex, Federation, and Ministry levels. It displays:

#### 2.1.1 KPI Scorecard Row

| Card | Value | Tooltip |
|---|---|---|
| **Total Cooperatives** | `cooperativesWithData` | "Cooperatives that have successfully submitted and had their data approved for this reporting year." |
| **Total Members** | `membership.total` | "Total registered members across the network." |
| **Total Savings** | `savings.total_balance` ($K) | "Aggregate savings deposits held by all cooperatives." |
| **Total Loans** | `loans.total_loan_amount` ($K) | "Aggregate outstanding loan portfolio across all cooperatives." |

#### 2.1.2 Network Financial Trend
Same `CoopTrendAreaChart` as Cooperative level, but with network-aggregated data.

**Info Popup:** "Visualizes the month-over-month trajectory of the network's aggregated financial balances over the current reporting period."

#### 2.1.3 Network Savings Portfolio Health
Same `SavingsRadialGauges` as Cooperative level.

**Info Popup:** "Analyzes the vitality of the aggregated savings base. Savings Penetration shows the percentage of members holding savings, Regular Savers tracks consistent monthly deposits, and Active Savers indicates recent deposit activity."

#### 2.1.4 Membership Grid (4 cards)
Same structure as Cooperative level: Total Members, Active Members, Dormant Members, Youth Members — but with network-aggregate data.

#### 2.1.5 Savings Grid (4 cards)
Same: Savings Accounts, Total Savings, Active Savers, Regular Savers — network aggregate.

#### 2.1.6 Loan Grid (4 cards)
Same: Loan Accounts, Total Loans, Loans in Arrears, On-time Repayment — network aggregate.

#### 2.1.7 Loan Portfolio Breakdown
Same `LoanDualBar` — network aggregate.

**Info Popup:** "A detailed breakdown of active loans across the network, comparing performing loans against loans in arrears, categorized by demographics."

#### 2.1.8 Fixed Deposit Grid (4 cards)
Same: FD Accounts, Total FD Balance, FD Penetration, Rollover Rate — network aggregate.

#### 2.1.9 Network Liquidity Risk
Same `DepositConcentrationGauge` — network aggregate.

**Info Popup:** "Assesses aggregate liquidity risk by examining the concentration of fixed (term) deposits across the network."

#### 2.1.10 Network Governance
Same `GovernanceFunnel` — network aggregate.

**Info Popup:** "Measures the democratic health of the network by tracking aggregate member participation in governance activities."

#### 2.1.11 Financial Inclusion
Same `FinancialInclusionBar` — network aggregate.

**Info Popup:** "Tracks the distribution of credit access across key demographics to ensure the network is fulfilling its inclusive mandate."

#### 2.1.12 Network Demographics
Same `GenderStatusDoughnuts` — network aggregate.

**Info Popup:** "Visualizes the demographic makeup of the entire member base, including gender ratios and the proportion of active versus dormant accounts."

#### 2.1.13 Age & Geography Breakdown
**Component:** `AgeDemographicsChart`
**Source:** `frontend/src/components/analytics/AgeDemographicsChart.tsx`

**Info Popup:** "Visualizes the distribution of members across various age groups and their geographic dispersion (Urban vs. Rural)."

| Doughnut | Segments |
|---|---|
| **Age Distribution** | <18, 18-35, 36-50, 50+ |
| **Geographic Distribution** | Urban, Rural |

**Visual:** Two side-by-side doughnut charts with legend. Each segment labeled with percentage.

---

### 2.2 Risk vs Return Profile

**Component:** `CoopScatterPlot`
**Source:** `frontend/src/components/analytics/CoopScatterPlot.tsx`

**Info Popup:** "A scatter plot mapping the risk (Non-Performing Loans ratio) against the return (Return on Assets) for each cooperative in the network."

| Axis | Description | Source KPI |
|---|---|---|
| **X-axis: Risk (NPL Ratio)** | Higher = riskier | `npl_ratio` |
| **Y-axis: Return (ROA)** | Higher = more profitable | `roa` |
| **Bubble Size** | Total Assets | `total_assets` |

**Visual:** Recharts `ScatterChart` (300px). Green dots for NPL ≤5%, red dots for NPL >5%. Reference lines: NPL Target at 5% (red dashed), ROA = 0 line. Custom tooltip shows cooperative name, ROA%, and NPL%.

---

### 2.3 Network Comparative Performance

**Component:** `ApexRadarChart`
**Source:** `frontend/src/components/analytics/ApexRadarChart.tsx`

**Info Popup:** "A radar chart visualizing average performance across multiple dimensions including Management Efficiency, Asset Quality, and Capital Adequacy."

| Axis | Description |
|---|---|
| **Liquidity** | Liquid Funds Ratio (target: 30%) |
| **Asset Quality** | 100% - NPL Ratio (inverse) |
| **Earnings/ROA** | Return on Assets (target: 5%) |
| **Capital Adequacy** | CAR (target: 15%) |
| **Mgmt Efficiency** | Management efficiency score |

**Visual:** Recharts `RadarChart` (300px, 5-axis). Two radar areas: "This Network" (primary, 60% opacity) and "Sector Average" (secondary, 30% opacity).

---

### 2.4 NPL Leaderboard

**Component:** `TopBottomLeaderboard`
**Source:** `frontend/src/components/analytics/TopBottomLeaderboard.tsx`

**Info Popup:** "Highlights the cooperatives with the best and worst Non-Performing Loan ratios to identify excellence and areas requiring intervention."

**Sort:** `npl_ratio` (ascending — lower is better)

| Column | Top 5 Performers | Bottom 5 (Watch List) |
|---|---|---|
| Header color | Green (`success`) | Red (`danger`) |
| Icon | `ShieldCheck` | `Target` |
| Rows | Rank, cooperative name, region/sector, NPL formatted, CAR value, traffic-light dot | Same |

---

### 2.5 Traffic Light Distribution

**Component:** `ComplianceDoughnutCharts`
**Source:** `frontend/src/components/analytics/ComplianceDoughnutCharts.tsx`

**Info Popup:** "Shows the distribution of cooperatives falling into Healthy (Green), Watch (Amber), and Risk (Red) categories for various key performance indicators."

| KPIs Tracked | Segments |
|---|---|
| **PAR30** (Portfolio at Risk), **CAR** (Capital Adequacy), **ROA** (Return on Assets), **NPL** (Non-Performing Loans) | Healthy (Green), Watch (Amber), Risk (Red) |

**Visual:** Grid of 4 doughnut charts (grid-cols-2 md:grid-cols-4). Center of each doughnut shows total cooperative count. Legend above. Tooltip: "{count} coops ({percent}%)".

---

### 2.6 Cooperative Deep Dive

**Component:** `CooperativeDeepDive`
**Source:** `frontend/src/components/analytics/CooperativeDeepDive.tsx`

**Description:** Full detail view for a single cooperative selected from the network overview. Shows all charts from the Cooperative level (see [Level 1](#level-1-cooperative-analytics)) in a common component reusable across Apex, Federation, and Ministry views.

| Chart | Info |
|---|---|
| Regulatory Compliance (Radial Gauges) | "Monitors the cooperative's compliance with critical financial regulations..." |
| Financial Trend (Area Chart) | "Visualizes the month-over-month trajectory of the cooperative's core financial balances." |
| Loan Provisioning Gap (Waterfall) | "A waterfall breakdown of the gross loan portfolio..." |
| Membership Demographics (Doughnuts) | "Visualizes the demographic makeup of the member base..." |
| Liquidity Risk (Pie Chart) | "Assesses liquidity risk by examining the concentration of fixed (term) deposits..." |
| Democratic Engagement (Funnel) | "Measures the democratic health of the cooperative..." |
| Financial Inclusion (Bar Chart) | "Tracks the distribution of credit access across key demographics..." |
| Agricultural Resilience (Radar) | "A radar analysis evaluating the cooperative's agricultural infrastructure..." |

---

## Level 3: Federation Analytics

**Source File:** `frontend/src/pages/analytics/FederationAnalyticsView.tsx`

**Description:** Analytics dashboard for a Federation administrator. Shows consolidated network statistics with regional distribution, leaderboards (by OER and ROA), radar, waterfall, and compliance distribution. Supports filtering by apex or cooperative.

### 3.1 Network Consolidated Metrics

Same as [Section 2.1](#21-network-consolidated-metrics) above (identical component shared across Apex, Federation, and Ministry).

### 3.2 Regional Portfolio Distribution

**Component:** `RegionalGroupedBar`
**Source:** `frontend/src/components/analytics/RegionalGroupedBar.tsx`

**Info Popup:** "Displays the aggregate financial balances distributed across different geographical regions."

| Bar Group | Description |
|---|---|
| **Assets** | Total assets aggregated by region |
| **Loans** | Gross loan portfolio by region |
| **Deposits** | Total member deposits by region |

**Visual:** Recharts `BarChart` (h-72). Grouped bars per region. Values converted to $K. Legend at bottom.

---

### 3.3 Operational Efficiency (OER) Leaderboard

**Component:** `TopBottomLeaderboard`
**Sort KPI:** `operating_expense_ratio` (ascending — lower OER = more efficient)

**Info Popup:** "Highlights the cooperatives with the best and worst Operational Expense Ratios to identify excellence and areas requiring intervention."

---

### 3.4 Profitability (ROA) Leaderboard

**Component:** `TopBottomLeaderboard`
**Sort KPI:** `roa` (higher is better)

**Info Popup:** "Highlights the cooperatives with the highest and lowest Return on Assets, indicating overall profitability and resource utilization."

---

### 3.5 Network Performance Radar

Same `ApexRadarChart` as [Section 2.3](#23-network-comparative-performance).

**Info Popup:** "A radar chart visualizing average performance across multiple dimensions including Management Efficiency, Asset Quality, and Capital Adequacy."

---

### 3.6 Network Loan Provisioning Gap

Same `LoanProvisioningWaterfall` as [Section 1.6](#16-loan-provisioning-gap), but with network-aggregated weighted averages.

**Info Popup:** "Visualizes the gap between the Gross Loan Portfolio, the Portfolio at Risk (PAR30), and the actual Loan Loss Provisions set aside to cover those risks."

---

### 3.7 Compliance Traffic-Light Distribution

Same `ComplianceDoughnutCharts` as [Section 2.5](#25-traffic-light-distribution).

**Info Popup:** "Shows the distribution of cooperatives falling into Healthy (Green), Watch (Amber), and Risk (Red) categories for various key performance indicators."

---

## Level 4: Ministry Analytics

**Source File:** `frontend/src/pages/analytics/MinistryAnalyticsView.tsx`

**Description:** National analytics dashboard for Ministry administrators. Shows macro portfolio distribution, national demographics, compliance distribution, and the full non-financial indicator consolidation panel.

### 4.1 Ministry Headline Stats

**Unique to Ministry Level.** Inline stat cards with `Info` popover tooltips.

| Card | Tooltip |
|---|---|
| **Total Cooperatives** | "Total number of registered cooperatives in the national cooperative registry." |
| **Total Submissions** | "Total number of data submissions received from all cooperatives across the country." |
| **Pending Review** | "Submissions currently awaiting review and approval by authorized personnel." |
| **Approved** | "Submissions that have been successfully reviewed and approved this reporting period." |

**Visual:** 4-column grid (grid-cols-2 md:grid-cols-4). Each card has label (uppercase, tracking-wider), value (2xl bold), and `Info` icon with popover tooltip.

---

### 4.2 Network Consolidated Metrics

Same as [Section 2.1](#21-network-consolidated-metrics).

---

### 4.3 National Portfolio Distribution

Same `RegionalGroupedBar` as [Section 3.2](#32-regional-portfolio-distribution).

**Info Popup:** "Displays the aggregate financial balances distributed across different geographical regions."

---

### 4.4 National Loan Provisioning Gap

Same `LoanProvisioningWaterfall` with national-aggregate data.

**Info Popup:** "Visualizes the gap between the Gross Loan Portfolio, the Portfolio at Risk (PAR30), and the actual Loan Loss Provisions set aside to cover those risks."

---

### 4.5 ROA Leaderboard

**Component:** `TopBottomLeaderboard`
**Sort KPI:** `roa`

**Info Popup:** "Highlights the cooperatives with the highest and lowest Return on Assets, indicating overall profitability and resource utilization."

---

### 4.6 CAR Leaderboard

**Component:** `TopBottomLeaderboard`
**Sort KPI:** `capital_adequacy_ratio`

**Info Popup:** "Highlights the cooperatives with the highest and lowest Capital Adequacy Ratios, ensuring they maintain sufficient capital to absorb potential losses."

---

### 4.7 National KPI Traffic-Light Distribution

Same `ComplianceDoughnutCharts` as [Section 2.5](#25-traffic-light-distribution).

**Info Popup:** "Shows the distribution of cooperatives falling into Healthy (Green), Watch (Amber), and Risk (Red) categories for various key performance indicators."

---

### 4.8 Non-Financial Indicator Consolidation

**Component:** `NonFinancialConsolidation`
**Source:** `frontend/src/components/analytics/non-financial-consolidation.tsx`

**Description:** Dynamic indicator consolidation panel unique to the Ministry level. Allows selecting any non-financial indicator from the catalog to view aggregated statistics across all cooperatives.

#### 4.8.1 Indicator Selector
- Dropdown (`Select`) with catalog items showing `display_name (data_type)`
- Empty state: `HelpCircle` icon with "No Indicator Selected"

#### 4.8.2 Aggregated KPI Cards (3 columns)

| Card | Icon | Tone | Description |
|---|---|---|---|
| **Consolidated Total Sum** | `BarChart3` | primary | Sum of all numeric inputs for the selected indicator |
| **Consolidated Average** | `Landmark` | success | Average value across reporting cooperatives |
| **Reporting Cooperatives** | `Users` | accent | Count of cooperatives that submitted data for this indicator |

#### 4.8.3 Breakdown by Region
`BarChart` with two bars: "Total Sum" (blue) and "Average" (green), grouped by region.

#### 4.8.4 Breakdown by Cooperative Type
`PieChart` showing distribution of total_sum by cooperative type (`institution_type`). Each slice labeled with name and percentage.

---

## Shared Components

### MetricsGridCards
**Source:** `frontend/src/components/analytics/MetricsGridCards.tsx`

**Usage:** Cooperative, NetworkConsolidatedMetrics (Apex/Federation/Ministry)

**Visual:** Responsive grid (2/3/4 columns) of metric cards. Each card has:
- Label (uppercase, tracking-wider) + `Info` icon with `Popover` tooltip
- Value (2xl bold)
- Optional trend arrow with value

### KpiScorecard
**Source:** `frontend/src/components/analytics/KpiScorecard.tsx`

**Usage:** Cooperative, NetworkConsolidatedMetrics (Apex/Federation/Ministry)

**Visual:** 3-column dense table. Each row:
- KPI label + `Info` icon with popover
- Value + color-coded status chip (Healthy/Green, Watch/Amber, Risk/Red, Neutral)

### NetworkConsolidatedMetrics
**Source:** `frontend/src/components/analytics/NetworkConsolidatedMetrics.tsx`

**Usage:** Apex, Federation, Ministry

**Composite component containing:** KpiScorecard, CoopTrendAreaChart, SavingsRadialGauges, MetricsGridCards (membership, savings, loans, fixed deposits), LoanDualBar, DepositConcentrationGauge, GovernanceFunnel, FinancialInclusionBar, GenderStatusDoughnuts, AgeDemographicsChart

### CooperativeDeepDive
**Source:** `frontend/src/components/analytics/CooperativeDeepDive.tsx`

**Usage:** Apex, Federation, Ministry (when single cooperative selected)

**Composite component containing:** ComplianceRadialGauges, CoopTrendAreaChart, LoanProvisioningWaterfall, GenderStatusDoughnuts, DepositConcentrationGauge, GovernanceFunnel, FinancialInclusionBar, AgriResilienceRadar

### StatCard
**Source:** `frontend/src/components/app-shell.tsx` (shared)

**Usage:** Home dashboards, NonFinancialConsolidation

**Visual:** Single stat card with icon watermark, label, value, subtitle, tone-colored accent, and optional `info` popover tooltip.

---

## Component Inventory

### Chart Components

| Component | Chart Type | Used By |
|---|---|---|
| `ComplianceRadialGauges` | RadialBar (semi-circle) | Cooperative, CooperativeDeepDive |
| `SavingsRadialGauges` | RadialBar (full circle) | Cooperative, NetworkConsolidatedMetrics |
| `CoopTrendAreaChart` | AreaChart | Cooperative, CooperativeDeepDive, NetworkConsolidatedMetrics |
| `LoanProvisioningWaterfall` | BarChart (waterfall) | Cooperative, CooperativeDeepDive, Federation, Ministry |
| `DepositConcentrationGauge` | PieChart (semi-circle) | Cooperative, CooperativeDeepDive, NetworkConsolidatedMetrics |
| `GovernanceFunnel` | FunnelChart | Cooperative, CooperativeDeepDive, NetworkConsolidatedMetrics |
| `FinancialInclusionBar` | BarChart (horizontal) | Cooperative, CooperativeDeepDive, NetworkConsolidatedMetrics |
| `LoanDualBar` | BarChart (dual) | Cooperative, NetworkConsolidatedMetrics |
| `GenderStatusDoughnuts` | PieChart (doughnut x2) | Cooperative, CooperativeDeepDive, NetworkConsolidatedMetrics |
| `DormancyLeaderboard` | BarChart (horizontal) | Cooperative |
| `AgriResilienceRadar` | RadarChart | Cooperative, CooperativeDeepDive |
| `CoopScatterPlot` | ScatterChart | Apex |
| `ApexRadarChart` | RadarChart | Apex, Federation |
| `TopBottomLeaderboard` | Custom list | Apex, Federation, Ministry |
| `ComplianceDoughnutCharts` | PieChart (doughnut x4) | Apex, Federation, Ministry |
| `RegionalGroupedBar` | BarChart (grouped) | Federation, Ministry |
| `AgeDemographicsChart` | PieChart (doughnut x2) | NetworkConsolidatedMetrics |
| `NonFinancialConsolidation` | BarChart + PieChart | Ministry |

### Stat/Metrics Components

| Component | Used By |
|---|---|
| `MetricsGridCards` | Cooperative, NetworkConsolidatedMetrics |
| `KpiScorecard` | Cooperative, NetworkConsolidatedMetrics |
| `NetworkConsolidatedMetrics` | Apex, Federation, Ministry |
| `CooperativeDeepDive` | Apex, Federation, Ministry |
| `StatCard` | Home dashboards, NonFinancialConsolidation |

---

## Summary: Total Visualizations per Level

| Level | Distinct Visualizations | Unique Charts |
|---|---|---|
| **Cooperative** | 22 | 17 chart/graph instances + 5 metrics grids |
| **Apex** | 24 | NetworkConsolidatedMetrics (13 components) + Scatter + Radar + Leaderboard + 4 Doughnuts + DeepDive |
| **Federation** | 24 | NetworkConsolidatedMetrics (13 components) + Regional Bar + 2 Leaderboards + Radar + Waterfall + 4 Doughnuts + DeepDive |
| **Ministry** | 27 | Headline Stats (4 cards) + NetworkConsolidatedMetrics (13 components) + Regional Bar + Waterfall + 2 Leaderboards + 4 Doughnuts + NonFinancialConsolidation + DeepDive |
