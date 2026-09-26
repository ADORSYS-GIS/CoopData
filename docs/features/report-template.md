# PDF reports in the supervisory template

This document describes how the Coop Data PDF reports are built: the page framework, the individual cooperative report, the consolidated reports (apex, federation, ministry), where every figure comes from, how it is checked, and what the reports do not cover.

Branch: `reportFormatOptimise`. All report code lives in `frontend/src/pages/shared/print/` unless another path is given.

## 1. Overview

Four report types share one template (teal and red, running header and footer, Document Control page, Contents, Basis of preparation, status legend, numbered sections, findings with sign-off, Annex A and B):

| Report | Entry point | Print route |
| --- | --- | --- |
| Individual cooperative | `coop/CooperativeTplReport.tsx` | `/print/cooperative/$id` |
| Apex consolidated | `cons/ConsolidatedTplReport.tsx` (tier `Apex`) | `/print/apex/$id` |
| Federation consolidated | `cons/ConsolidatedTplReport.tsx` (tier `Federation`) | `/print/federation/$id` |
| Ministry consolidated | `cons/ConsolidatedTplReport.tsx` (tier `Ministry`) | `/print/ministry` |

The backend renders each print route to PDF through Gotenberg (`generate_pdf_via_gotenberg` in `backend/src/services/export_generator.rs`). It opens the route with an admin token, waits for `window.isReady === true` (set by `useGotenbergReady`), and stores the result under `exports/v3/...`.

## 2. Page framework (`tpl/`)

Gotenberg 7.9 uses Chromium 117, which has no `@page` margin boxes. The report therefore draws its own pages.

- `tpl/tpl.css` holds the template CSS scoped under `.tpl`, plus fixed-page rules. Each page is an A4 box (210 x 297 mm). The body area is 24 mm from the top, 20 mm from the bottom and 17 mm at the sides. Anything that does not fit is clipped, so long tables are split into chunks by hand.
- `TplPage.tsx`: `TplPage` draws the running header and footer; `Sec` draws a numbered section heading.
- `TplParts.tsx`: `Pill`, `Fn` (footnote reference to Annex A), `Kpis` (tile grid), `Opinion`, `FindList`, `Note`, `Figure`, `SignOff`, `EndOfReport`, `STATUS_LEGEND`.
- `TplChrome.tsx`: `TplCover` and `FrontMatter` (Document Control, Contents, Basis of preparation, status legend).
- `TplDocument.tsx`: takes a list of `PageSpec { toc?, render }`. The cover is page 1, Document Control page 2, content from page 3. It computes page numbers and builds the Contents from each spec's `toc`.
- `TplCharts.tsx`: hand-written SVG charts used by both reports (`HBarPairs`, `VBarGroups`, `ShareBars`, `niceMax`). Charts are SVG and not a chart library so they print identically in Gotenberg.

### Charts added in this phase

- `TplTrend.tsx`
  - `Donut`: ring chart with a legend that lists every slice, its value and its share. Slices of zero or less are dropped. Returns nothing when the total is zero.
  - `LineChart`: one series over periods, optional dashed benchmark line. Axis limits use `niceMax`. When values go below zero the zero line is drawn. Missing values leave a gap.
  - `BarChart`: single series of vertical bars sized for half a page.
- `trend.ts`: `trendOf`, `unitFor`, `scaled` and the benchmark constants.
- `TrendPage.tsx`: the multi-period trend page shared by every report.

## 3. Individual cooperative report

Sections, in order (a section is left out when its data is missing, and numbers stay continuous):

1. Executive summary (`coop/pages1.tsx`)
2. Scorecard (`coop/pages1.tsx`)
3. Statement of Financial Position (`coop/pages2.tsx`): statement table, Figure 1 (balance-sheet structure), **Figures S1 and S2** (asset composition, funding)
4. Statement of Financial Performance (`coop/pages2.tsx`)
5. Loan Portfolio Quality and Credit Risk (`coop/pages3.tsx`): tables, **Figure L1** (loan book by days overdue)
6. Membership, Governance and Inclusion (`coop/pages3.tsx`): **Figures M1 and M2** (gender, age band)
7. **Multi-Period Trend** (`tpl/TrendPage.tsx`): Figures T1 to T5
8. **Peer Comparison** (`coop/pages5.tsx`)
9. Supervisory Findings and Recommendations (`coop/pages4.tsx`)
- Annex A: Data Validation and Corrections. Annex B: Indicator Definitions and Benchmarks.

