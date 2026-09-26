export type PeriodType = "YEARLY" | "QUARTERLY" | "MONTHLY" | "SEMI_ANNUAL";

export interface PeriodSubmission {
  reporting_year: number;
  period_type?: string | null;
  period_value?: string | null;
  status?: string | null;
  submission_method?: string | null;
}

export interface YearLock {
  year: number;
  periodType: PeriodType;
  onlyDrafts: boolean;
}

export interface PeriodReminder {
  year: number;
  periodType: PeriodType;
  missing: string[];
}

const PERIOD_TYPES: readonly PeriodType[] = ["YEARLY", "QUARTERLY", "MONTHLY", "SEMI_ANNUAL"];

export const toPeriodType = (value?: string | null): PeriodType => {
  const upper = (value ?? "YEARLY").toUpperCase();
  return PERIOD_TYPES.find((type) => type === upper) ?? "YEARLY";
};

export const normalizePeriodValue = (type: PeriodType, value?: string | null): string => {
  const raw = (value ?? "").trim();
  if (type === "MONTHLY") {
    const month = Number.parseInt(raw, 10);
    return month >= 1 && month <= 12 ? String(month).padStart(2, "0") : raw.toUpperCase();
  }
  return raw.toUpperCase();
};

export const expectedPeriods = (type: PeriodType): string[] => {
  if (type === "SEMI_ANNUAL") return ["H1", "H2"];
  if (type === "QUARTERLY") return ["Q1", "Q2", "Q3", "Q4"];
  if (type === "MONTHLY")
    return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  return [];
};

/** Number of calendar periods of `type` that have started by `now` in `year`. */
const periodsStarted = (type: PeriodType, year: number, now: Date): number => {
  const total = expectedPeriods(type).length;
  if (year < now.getFullYear()) return total;
  if (year > now.getFullYear()) return 0;
  const month = now.getMonth() + 1;
  if (type === "MONTHLY") return month;
  if (type === "QUARTERLY") return Math.ceil(month / 3);
  if (type === "SEMI_ANNUAL") return month <= 6 ? 1 : 2;
  return 0;
};

const byYear = (submissions: PeriodSubmission[]): Map<number, PeriodSubmission[]> => {
  const grouped = new Map<number, PeriodSubmission[]>();
  for (const submission of submissions) {
    const list = grouped.get(submission.reporting_year) ?? [];
    list.push(submission);
    grouped.set(submission.reporting_year, list);
  }
  return grouped;
};

/** The frequency already fixed for a year by the cooperative's earlier submissions. */
export const yearLock = (submissions: PeriodSubmission[], year: number): YearLock | null => {
  const inYear = submissions.filter((s) => s.reporting_year === year);
  const first = inYear[0];
  if (!first) return null;
  return {
    year,
    periodType: toPeriodType(first.period_type),
    onlyDrafts: inYear.every((s) => (s.status ?? "").toLowerCase() === "draft"),
  };
};

export const periodReminders = (
  submissions: PeriodSubmission[],
  now: Date = new Date(),
): PeriodReminder[] => {
  const reminders: PeriodReminder[] = [];
  for (const [year, inYear] of byYear(submissions)) {
    const first = inYear[0];
    if (!first) continue;
    const periodType = toPeriodType(first.period_type);
    const present = new Set(
      inYear
        .filter((s) => toPeriodType(s.period_type) === periodType)
        .map((s) => normalizePeriodValue(periodType, s.period_value)),
    );
    const due = expectedPeriods(periodType).slice(0, periodsStarted(periodType, year, now));
    const missing = due.filter((period) => !present.has(period));
    if (missing.length > 0) reminders.push({ year, periodType, missing });
  }
  return reminders.sort((a, b) => b.year - a.year);
};

export const reminderKey = (reminder: PeriodReminder): string =>
  `${reminder.year}:${reminder.periodType}:${reminder.missing.join(",")}`;
