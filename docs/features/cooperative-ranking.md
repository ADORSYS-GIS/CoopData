# Design Document: Cooperative Ranking Chart & Leaderboard

This document outlines the design and implementation plan for the Cooperative Ranking feature, which visualizes and lists cooperatives ordered by chosen financial metrics.

## 1. Feature Description

The ranking page/section will display:
- **Scope by Role**:
  - **Ministry**: Sees and ranks all cooperatives nationwide.
  - **Federation**: Sees and ranks only cooperatives within their federation.
  - **Apex**: Sees and ranks only cooperatives within their apex.
  - This scope is handled automatically by the backend's `/analytics/national-overview` endpoint.
- **Metric Selector**: Select from core KPIs (Total Assets, Gross Loan Portfolio, Total Member Deposits, Total Equity, Capital Adequacy Ratio, Return on Assets, NPL Ratio).
- **Display Limit & Order**: Choose between sorting descending/ascending and displaying Top 5, Top 10, Top 20, or All cooperatives.
- **Visual Chart**: A vertical bar chart (matching the user's requested layout) representing cooperative metric values.
- **Leaderboard Table**: A clean table showing rank, cooperative name, region, and formatted metric value.

---

## 2. UI Component Design

We will create a new component:
- `frontend/src/components/analytics/CooperativeRanking.tsx`

This component will be placed in:
- `MinistryAnalyticsView.tsx`
- `FederationAnalyticsView.tsx`
- `ApexAnalyticsView.tsx`

---

## 3. UI Preview Mockup

```
+-------------------------------------------------------------------------+
|  Cooperative Performance Ranking                                        |
|  Compare and rank cooperatives across selected financial metrics        |
+-------------------------------------------------------------------------+
|  Rank By: [ Total Assets v ]  Sort: [ Highest to Lowest v ]  Limit: [ Top 10 v ]
+-------------------------------------------------------------------------+
|                                                                         |
|  [Chart: Vertical Bars]                                                 |
|   |  *                                                                  |
|   |  *     *                                                            |
|   |  *     *     *                                                      |
|   |  *     *     *     *                                                |
|   +----------------------------------------------------                 |
|     Coop A Coop B Coop C Coop D ...                                     |
|                                                                         |
+-------------------------------------------------------------------------+
|  Leaderboard Table                                                      |
|  Rank  Cooperative Name      Region        Value                        |
|  #1    Cooperative A         Hhohho        SZL 12.4M                    |
|  #2    Cooperative B         Manzini       SZL 9.8M                     |
|  #3    Cooperative C         Lubombo       SZL 7.2M                     |
+-------------------------------------------------------------------------+
```