Sections in bold are new in this phase. `CooperativeTplReport.tsx` assembles the list; `optional()` gives a section its number only when it exists.

### 3.1 Data sources

`pages/shared/CooperativeReportPrint.tsx` loads everything through hooks with the print token (`tokenOverride`):

| Data | Hook | Used for |
| --- | --- | --- |
| Submission | `useSubmission` | Cover, period, apex |
| KPIs and prior-year KPIs | `useCooperativeKpis` | Scorecard, executive summary |
| Statement lines (current and prior) | `useSubmissionLineItems` | Statements, S1/S2/L1 |
| Loan register categories | `usePortfolioBreakdown` | Loan register table |
| Membership counts | `useMembershipStats` | Membership tables, gender donut |
| Statement totals per period | `usePeriodSeries` (new token override) | Trend page |
| Member-ledger statistics | `useNfStatistics(false, ...)` (new token override) | Age bands |
| Every cooperative's KPIs for the year | `useNationalOverview` | Peer comparison |

The series and the member-ledger statistics are requested for the submission's own `cooperative_id`, `reporting_year`, `period_type` and `period_value`. The report waits until all of them have loaded.

### 3.2 How each new figure is computed

**Composition of assets (S1)** from the statement lines (`coop/structure.ts`, `compositionOf`):

- Liquid assets = accounts 1101 to 1104.
- Net loans = gross loans (1201 to 1205) minus the allowance for loan losses (1251 and 1252, stored as negatives).
- Other assets = accounts 1301 to 1306 (accumulated depreciation is negative and reduces this slice).

**Funding (S2)**:

- Member savings and deposits = 2101 to 2103. Borrowings = 2201 and 2202. Other liabilities = 2301 to 2303. Member equity = 3101 to 3399.

**Loan book by days overdue (L1)** (`arrearsAgeOf`): accounts 1201 (performing), 1202 (1 to 30 days), 1203 (31 to 60), 1204 (61 to 90), 1205 (over 90). The chart is left out when all five are zero.

**Gender (M1)**: male and female counts from the membership statistics. **Age bands (M2)**: `under_18`, `age_18_35`, `age_36_50` and `over_50` from the member-ledger statistics. When the age bands are missing, the previous share-bar figure (gender, youth, status) is shown instead.

**Trend (T1 to T5)** (`tpl/trend.ts`, `trendOf`). One row per period that has a statement, oldest first, at most eight periods. The series comes from `GET /api/v1/analytics/period-series` for the submission's own frequency, so a quarterly cooperative sees quarters.

| Series | Definition |
| --- | --- |
| Total assets, member savings, gross loans | Account 1999, 2100, 1200 at the latest month of the period |
| Net surplus | Reported net surplus summed over the months, or income minus expenses when none is reported |
| PAR over 30 days | (1203 + 1204 + 1205) / 1200. Limit line at 5% |
| Liquid assets | 1100 / 1999. Minimum line at 15% |
| Capital adequacy | 3999 / 1999. Minimum line at 10% |

These are the same formulas as the KPI engine (`backend/src/services/kpi_engine.rs`) and the Annex B definitions. The capital minimum is 10%, the benchmark used in the scorecard; 8% is only the "watch" threshold.

Amounts in T1 and T2 are in USD (the period series converts each approved statement at the rate frozen on its submission). The unit is thousands or millions depending on the largest value, so small cooperatives are not shown as zero. Each chart has its own unit.

**Peer comparison** (`coop/peers.ts`, `compareWithPeers`). From the national overview for the year:

- Peers are the cooperatives with a return (`has_data`). The cooperative itself must be one of them and there must be at least two.
- Apex group = those with the same `apex_id`. Apex average and rank are shown only when the apex has more than one cooperative with the indicator.
- Averages are simple averages of each cooperative's ratio and include the cooperative itself.
- Rank 1 is best: lower is better for PAR over 30 days and the operating expense ratio, higher is better for capital adequacy, return on assets, return on equity and liquidity.

### 3.3 Validation kept from the earlier phase (Annex A)

The report recomputes and lists: asset and equity lines that do not sum to the reported totals, a balance sheet that does not balance, a net surplus that differs from income minus expenses, PAR reported as zero while the loan register shows arrears (PAR is then rated Unverified), and member counts that differ between the gender and status breakdowns.

## 4. Consolidated reports

Pages for all three tiers (`cons/ConsolidatedTplReport.tsx`):

