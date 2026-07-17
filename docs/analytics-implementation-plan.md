# Hierarchical Analytics & Dashboard Implementation Plan

## 1. Objective
To design and implement a highly professional, hierarchical Analytics Page for the CoopData system. This document outlines all available Key Performance Indicators (KPIs) sourced from both financial statements and non-financial data (Excel templates), and details how they will be displayed using rich UI components across four distinct organizational tiers: Ministry, Federation, Apex, and Cooperative.

---

## 2. Comprehensive KPI Dictionary

### 2.1 Financial KPIs (Derived from Balance Sheet)
1. **Total Assets**: Gross value of all assets.
2. **Gross Loan Portfolio (GLP)**: Total value of outstanding loans.
3. **Net Loan Portfolio**: GLP minus loan loss provisions.
4. **Total Member Deposits**: Total savings held for members.
5. **Total Equity**: Total cooperative net worth.
6. **PAR30**: Portfolio at Risk (>30 days).
7. **PAR90 / NPL Ratio**: Non-Performing Loans ratio.
8. **Loan Loss Coverage**: Provisions as a percentage of PAR30.
9. **ROA (Return on Assets)**: Net surplus / Total Assets.
10. **ROE (Return on Equity)**: Net surplus / Total Equity.
11. **Operating Expense Ratio**: Operating expenses / Total Assets.
12. **Capital Adequacy Ratio**: Total Equity / Total Assets.
13. **Liquid Funds Ratio**: Liquid Assets / Total Assets.
14. **Operational Self-Sufficiency**: Total Income / Total Expenses.
15. **Net Interest Margin**: Net interest income / Total Assets.
16. **Deposits to Loans**: Total Deposits / GLP.

### 2.2 Non-Financial KPIs (Derived from Excel Upload Pipeline)
Based on the `docs/ticket-3-non-financial-data.md` Excel mappings:

**Membership Metrics**
17. Total Members
18. Membership Growth Rate
19. Dormancy Rate
20. Exit Rate
21. Active Members Ratio
22. AGM Participation Rate
23. Demographics: Women / Youth / Rural Members %
24. Governance: Women / Youth in Leadership %

**Savings Metrics**
25. Savings Penetration (% of members with savings)
26. Active Savers Ratio
27. Dormant / Zero Balance Accounts %
28. Stable Balance Ratio
29. High / Emergency Withdrawal Incidence
30. Average Interest Rate & Account Concentration

**Loan Metrics**
31. Credit Penetration (% of members with loans)
32. On-Time Repayment Ratio
33. Loans in Arrears Percent
34. Restructured Loans Ratio
35. Demographics of Borrowers (Women/Youth/Rural)
36. Average Loan Size & Loans per Member

**Fixed Deposit (FD) Metrics**
37. FD Penetration & Long-Term Ratio
38. FD Rollover Rate
39. Early Withdrawal Rate
40. FD Concentration Risk

---

## 3. UI/UX Design by Hierarchical Tier

We will implement 4 distinct dashboard views. **Crucially, the charts and layout will differ based on the persona's focus.**

### 3.1 Ministry Level (Macro & Systemic View)
- **Primary Focus**: National stability, geographic distribution, sector-wide compliance.
- **Top Grid Cards**: Total Registered Cooperatives, National GLP, National Total Assets, Systemic NPL Ratio, National Liquidity Ratio.
- **Charts**:
  - **Grouped Bar Chart / Map**: Cooperatives & Assets by Region (Hhohho, Lubombo, Manzini, Shiselweni).
  - **Stacked Area Chart**: National Liquidity & Capital Growth over Time.
  - **Stacked Bar Chart**: Loan Portfolio Quality Breakdown (Performing vs. PAR30 vs. NPL) nationwide.
  - **Doughnut Chart**: National Member Demographic Breakdown (Youth vs. Women vs. Men).
- **Filtering**: By Federation, by Region, Year, Quarter.

