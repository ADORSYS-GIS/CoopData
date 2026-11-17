# How the numbers are built

Read this page when a chart looks empty, a number looks lower than expected, or two screens disagree. Almost every question comes from the rules below.

## 1. Only approved data is counted

A figure appears on a dashboard, in an analysis or in a report only after the apex has approved the submission behind it. Drafts, submissions waiting for the apex, and submissions sent back for correction are not counted.

## 2. Two kinds of cooperative, two sets of screens

| Cooperative type | How it reports | Where its figures appear |
| --- | --- | --- |
| SACCO | Financial statement (upload or manual entry) | Analytics, Benchmarking, and the financial-statements report |
| Multipurpose | Questionnaire | Basic Analytics, Basic Benchmarking, and the questionnaire report |

- A short banner appears every time you open one of these tabs and tells you which type it covers.
- The Dashboard counts every submission (total, in review, approved). The type-specific screens only count their own type. A cooperative that has no type set is left out of the type-specific screens.
- The totals on the dashboard and on an analytics tab can therefore differ. This is expected.

## 3. A year counts only when it is complete

A cooperative reports yearly, half-yearly, quarterly or monthly. A year is **complete** only when every period of its frequency is approved.

| Frequency | Periods needed |
| --- | --- |
| Yearly | The yearly return |
| Half-yearly | H1 and H2 |
| Quarterly | Q1, Q2, Q3 and Q4 |
| Monthly | The 12 months |

- An incomplete year is not used in dashboards, analytics, benchmarking, consolidated totals, comparisons or reports. The screens say the year is not complete yet and show the progress, for example "2 of 4 quarters approved".
- Year pickers on analytics and reports only offer complete years.
- The order in which periods are filed, and the month a year starts in, do not matter.

### Figures of a year reported in several periods

| Kind of figure | How the full year is built |
| --- | --- |
| Income, expenses, surplus | Sum of all the periods |
| Assets, loans, deposits, equity | The last period (Q4, H2 or December) |
| Ratios | Recalculated from those totals |
| Member, loan and savings registers | The last period |

For the questionnaire, income, expenditure and activity results are summed. The accounts grid rolls forward (first opening balance, movements summed, last closing balance). Every other answer comes from the last period.

### Why a cooperative may be "left out"

When a screen compares two years across several cooperatives, only the cooperatives with a complete year in both years are compared, so a quarter is never compared with a full year. A note names how many were left out. Totals still include every cooperative.

## 4. Filters

- **Region and sector** can be combined with the other filters. Both ignore upper and lower case, so "manzini" and "Manzini" give the same result. The sector comes from the cooperative's profile.
- **Frequency** (Yearly, Half-yearly, Quarterly, Monthly, or Latest available) and the **date** dropdown work together.
  - "Latest available" shows each cooperative on its own most recent period, whatever its frequency.
  - When a cooperative reports once for the whole year, the date shows only the year.
  - When you choose a year, a cooperative that reports in several periods is shown at its latest period of that year.
  - If cooperatives in the selection report at different frequencies, the figures are folded into a yearly view.
- **Currency:** every amount is in SZL (emalangeni). The platform never converts figures to another currency, and the Basic Analytics header only states the currency in use.

## 5. Rankings and benchmarks

- **Cooperative ranking** orders cooperatives by their indicators for the selected complete year. The top five and the watch list (bottom five) come from the same data.
- **Benchmarking** compares one cooperative with national and group averages. The averages hide individual cooperatives. Benchmarking opens up once your own submission for the year is submitted and approved.

## 6. Reports

- A yearly return is its own report.
- A year reported in several periods has one full-year report. It becomes available once the year is complete. Before that the system refuses to generate it.
- A report compares the year only with the previous complete year.
- The report edition (financial statements or questionnaire) must be chosen. Only editions with approved data for the year can be selected.

## 7. Indicator status in the questionnaire views

Each indicator of Basic Analytics and of the questionnaire report has one of three states.

| Status | Meaning |
| --- | --- |
| Computed | Calculated from the answers given |
| Approximate | Estimated from related answers |
| Not reported | The questionnaire did not provide what the indicator needs |

The report's methodology page lists the indicators that are estimated or not reported, with their formulas.
