# Design Document: Cooperative Comparative Analytics

This document outlines the design and implementation plan for the Cooperative Comparative Analytics feature, which allows administrators and cooperatives to compare a specific cooperative's performance against the national average (system-wide average) across key financial performance indicators.

## 1. Feature Description

Users will be able to:
- **Select a Cooperative**: A searchable dropdown to select a cooperative (for Ministry, Federation, and Apex tiers). For Cooperative-tier users, their own cooperative is pre-selected and locked.
- **Select a Metric/KPI**: Compare specific metrics (e.g., Total Assets, Gross Loan Portfolio, Capital Adequacy Ratio, Return on Assets, etc.).
- **Visualize Comparison**: Display a side-by-side bar chart showing the selected cooperative's value vs. the national average.
- **Overview Comparison Table**: A comprehensive table comparing all core financial metrics of the selected cooperative against the system average, complete with variance and percentage difference indicators.

---

## 2. Technical Scope & Implementation Plan

### Data Sourcing
- We will leverage the existing `/api/v1/analytics/national-overview` endpoint (via the TanStack Query hook `useNationalOverview`).
- This endpoint returns:
  - A list of all cooperatives with their computed financial KPIs (`cooperatives` array).
  - Since it is registered in `shared_routes()`, it is accessible to all authenticated roles (Ministry, Federation, Apex, and Cooperative).

### Math & Statistics (Frontend)
- **Cooperative Value**: Extracted directly from `cooperative.kpis[kpi_name].value`.
- **System-Wide Average**: Calculated dynamically by filtering cooperatives with data:
  ```typescript
  const validCoops = cooperatives.filter(c => c.kpis[kpiName]?.value !== undefined);
  const average = validCoops.reduce((sum, c) => sum + c.kpis[kpiName].value, 0) / validCoops.length;
  ```

---

## 3. UI Component Design

We will create a new component:
- `frontend/src/components/analytics/CooperativeComparison.tsx`

This component will be placed in:
- `MinistryAnalyticsView.tsx`
- `FederationAnalyticsView.tsx`
- `ApexAnalyticsView.tsx`
- `CooperativeAnalyticsView.tsx` (enabling cooperatives to benchmark themselves against the national average)

---

## 4. UI Preview Mockup (Visual Details)

```
+-------------------------------------------------------------------------+
|  Cooperative Performance Benchmarking                                   |
|  Compare a cooperative's performance against the system-wide average    |
+-------------------------------------------------------------------------+
|  Select Cooperative: [ Cooperative A       v ]                          |
|  Select Metric:      [ Capital Adequacy Ratio (CAR) v ]                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  [Chart: Side-by-side Bars]                                             |
|   Cooperative A:  14.2%  ===================================> [Amber]   |
|   National Avg:   15.5%  =====================================> [Green] |
|                                                                         |
+-------------------------------------------------------------------------+
|  Comparative Matrix (All Core KPIs)                                     |
|  Metric          Cooperative A   System Avg   Variance   Status         |
|  Total Assets    SZL 12.4M       SZL 10.1M    +22.7%     [Green]        |
|  GLP             SZL 8.2M        SZL 7.5M     +9.3%      [Green]        |
|  CAR             14.2%           15.5%        -1.3%      [Amber]        |
|  PAR30           6.4%            4.8%         +1.6%      [Red]          |
+-------------------------------------------------------------------------+
```

---

## 5. User Feedback Required

1. **Role Access**: Should cooperative users be able to select and view other cooperatives, or should they only see their own cooperative compared to the national average?
   - *Recommendation*: Cooperative users should be locked to their own cooperative for data privacy, whereas Ministry/Federation/Apex users can select any cooperative.
2. **KPI Metrics List**: Are there any other specific KPIs besides the standard financial ones (Total Assets, GLP, Member Deposits, Equity, PAR30, ROA, CAR) you would like to include?
