import type { PeriodOption } from "@/types/basic-dashboard";

export const LATEST = "all";

export interface SubmissionPeriod {
  reporting_year: number;
  period_type?: string | null;
  period_value?: string | null;
  status?: string | null;
  submission_method?: string | null;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const periodLabel = (type: string, value: string, year: number): string => {
  if (type === "YEARLY") return String(year);
  if (type === "MONTHLY") {
    const month = Number.parseInt(value, 10);
    return MONTH_LABELS[month - 1] ? `${MONTH_LABELS[month - 1]} ${year}` : `${value} ${year}`;
  }
  return `${value.toUpperCase()} ${year}`;
};

/**
 * Periods that have at least one approved submission, newest first. Methods in
 * `excludeMethods` are skipped: questionnaire returns carry no financial
 * statement, so the statement-based Analytics must not pick them as "latest".
 */
export const toPeriodOptions = (
  submissions: readonly SubmissionPeriod[],
  excludeMethods: readonly string[] = [],
): PeriodOption[] => {
  const seen = new Map<string, PeriodOption>();
  for (const submission of submissions) {
    if ((submission.status ?? "").toLowerCase() !== "approved") continue;
    if (excludeMethods.includes(submission.submission_method ?? "")) continue;
    const type = (submission.period_type ?? "YEARLY").toUpperCase();
    const value = submission.period_value ?? String(submission.reporting_year);
    const key = `${submission.reporting_year}:${type}:${value.toUpperCase()}`;
    if (!seen.has(key)) {
      seen.set(key, {
        reporting_year: submission.reporting_year,
        period_type: type,
        period_value: value,
        label: periodLabel(type, value, submission.reporting_year),
      });
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.reporting_year - a.reporting_year || b.period_value.localeCompare(a.period_value),
  );
};

/** "Latest available" resolves to the newest year with an approved submission. */
export const resolveYear = (
  value: string,
  periods: readonly PeriodOption[],
  fallback: number = new Date().getFullYear(),
): number => {
  if (value !== LATEST) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return periods[0]?.reporting_year ?? fallback;
};

export interface ResolvedSelection {
  year: number;
  periodType: string;
  periodValue: string;
}

interface SelectionInput {
  year: string;
  periodType: string;
  periodValue: string;
}

/**
 * Turns the filter pills into one concrete period. Every "Latest available"
 * picks the newest approved period that still matches the other choices, so the
 * dashboard never adds up several periods of the same cooperative.
 */
export const resolveSelection = (
  input: SelectionInput,
  periods: readonly PeriodOption[],
  fallbackYear: number = new Date().getFullYear(),
): ResolvedSelection => {
  const match = periods.find(
    (p) =>
      (input.year === LATEST || String(p.reporting_year) === input.year) &&
      (input.periodType === LATEST || p.period_type === input.periodType) &&
      (input.periodValue === LATEST ||
        p.period_value.toUpperCase() === input.periodValue.toUpperCase()),
  );

  if (match) {
    return {
      year: match.reporting_year,
      periodType: match.period_type,
      periodValue: match.period_value,
    };
  }
  return {
    year: resolveYear(input.year, periods, fallbackYear),
    periodType: input.periodType,
    periodValue: input.periodValue,
  };
};
