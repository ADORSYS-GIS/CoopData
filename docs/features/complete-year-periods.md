# Design: Complete reporting years

> **Status:** In progress
> **Builds on:** `period-types.md`, `docs/testing/reference-test-data-round2.md` part F

## 1. Problem

A cooperative can report yearly, half-yearly, quarterly or monthly. Today every
approved submission is treated as "the year", so:

- a single quarter is compared with another cooperative's (or its own) full year,
  which turns 3 months of income into a fake fall or rise;
- yearly averages and consolidated totals mix a quarter's income with full years;
- the manual-entry page can change a submission's frequency, period and start
  month after creation, skipping the "one frequency per year" rule.

## 2. Rules

1. **The period is fixed at creation.** Frequency, period and start month are
   chosen in the "new submission" dialog and cannot be changed afterwards. The
   manual-entry page shows them read-only; the backend refuses a save whose
   period differs from the submission's.
2. **A year counts only when it is complete.** A year is complete when every
   period of its frequency is approved:

   | Frequency   | Periods needed                  |
   | ----------- | ------------------------------- |
   | Yearly      | the yearly return               |
   | Semi-annual | H1 and H2                       |
   | Quarterly   | Q1, Q2, Q3 and Q4               |
   | Monthly     | the 12 months (or "Full 12 Mo") |

   The order in which periods are filed and the start month do not matter; that
   is the cooperative's responsibility.
3. **An incomplete year is not used anywhere**: no dashboards, analytics,
   benchmarking, consolidated totals, comparisons or reports. Screens say the
   year is not complete yet and show the progress ("2 of 4 quarters approved").
4. **Full-year figures of a multi-period year**
   - income, expenses and surplus: the sum of all periods;
   - assets, loans, deposits, equity: the last period (Q4, H2, December, in the
     submission's own month sequence);
   - ratios: recalculated from those totals;
   - member, loan and savings registers: the last period (they are stock figures).
5. **Comparisons** (growth, prior year, trends) only between complete years.
6. **Submission review is unchanged.** The apex still reviews and approves each
   period on its own, with that period's own figures.

## 3. Building blocks

### Backend

- `services::reporting_year` (pure): groups a cooperative's submissions by year
  and returns, per year, the frequency, approved periods, expected periods,
  `complete`, the approved submissions and the anchor (last period).
- `kpi_records.scope` (`period` | `year`): full-year KPIs of a complete
  multi-period year are stored once under the anchor submission with scope
  `year`; per-period KPIs keep scope `period` and stay available for review.
  They are (re)computed whenever a period of that year is approved and in the
  startup KPI recompute.
- Every year-level consumer selects "counted" submissions through the shared
  service instead of filtering `status == approved` on its own.
- `GET /api/v1/cooperative/reporting-years` (and the apex equivalent): per
  cooperative and year, the progress (`approved`, `expected`, `missing` periods,
  `complete`).

### Frontend

- Manual entry: a read-only period bar (frequency · period · months covered).
- `YearProgress` component: "Quarterly · 2 of 4 approved" with one pill per
  period (approved / submitted / draft / not started). Shown on the submissions
  page, dashboards and report screens when a year is not complete.
- Year pickers on analytics and reports only offer complete years; incomplete
  ones are listed as disabled with their progress.

## 4. Plan

- [x] 1. Lock the period on the manual-entry page and in the backend.
- [ ] 2. Reporting-year service, progress endpoint and the progress UI.
- [ ] 3. Full-year KPIs and complete years only in dashboards, analytics,
       benchmarking and consolidated figures.
- [ ] 4. Reports and comparisons from complete years only.

Each step has its own tests (yearly, quarterly, semi-annual, monthly and mixed
data) and its own commit.
