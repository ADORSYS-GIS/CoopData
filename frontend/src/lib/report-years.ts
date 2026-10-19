import { toPeriodType, yearProgress, type YearProgress } from "@/lib/period-rules";

export interface ReportableSubmission {
  id: string;
  cooperative_id?: string | null;
  reporting_year: number;
  period_type?: string | null;
  period_value?: string | null;
  status: string;
}

export type ReportChoice<T> = T & {
  /** The year's progress while it is not complete: no report yet. */
  pending?: YearProgress;
};

const isSingleReturn = (s: ReportableSubmission): boolean =>
  toPeriodType(s.period_type) === "YEARLY" ||
  (toPeriodType(s.period_type) === "MONTHLY" &&
    (s.period_value ?? "").toUpperCase() === "FULL_YEAR");

/**
 * The individual reports a cooperative's submissions offer, newest year first.
 * A yearly (or full-year) return is its own report once submitted. A year
 * reported by quarters, halves or months has one report for the whole year,
 * kept under its last period, once every period is approved; until then it is
 * listed with its progress and cannot be chosen.
 */
export function reportChoices<T extends ReportableSubmission>(
  submissions: readonly T[],
  exportableStatuses: readonly string[],
): ReportChoice<T>[] {
  const choices: ReportChoice<T>[] = [];
  const exportable = (s: T) => exportableStatuses.includes(s.status.toLowerCase());

  for (const s of submissions) {
    if (isSingleReturn(s) && exportable(s)) choices.push(s);
  }

  const periodic = submissions.filter((s) => !isSingleReturn(s));
  for (const year of yearProgress(periodic)) {
    const inYear = periodic.filter(
      (s) => s.reporting_year === year.year && (s.cooperative_id ?? "") === year.cooperativeId,
    );
    const anchor = year.complete ? inYear.find((s) => s.id === year.anchorId) : undefined;
    if (anchor) {
      choices.push(anchor);
      continue;
    }
    const representative = inYear.find(exportable);
    if (representative) choices.push({ ...representative, pending: year });
  }

  return choices.sort((a, b) => b.reporting_year - a.reporting_year);
}
