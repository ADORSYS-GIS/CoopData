import { MONTH_NAMES, toPeriodType, type PeriodType } from "@/lib/period-rules";

export interface SubmissionPeriodSource {
  reporting_year?: number;
  period_type?: string | null;
  period_value?: string | null;
  fiscal_start_month?: number | null;
}

export interface WizardPeriod {
  year: number;
  periodType: PeriodType;
  periodValue: string;
  startMonth: number;
  accountingYear: "calendar" | "fiscal";
}

const API_PERIOD_TYPES: Record<string, PeriodType> = {
  YEARLY: "YEARLY",
  QUARTERLY: "QUARTERLY",
  MONTHLY: "MONTHLY",
  SEMIANNUAL: "SEMI_ANNUAL",
  SEMI_ANNUAL: "SEMI_ANNUAL",
};

/** Accepts both the API spelling ("Quarterly", "SemiAnnual") and the upper-case one. */
export const normalizeWizardPeriodType = (raw?: string | null): PeriodType =>
  API_PERIOD_TYPES[(raw ?? "").toUpperCase()] ?? toPeriodType(raw);

const validStart = (month?: number | null): number =>
  typeof month === "number" && month >= 1 && month <= 12 ? month : 1;

/** The period a submission was created for. It is fixed and cannot be edited in the wizard. */
export const periodFromSubmission = (submission?: SubmissionPeriodSource | null): WizardPeriod => {
  const year = submission?.reporting_year ?? new Date().getFullYear();
  const periodType = normalizeWizardPeriodType(submission?.period_type);
  const startMonth = validStart(submission?.fiscal_start_month);
  return {
    year,
    periodType,
    periodValue:
      periodType === "YEARLY" ? String(year) : (submission?.period_value ?? "").toUpperCase(),
    startMonth,
    accountingYear: startMonth === 1 ? "calendar" : "fiscal",
  };
};

/**
 * Months a period covers, in fiscal-year order (`[0]` is the single column of a
 * yearly return). Mirrors `period_rules::period_months` on the backend.
 */
export const periodMonths = (
  periodType: PeriodType,
  periodValue: string,
  startMonth: number,
): number[] => {
  if (periodType === "YEARLY") return [0];
  const start = validStart(startMonth);
  const sequence = Array.from({ length: 12 }, (_, i) => ((start - 1 + i) % 12) + 1);
  const value = periodValue.toUpperCase();
  if (periodType === "QUARTERLY") {
    const quarter = ["Q1", "Q2", "Q3", "Q4"].indexOf(value);
    const index = quarter < 0 ? 0 : quarter;
    return sequence.slice(index * 3, index * 3 + 3);
  }
  if (periodType === "SEMI_ANNUAL") {
    return value === "H2" ? sequence.slice(6, 12) : sequence.slice(0, 6);
  }
  const month = Number(value);
  if (Number.isInteger(month) && month >= 1 && month <= 12) return [month];
  return sequence;
};

/** "Apr – Jun", "Jul – Jun" or "Mar"; empty for a yearly return. */
export const monthsCoveredLabel = (months: number[]): string => {
  const first = months[0];
  const last = months[months.length - 1];
  if (first === undefined || last === undefined || first === 0) return "";
  const name = (month: number) => MONTH_NAMES[month - 1] ?? "";
  return first === last ? name(first) : `${name(first)} – ${name(last)}`;
};

/** "Q2", "H1", "Mar", "Full 12 months" or the year for a yearly return. */
export const periodShortLabel = (period: WizardPeriod): string => {
  if (period.periodType === "YEARLY") return String(period.year);
  if (period.periodType === "MONTHLY") {
    const month = Number(period.periodValue);
    return Number.isInteger(month) && month >= 1 && month <= 12
      ? (MONTH_NAMES[month - 1] ?? period.periodValue)
      : "";
  }
  return period.periodValue;
};
