# Sprint 4: Analytics & Dashboards Implementation

This document summarizes the full-stack implementation of the analytics and dashboard features across the Cooperative and Apex tiers. This work resolves three major tickets from Epic 4 (US4.1 & US4.2).

---

## 1. Issue #39: Backend KPI Computation Endpoint
**Epic:** US4.2 — Automated KPI & Financial Ratio Generation
**Link:** [Issue #39](https://github.com/ADORSYS-GIS/CoopData/issues/39)

### Overview
Implemented the backend infrastructure to calculate live financial KPIs from approved or submitted balance sheet line items, replacing placeholder data with actual financial mathematics.

### Key Implementations
- **`KpiEngine` Service (`backend/src/services/kpi_engine.rs`)**: 
  - Created the core computation engine to evaluate 16 standard financial ratios (Total Assets, Gross Loan Portfolio, Net Surplus, PAR30, PAR90/NPL, ROA, ROE, Capital Adequacy, etc.).
  - Reads line items dynamically based on predefined account code ranges (e.g., `1999` for Total Assets, `1201-1205` for Gross Loans).
- **KPI DTOs (`backend/src/api/dto/financial.rs`)**:
  - Implemented `KpiResponse` and `SubmissionKpisResponse` types to serialize the computed KPIs with status indicators (`green`, `amber`, `red`) and units (`percent`, `currency`).
- **REST Endpoints**:
  - `GET /api/v1/cooperative/submissions/{id}/kpis`: Scoped for cooperatives to view their own metrics.
  - `GET /api/v1/apex/submissions/{id}/kpis`: Scoped for apex organizations to view KPIs for their subordinate cooperatives (using `resolve_caller_cooperative_ids`).

---

## 2. Issue #41: Frontend: Wire Analytics Page to Real API Data
**Epic:** US4.1 — Level-Specific Custom Dashboards & US4.2
**Link:** [Issue #41](https://github.com/ADORSYS-GIS/CoopData/issues/41)

### Overview
Transitioned the massive `AnalyticsPage.tsx` from static `@/lib/mock-data` configurations to live data fetched from our new backend endpoints.

### Key Implementations
- **Data Fetching Hooks**:
  - Created `useCooperativeKpis.ts` and `useApexSubmissionKpis.ts` to interface with the new KPI computation endpoints.
  - Integrated `useMonthlyTrend` and `useNfStatistics` to supply the trend charts and demographic summaries.
- **Cooperative Role View**:
  - Wired the top-level KPI cards to display live values from the latest approved submission.
  - Wired the 12-month asset/liability/savings trend charts and loan portfolio pie charts to reflect actual `financial_statement` and non-financial data.
- **Apex Deep Dive Fixes**:
  - Solved a critical data parity bug where the Apex view lacked the Cooperative's financial metrics.
  - Replicated the Financial KPI summary grid within the Apex "Deep Dive" panel so oversight users see the exact same metrics (Assets, NPL, Surplus) as the cooperative.
  - Implemented strict "Empty States": If an Apex selects a cooperative and year that does *not* have an officially approved financial submission, the analytics degrade gracefully and display a "No approved submission" banner, explicitly preventing the UI from misrepresenting raw unapproved data.

---

## 3. Issue #44: Full-Stack: Wire Role Dashboards to Real API Data
**Epic:** US4.1 — Level-Specific Custom Dashboards
**Link:** [Issue #44](https://github.com/ADORSYS-GIS/CoopData/issues/44)

### Overview
Wired the primary landing dashboards (`cooperative-dashboard.tsx` and `apex-dashboard.tsx`) so the first screen a user sees after login is populated entirely with real database queries rather than hardcoded metrics.

### Key Implementations
- **Apex Dashboard (`useApexStats`)**:
  - Backend: Created the `GET /api/v1/apex/stats` handler to aggregate the total cooperatives, pending submissions, total submissions, and average KPIs for the logged-in Apex.
  - Frontend: Replaced multiplier-based mock math with real `cooperative_count`, `pending_review_count`, and pending tables.
- **Cooperative Dashboard (`useCooperativeDashboardStats`)**:
  - Frontend: Replaced the static overview cards with real values from the cooperative's most recent submission (e.g., Total Assets, PAR30).
  - Wired the "Submissions" list to the real `useSubmissions()` hook.
  - Implemented Skeleton loaders (`<Skeleton />`) across all dashboard stat cards to handle loading states gracefully without crashing the UI on slow networks.