1. Executive summary (`cons/pagesA.tsx`)
2. Consolidated Financial Position and KPIs (`cons/pagesA.tsx`)
3. **Multi-Period Trend** (`tpl/TrendPage.tsx`, aggregated over the scope)
4. **Portfolio Structure and Filing Status** (`cons/pagesE.tsx`)
5. **Key Indicators** (`cons/pagesE.tsx`)
6. Apex: Cooperative Overview (`cons/pagesB.tsx`). Federation and Ministry: Sector and Apex Overview (`pagesB.tsx`) and PEARLS Benchmark Comparison (`pagesC.tsx`)
7. Social Impact and Financial Inclusion (`pagesC.tsx`)
8. Supervisory Findings (`pagesD.tsx`), Annex A (validation) and Annex B (definitions)

### 4.1 Data sources

The print routes `print.apex.$id.tsx`, `print.federation.$id.tsx` and `print.ministry.tsx` load the national overview for the year and the prior year (unchanged), and now also `usePeriodSeries` with `periodType: "yearly"` for the scope: `apexId`, `federationId`, or no filter for the ministry. The series is passed down as `trend` to `ConsolidatedTplReport` (`ConsInput.trend`).

### 4.2 How each new figure is computed

**Trend**: same definitions as section 3.2, on totals summed over all approved statements in the scope, one point per year, up to eight years ending at the reporting year. Ratios are ratios of the summed amounts, not averages of ratios.

**Market share (P1, P2)** (`cons/indicators.ts`, `shareSlices`; `cons/pagesE.tsx`): each slice is one cooperative (apex report) or one apex organisation (federation and ministry reports). The value is the sum of `total_assets` (P1) and `gross_loan_portfolio` (P2) over the cooperatives that filed. The six largest are named and the rest are grouped as Other.

**Filing status (P3)**: filed and not filed counts from `filingCounts` (cooperatives with `has_data` against `total_cooperatives`), plus the filing rate.

**Key indicators** (`tileGroupsOf`). Each tile shows its change on the prior year where the prior-year overview has a figure. "▲" or "▼" gives the direction.

| Tile | Source |
| --- | --- |
| Members, active members, inactive members | Sum of `non_financial.total_members` and `active_members` over cooperatives with member-ledger data. Inactive = members minus active |
| Active borrowers, women, youth, rural borrowers | Sums of `active_borrowers`, `women_borrowers`, `youth_borrowers`, `rural_borrowers`. Shares are of active borrowers |
| Member deposits, gross loans | Sums of `total_member_deposits` and `gross_loan_portfolio` |
| Average loan balance | Gross loans / active borrowers |
| Overdue 31-60, 61-90, over 90 days, value at risk | Latest period of the trend (accounts 1203, 1204, 1205). Value at risk = their sum. Shown in USD, with PAR over 30 days of the same period |

## 5. Accuracy checks

What was verified, and how:

1. **Formulas against the KPI engine.** The trend ratios use the same accounts as `kpi_engine.rs` (PAR over 30 days = 1203 + 1204 + 1205 over 1200; capital = 3999 over 1999; liquidity = 1100 over 1999).
2. **Formulas against stored data.** Run on the local database: for all 13 approved submissions with statements, PAR over 30 days, capital adequacy and liquid-funds ratio recomputed straight from the statement lines at the latest month equal the stored `kpi_records` values (checked to two decimals). The only difference is a submission with no loans, where the trend shows "—" (no denominator) and the stored KPI shows 0.00.
3. **Unit tests** (all run with `npx vitest run src/pages/shared/print`):
   - `tpl/trend.test.ts`: PAR, liquidity and capital formulas, null when there are no loans, periods without statements dropped, latest eight kept, unit choice.
   - `coop/structure.test.ts`: slices reconcile with the statement lines (net loans, provisions, other assets) and ageing buckets map to the right accounts.
   - `coop/peers.test.ts`: rank direction (lower or higher is better), averages, cooperatives that did not file are ignored, empty apex group.
   - `cons/indicators.test.ts`: member and borrower sums, inactive members, average loan balance, change on prior year, at-risk tiles, top-six-plus-Other grouping.
   - Existing report tests still pass (`TplDocument`, `ConsolidatedTplReport`, `coop/analysis`, `coop/data`, `consolidated/stats`).
4. **Rendering through Gotenberg.** A temporary preview route with fixture data was rendered to PDF for the individual report and for the apex, federation and ministry reports, and every new page was inspected for clipping and overlaps. Layout fixes that came out of it: the loan-quality page was overflowing, so the ageing donut now sits beside the category table; the age chart was too small at half width, so `BarChart` was added; the trend amounts rounded to zero for small cooperatives, so the unit adapts; benchmark labels were moved to the right margin. The preview route was deleted afterwards.
5. **Not verified with a real export.** A final export of real data needs a signed-in session in the browser. Please export one report of each type after deploying and check the trend and peer pages.

