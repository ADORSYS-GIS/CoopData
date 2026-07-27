# Cooperative Report PDF Export Architecture

This document details the architectural flow, component structure, and data sources behind the **Official Cooperative Performance Report** PDF export.

## 1. What is the Export Report?
The PDF Export is a comprehensive prudential ratio evaluation, risk profiling, and financial audit generated for a cooperative. Once a cooperative's financial submission is fully reviewed and approved by the Apex or Ministry, this official report is generated to serve as the definitive snapshot of their health for that reporting year.

**What we did in Phase 1:**
- Built a highly modularized React layout specifically tailored for A4 print dimensions.
- Wired up Recharts for dynamic visual storytelling (Membership Composition, Portfolio Distribution).
- Integrated `kpi_records` to calculate Year-over-Year (YoY) performance and PEARLS benchmark comparisons.
- Implemented a background worker pattern to silently generate and store these heavy PDF files using Gotenberg.

## 2. Architectural Flow & The "Minion"

The generation of the PDF relies on a robust background worker pattern to ensure the API remains snappy.

1. **Approval Trigger**: When an Apex or Ministry user approves a submission (`PUT /api/v1/cooperative/submissions/:id/status`), the handler updates the database.
2. **The Minion (Tokio Task)**: The backend invokes `ExportGenerator::trigger_cooperative_export`. This spawns a detached background thread (`tokio::spawn`)—our "minion". The API immediately returns a `200 OK` to the user, while the minion begins the heavy lifting in the background.
3. **Multi-Format Baking**: The minion asynchronously generates an Excel fallback (`.xlsx`), a Word document (`.docx`), and finally the PDF (`.pdf`).
4. **Storage**: Once generated, the files are uploaded directly to the object storage bucket (e.g., S3/MinIO) under `exports/individual/{submission_id}/`.

## 3. How Gotenberg Works

Gotenberg is a Docker-based stateless API for PDF generation using a headless Chromium browser.

- **The Request**: The backend minion sends a multipart form POST request to Gotenberg containing the frontend URL (e.g., `http://frontend:5173/print/cooperative/{submission_id}?token=...`).
- **The Magic Signal (`window.isReady`)**: Because the frontend relies on React Query to fetch data asynchronously over the network, Gotenberg cannot simply print the page immediately upon load. We configure Gotenberg with `waitForExpression="window.isReady === true"`. 
- **The Trigger**: Inside `CooperativeReportPrint.tsx`, a `useEffect` hook waits for all 5 data hooks to finish loading. Once the data is injected into the DOM, it fires `(window as any).isReady = true`, signaling to Gotenberg that the headless browser can now capture the perfectly rendered page and convert it to PDF.

## 4. Frontend Component Modularization

To prevent massive, unmaintainable files and to prepare for Phase 2 (Apex) and Phase 3 (Federation), the report is broken down into modular layout blocks located in `src/pages/shared/print/components/`:

- `ReportCoverPage`: Branding, Organization Name, Submission Code.
- `ReportExecutiveSummary`: High-level metrics, Sector Context, Key Ratios.
- `ReportNonFinancial`: Membership Demographics, AGM Attendance.
- `ReportFinancialPosition`: Detailed Balance Sheet and Income Statement with YoY changes.
- `ReportPortfolioQuality`: Gross Loan Portfolio breakdown and classification.
- `ReportBenchmarkComparison`: Pass/Fail status mapping against standard PEARLS benchmarks.

**Alignment with other levels**: Because these components are completely decoupled from the data fetching layer (they simply accept a `ReportDataProps` object), the upcoming **Apex Consolidated Report** and **Federation Report** will easily import and reuse these exact same visual blocks, ensuring total brand consistency across all tiers.

## 5. Database Tables & Data Sources

The report relies on deeply interconnected tables to build the full picture. The frontend orchestrates 5 separate API endpoints to gather this:

1. **`submissions` & `cooperatives`**: Provides metadata like the Reporting Year, Submission Status, Cooperative Name, Region, and Institution Type.
2. **`financial_statements` & `balance_sheet_line_items`**: Provides the raw ledger data. Specifically, account codes `1999` (Total Assets), `2999` (Total Liabilities), `3999` (Total Equity), `5999` (Total Income), and `6499` (Total Expenses).
3. **`loans`**: Grouped and aggregated by status (Performing, Arrears 1-30, Loss, etc.) to generate the Portfolio Quality pie chart and tables.
4. **`members`**: Aggregated by gender, youth status, and activity status to generate the Membership Demographics pie chart and AGM attendance metrics.
5. **`kpi_records`**: The pre-computed prudential ratios. The frontend leverages `?include_prior_year=true` to automatically fetch last year's KPIs and compute the Year-over-Year change deltas.

## 6. KPIs Utilized

The following key indicators are actively fetched from `kpi_records` and utilized in the report:

| Category | Indicators | Where Used |
| :--- | :--- | :--- |
| **Financial Size** | `total_assets`, `gross_loan_portfolio`, `total_member_deposits`, `total_equity`, `net_surplus` | Executive Summary (Financial Highlights), Financial Position (Totals) |
| **Portfolio Quality** | `par30`, `par90`, `npl_ratio`, `loan_loss_coverage` | Executive Summary (Key Ratios), Portfolio Quality, Benchmark Comparison |
| **Profitability** | `roa`, `roe`, `operating_expense_ratio`, `net_interest_margin`, `operational_self_sufficiency` | Executive Summary (Key Ratios), Benchmark Comparison |
| **Liquidity & Solvency**| `capital_adequacy_ratio`, `liquid_funds_ratio`, `deposits_to_loans` | Executive Summary (Key Ratios), Benchmark Comparison |

All indicators with a defined `benchmark` value are automatically extracted and evaluated in the final **PEARLS Benchmark Comparison** sheet (Page 6).