### 3.2 Federation Level (Regional/Apex View)
- **Primary Focus**: Comparative performance of Apexes, aggregate health.
- **Top Grid Cards**: Total Apexes Managed, Total Underlying Members, Aggregate Deposits, Average ROA, Network Dormancy Rate.
- **Charts**:
  - **Radar Chart**: Apex Comparative Performance (Liquidity, Asset Quality, Earnings, Capital).
  - **Dual-Axis Line Chart**: Savings Growth vs. Loan Growth trajectory across Apexes.
  - **Horizontal Bar Chart**: Leaderboard - Top 5 and Bottom 5 Apexes by PAR30.
  - **Pie Chart**: Savings volume concentration across Apexes.
- **Filtering**: By Apex, Region, Year.

### 3.3 Apex Level (Cooperative Supervision View)
- **Primary Focus**: Direct cooperative supervision, identifying high-risk coops, operational sustainability.
- **Top Grid Cards**: Total Coops Managed, Aggregate Network Loans, Avg Operational Self-Sufficiency, High-Risk Coops Count (NPL > 5%).
- **Charts**:
  - **Scatter Plot**: Cooperative Risk vs. Return (Y-Axis: ROA, X-Axis: NPL Ratio). *Instantly highlights outliers.*
  - **Histogram / Bar Chart**: Cooperative Capital Adequacy Distribution.
  - **Line Chart**: Month-over-Month Membership Growth for the network.
  - **Doughnut Chart**: Loan Product Distribution (e.g., Agricultural vs. Commercial vs. Personal).
- **Filtering**: By Cooperative, Cooperative Size (Assets), Year.

### 3.4 Cooperative Level (Operational Health View)
- **Primary Focus**: Internal operations, target compliance, peer benchmarking.
- **Top Grid Cards**: Member Count, GLP, PAR30, Liquid Funds Ratio, ROE.
- **Charts**:
  - **Radial Bar Gauges**: Regulatory Compliance Gauges comparing current Capital Adequacy, Liquidity, and PAR to statutory thresholds.
  - **Composed Chart (Line + Bar)**: 12-Month Financial Trend (Income bars vs. Expense line).
  - **Pie Chart**: Internal Member Age & Gender Demographics.
  - **Stacked Area Chart**: Savings Portfolio (Voluntary vs. Mandatory vs. Fixed).
- **Filtering**: Year, Quarter.

---

## 4. Implementation Strategy & Architecture

### 4.1 Frontend Optimal Rendering
1. **Component Modularity**: Use `recharts` for rendering. Create a shared `<ChartCard>` UI wrapper to handle titles, legends, export options (download chart as PNG), and empty/loading states.
2. **State Management**: Use `TanStack Query` (`@tanstack/react-query`) to fetch and cache data.
3. **Data Transformation**: Build pure functions in `src/lib/chart-transformers.ts` to convert backend API responses into standard Recharts arrays (e.g., `[{ name: 'Jan', value: 400 }]`).
4. **Dynamic Resizing**: Wrap all charts in `<ResponsiveContainer>` to ensure grid fluid layouts.

### 4.2 Backend Optimal Data Delivery
1. **Aggregation Handlers**: The API must support grouping for the charts.
   - Endpoint example: `/api/v1/analytics/federation/distribution?group_by=apex`
   - Endpoint example: `/api/v1/analytics/ministry/trend?interval=monthly`
2. **Caching**: Because macro-level data (Ministry/Federation) aggregates thousands of records, we will implement caching using the `AppState` cache mechanisms or materialized views, expiring when new submissions are approved.
3. **KpiEngine Extensions**: Ensure `KpiEngine::compute()` dynamically aggregates the non-financial table inputs (Members, Loans, etc.) into the final `ComputedKpiSet`.

## 5. Next Steps
1. Revamp the API hooks in `AnalyticsPage.tsx` to pull distinct aggregation structures.
2. Build the Recharts visual components (`RadarChart`, `ScatterPlot`, `RadialBar`, etc.) into `src/components/analytics/`.
3. Wire the RBAC Role context to load the appropriate layout grid dynamically.