## 6. Limitations and decisions

- **Questionnaire cooperatives are not in the consolidated reports.** The consolidated and individual PDF reports are built from financial statements and ledgers. Cooperatives that answered the questionnaire (basic tier) appear only in Basic Analytics and in the questionnaire report. Combining the two sources in the consolidated reports is a separate decision that has not been taken.
- **Mixed currencies in consolidated sums.** The national overview sums KPI values in each cooperative's own currency (the local database has only SZL). The trend and at-risk amounts are converted to USD. If cooperatives ever report in different currencies, the KPI-based totals on the financial and indicator pages will mix currencies. The trend page is not affected.
- **Trend amounts are USD; statement tables are in the reported currency.** Both are labelled.
- **Averages and aggregates.** "Average" ratios are simple averages of each cooperative's ratio. Where an aggregate ratio can be derived it is shown beside the average. The trend page uses aggregates only.
- **Peer comparison** uses simple averages and needs at least two cooperatives with a return. The national group is everyone with a return for the year, not a filtered region or sector.
- **Trend length.** Up to eight periods. A cooperative with only one approved period gets no trend page. Only approved submissions count.
- **No sector-wide totals** (from the earlier deck) because the data is not collected. Radar charts, gauges, waterfall and monthly views were left out on purpose to keep the reports short.
- **Currency symbol, registration number, region and institution type** are not shown because the data is not available.
- **Report text is English only.** The rest of the application is translated (en, fr, pt).
- **Individual questionnaire report** (basic tier) still uses its own layout under `components/questionnaire/`.

## 7. Operations

- **Regenerating PDFs.** Exports are cached in object storage under `EXPORT_PREFIX` (`exports/v3` in `backend/src/services/export_generator.rs`). Change the version whenever the layout changes; old files are then ignored and new ones are generated on the next export. The individual export also accepts `?regenerate=true`.
- **File names** are built from the entity name and year (`frontend/src/lib/report-filename.ts`). Print URLs carry `token`, `year` and `name`.
- **Adding a page.** Write a function that returns a `PageSpec` (or `null` when there is no data), keep the content inside one A4 body, and add it to the list in `CooperativeTplReport.tsx` or `ConsolidatedTplReport.tsx`. Use `optional()` (individual) or the `n + 1` pattern (consolidated) so section numbers stay continuous.
- **Adding a chart.** Add an SVG component to `tpl/TplTrend.tsx` or `tpl/TplCharts.tsx`. Use `viewBox="0 0 380 190"` for a half-page chart and `0 0 780 ...` for a full-width one, Carlito font, and the palette from `TplCharts.tsx`.
- **Local preview.** Render a print route through Gotenberg (`http://127.0.0.1:8081/forms/chromium/convert/url`, URL `http://coopdata-frontend-dev:5173/print/...`, margins 0, `preferCssPageSize=true`, `emulateMediaType=print`, `waitForExpression=window.isReady === true`). Print routes with real data need a valid `token` query parameter.

## 8. File map added in this phase

```
hooks/analytics/usePeriodSeries.ts      token override
hooks/analytics/useNfStatistics.ts      token override
pages/shared/CooperativeReportPrint.tsx loads series, member statistics, peers
pages/shared/print/components/types.ts  ReportDataProps: trend, nfStats, peers
pages/shared/print/tpl/TplTrend.tsx     Donut, LineChart, BarChart
pages/shared/print/tpl/trend.ts         trendOf, unitFor, scaled, limits
pages/shared/print/tpl/TrendPage.tsx    shared trend page
pages/shared/print/coop/structure.ts    asset and funding composition, loan ageing
pages/shared/print/coop/peers.ts        peer comparison
pages/shared/print/coop/pages5.tsx      structure figures, peer page
pages/shared/print/cons/indicators.ts   key-indicator tiles, market-share slices
pages/shared/print/cons/pagesE.tsx      portfolio structure and key indicators pages
routes/print.apex.$id.tsx, print.federation.$id.tsx, print.ministry.tsx  load the series
backend/src/services/export_generator.rs  EXPORT_PREFIX v2 -> v3
```

Merging note: this branch also contains the `questionaire-report` work (period series endpoint, questionnaire KPI dashboard). `components/AiInsightBox.tsx` was restored because the questionnaire report sheets use it.
