# Design Document — Report Export Structures & Formats

This document defines the data content, layout structure, and implementation roadmap for the multi-tiered report export system.

---

## 1. Report Data Contents by Tier

### A. Cooperative Level (Individual Submission Report)
For a single cooperative submission, the export generates a detailed record of the financial statement and operational KPIs in XLSX, CSV, DOCX, or PDF. All formats are generated server-side.

#### XLSX Format (Excel)
- **Sheet 1: Balance Sheet**:
  - Metadata Header: Cooperative Name, Submission Reference (UUID), Reporting Year/Month, Status, Verification/AI Extraction confidence.
  - Table Data:
    - `Account Code` (e.g. 1101, 1201, 2101)
    - `Account Name` (e.g. Cash on Hand, performing loan portfolio)
    - `Category` (Assets, Liabilities, Equity, Income, Expenses)
    - `Value (SZL)` (Numerical value formatted as currency)
    - `AI Confidence` (Confidence percentage if extracted, otherwise blank or 100% for manual inputs)
- **Sheet 2: Key Performance Indicators (KPIs)**:
  - Table Data:
    - `Category` (e.g., Financial Performance, Portfolio Quality, Profitability, Membership)
    - `KPI Name` (e.g., Capital Adequacy Ratio, PAR 30, ROA)
    - `Description` (Plain text explaining the metric formula/meaning)
    - `Value` (Formatted appropriately based on unit: currency, percent, ratio, or count)
    - `Benchmark` (Standard regulatory/industry targets)
    - `Status` (Color-coded cell: Green, Amber, Red)

#### CSV Format
- A flat CSV dump containing:
  - Column 1: Item Type (e.g., "Balance Sheet Line Item" or "KPI")
  - Column 2: Account Code / KPI ID
  - Column 3: Name / Description
  - Column 4: Value (numeric/formatted)
  - Column 5: Status / Confidence

#### DOCX Format (Word)
- Generates a styled Word document using `docx-rs`:
  - **Cover Header**: Cooperative Report, generated date, submission period.
  - **Balance Sheet Section**: Formatted Word table with bordered cells, bold category headers, and aligned values.
  - **KPI Dashboard Section**: Formatted Word table listing all computed metrics grouped by category, with benchmarks.

#### PDF Format
- Generates a professional, print-ready PDF document using `printpdf` (with built-in Helvetica font):
  - Clean page layouts with margins (20mm).
  - Page titles and cooperative details.
  - Tabular layout for Balance Sheet and KPI metrics.

---

### B. Apex Level (Apex Consolidated Report)
Consolidates data for all cooperatives operating under a single Apex entity.

- **Sheet 1: Summary Dashboard**:
  - Key aggregated metrics: Total consolidated assets, total loans outstanding, total member savings, total members.
  - List of member cooperatives with their submission status and compliance score.
- **Sheet 2: KPI Aggregates**:
  - Mean/median KPI values across all member cooperatives compared to national benchmarks.
- **Subsequent Sheets**: One tab per member cooperative containing their individual KPI breakdown.

---

### C. Federation Level (Federation Consolidated Report)
Aggregated performance data across all Apexes and member cooperatives under a Federation.

- **Sheet 1: Federation Overview**:
  - Summary of registered cooperatives and active submissions by Apex group.
  - Total consolidated asset base and loan/savings metrics.
- **Sheet 2: Apex Comparison**:
  - Side-by-side performance comparison of Apexes under the Federation.

---

### D. Ministry Level (National Consolidated Report)
A comprehensive nationwide master sheet with access to all datasets for oversight and policy formulation.

- **Sheet 1: National Analytics**:
  - Filing rates (compliance tracker) by region and cooperative sector.
  - Total national savings, credit volume, and cooperative member count.
  - Frequency analysis of risk flags (e.g., how many SACCOs breached CAR threshold).
- **Sheet 2: Full Directory**:
  - Flat table containing all submissions, financial statements, and regional indicators for easy pivot-table analysis.

---

## 2. Implementation Roadmap

```mermaid
graph TD
    Step1[1. Dependency Injection] --> Step2[2. KPI Engine in Rust]
    Step2 --> Step3[3. Single-Submission Handlers for all formats]
    Step3 --> Step4[4. Bulk Consolidated Handler]
    Step4 --> Step5[5. Route & OpenAPI Registration]
    Step5 --> Step6[6. Frontend ReportExportPanel Hook]
    Step6 --> Step7[7. Page Wiring & End-to-End Test]
```

1. **Step 1: Dependency Injection** — Add `rust_xlsxwriter`, `csv`, `docx-rs`, and `printpdf` to the backend workspace.
2. **Step 2: KPI Engine in Rust** — Port the formula logic from `kpi-calculations.ts` to `kpi_engine.rs` to compute financial/non-financial metrics from the database models.
3. **Step 3: Single-Submission Handlers for all formats** — Implement individual export handlers for XLSX, CSV, DOCX, and PDF formats.
4. **Step 4: Bulk Consolidated Handler** — Implement tier-based endpoint for Apex/Federation/Ministry to generate multi-sheet Excel files.
5. **Step 5: Route & OpenAPI Registration** — Map routes to Axum and run the OpenAPI generator to sync TypeScript client types.
6. **Step 6: Frontend ReportExportPanel Hook** — Update UI to trigger backend downloads using blobs and authenticating via Keycloak JWT token.
7. **Step 7: Page Wiring & End-to-End Test** — Verify the export triggers seamlessly across Cooperative, Apex, and Ministry views.
