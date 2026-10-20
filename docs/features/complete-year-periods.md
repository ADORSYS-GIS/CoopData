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
   Growth across several cooperatives is **like for like**: only the
   cooperatives with a complete year in both years are compared, and a note
   names those left out. Totals still include every cooperative.
6. **Submission review is unchanged.** The apex still reviews and approves each
   period on its own, with that period's own figures.

## 3. Building blocks

### Backend

- `services::reporting_year` (pure): groups a cooperative's submissions by year
  and returns, per year, the frequency, approved periods, expected periods,
  `complete`, the approved submissions and the anchor (last period).
- `services::year_figures` loads a complete year's statement as one annual
  column (`reporting_year::year_line_items`): income and expenses summed over
  the year, balance sheet from the last month of the last period. KPIs of a
  multi-period year are computed from it on the fly (`year_kpis`); the
  per-period KPIs stored for review are untouched.
- Questionnaire years are merged with `questionnaire_kpi::merge_period_answers`:
  income, expenditure and activity results summed, the accounts grid rolled
  forward (first opening balance, movements summed, last closing balance),
  every other answer from the last period.
- `GET /cooperative/submissions/{id}/kpis?scope=year` returns the KPIs of the
  complete year the submission belongs to (409 while incomplete). The prior
  year it returns is always the previous complete year.
- Every year-level consumer selects "counted" submissions through the shared
  service instead of filtering `status == approved` on its own.
- No new endpoint for progress: every role already loads its submissions list,
  and `lib/period-rules.ts` (`yearProgress`) applies the same rule on the
  client. Year-level responses that leave incomplete years out say so in their
  own payload.

- Reports: a yearly (or full-year) return is its own report. The periods of a
  year reported by quarters, halves or months share one full-year report, kept
  under the last period (`reporting_year::report_submission`), available once
  the year is complete (409 before). Report text and figures compare the year
  only with the previous complete year.

### Frontend

- Manual entry: a read-only period bar (frequency · period · months covered).
- "Reporting years" panel on the submissions page (cooperative, or a selected
  cooperative for apex, federation and ministry): one row per year with a pill
  per period (approved / in review / draft / not started) and "Complete ·
  counted" or "2 of 4 approved · Not counted yet".
- Year pickers on analytics and reports only offer complete years; incomplete
  ones are listed as disabled with their progress.

## 4. Plan

- [x] 1. Lock the period on the manual-entry page and in the backend.
- [x] 2. Reporting-year service and the progress UI.
- [x] 3. Full-year KPIs and complete years only in dashboards, analytics,
       benchmarking and consolidated figures.
- [x] 4. Reports and comparisons from complete years only.
- [x] Migration 63: one financial statement per submission. The old
      one-per-year key made the second quarter of a year fail to save.

Each step has its own tests (yearly, quarterly, semi-annual, monthly and mixed
data) and its own commit.
