export type PeriodType = "YEARLY" | "QUARTERLY" | "MONTHLY" | "SEMI_ANNUAL";

export interface PeriodSubmission {
  reporting_year: number;
  fiscal_start_month?: number | null;
  period_type?: string | null;
  period_value?: string | null;
  status?: string | null;
  submission_method?: string | null;
}

export interface YearLock {
  year: number;
  periodType: PeriodType;
  onlyDrafts: boolean;
  /** Month (1-12) the year's quarters or halves start in, once one exists. */
  fiscalStartMonth?: number;
  /** Periods of the year that already have a submission ("Q2", "03", "FULL_YEAR"...). */
  taken: string[];
}

export interface PeriodReminder {
  year: number;
  periodType: PeriodType;
  missing: string[];
}

/** Short English month names, January first. */
export const MONTH_NAMES = [
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

/**
 * What a year already fixes through the cooperative's earlier submissions: its
 * frequency, the start month of its quarters or halves, and the periods taken.
 */
export const yearLock = (submissions: PeriodSubmission[], year: number): YearLock | null => {
  const inYear = submissions.filter((s) => s.reporting_year === year);
  const first = inYear[0];
  if (!first) return null;
  const periodType = toPeriodType(first.period_type);
  const withStart = inYear.find(
    (s) => toPeriodType(s.period_type) !== "YEARLY" && s.fiscal_start_month,
  );
  return {
    year,
    periodType,
    onlyDrafts: inYear.every((s) => (s.status ?? "").toLowerCase() === "draft"),
    fiscalStartMonth: withStart?.fiscal_start_month ?? undefined,
    taken: inYear
      .filter((s) => toPeriodType(s.period_type) === periodType)
      .map((s) =>
        periodType === "YEARLY" ? String(year) : normalizePeriodValue(periodType, s.period_value),
      ),
  };
};

export type CreateBlock =
  | { reason: "frequency"; periodType: PeriodType }
  | { reason: "startMonth"; month: number }
  | { reason: "taken"; period: string }
  | { reason: "allTaken"; periodType: PeriodType }
  | { reason: "fullYearOverlap" };

/**
 * Why a new submission cannot be created with this choice, or `null` when it
 * can. Mirrors the backend checks so the button explains itself instead of
 * failing on click.
 */
export const createBlock = (
  lock: YearLock | null,
  periodType: PeriodType,
  periodValue: string,
  fiscalStartMonth: number,
): CreateBlock | null => {
  if (!lock) return null;
  if (lock.periodType !== periodType) return { reason: "frequency", periodType: lock.periodType };
  if (
    periodType !== "YEARLY" &&
    periodType !== "MONTHLY" &&
    lock.fiscalStartMonth !== undefined &&
    lock.fiscalStartMonth !== fiscalStartMonth
  ) {
    return { reason: "startMonth", month: lock.fiscalStartMonth };
  }
  const value =
    periodType === "YEARLY" ? String(lock.year) : normalizePeriodValue(periodType, periodValue);
  const expected = periodType === "YEARLY" ? [String(lock.year)] : expectedPeriods(periodType);
  const allTaken =
    lock.taken.includes("FULL_YEAR") || expected.every((p) => lock.taken.includes(p));
  if (allTaken && periodType !== "YEARLY") return { reason: "allTaken", periodType };
  if (lock.taken.includes(value)) return { reason: "taken", period: value };
  if (
    periodType === "MONTHLY" &&
    lock.taken.length > 0 &&
    (value === "FULL_YEAR" || lock.taken.includes("FULL_YEAR"))
  ) {
    return { reason: "fullYearOverlap" };
  }
  return null;
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

export type PeriodState = "approved" | "in_review" | "draft" | "missing";

export interface YearPeriod {
  /** "Q1", "H2", "03" or the year for a yearly return. */
  period: string;
  state: PeriodState;
}

export interface YearProgress {
  cooperativeId: string;
  year: number;
  periodType: PeriodType;
  periods: YearPeriod[];
  approved: number;
  expected: number;
  /** Every period approved: the year counts in dashboards, analytics and reports. */
  complete: boolean;
  /**
   * Id of the last period's approved submission once the year is complete: the
   * backend builds the full year's figures from it (`scope=year`).
   */
  anchorId?: string;
}

export interface YearProgressSubmission extends PeriodSubmission {
  id?: string;
  cooperative_id?: string | null;
}

const REVIEW_STATUSES = new Set([
  "submitted",
  "in_review",
  "apex_review",
  "federation_review",
  "ministry_review",
  "escalated",
]);
const DRAFT_STATUSES = new Set(["draft", "returned", "synced", "sync_failed"]);
const STATE_RANK: Record<PeriodState, number> = { missing: 0, draft: 1, in_review: 2, approved: 3 };

const stateOf = (status?: string | null): PeriodState => {
  const value = (status ?? "").toLowerCase();
  if (value === "approved") return "approved";
  if (REVIEW_STATUSES.has(value)) return "in_review";
  if (DRAFT_STATUSES.has(value)) return "draft";
  return "missing";
};

const FREQUENCY_ORDER: readonly PeriodType[] = ["YEARLY", "SEMI_ANNUAL", "QUARTERLY", "MONTHLY"];

const progressFor = (
  cooperativeId: string,
  year: number,
  periodType: PeriodType,
  inYear: YearProgressSubmission[],
): YearProgress => {
  const expected = periodType === "YEARLY" ? [String(year)] : expectedPeriods(periodType);
  const states = new Map<string, PeriodState>(expected.map((period) => [period, "missing"]));
  const approvedIds = new Map<string, string>();
  for (const submission of inYear) {
    if (toPeriodType(submission.period_type) !== periodType) continue;
    const value = normalizePeriodValue(periodType, submission.period_value);
    const covered = periodType === "YEARLY" ? expected : value === "FULL_YEAR" ? expected : [value];
    const state = stateOf(submission.status);
    for (const period of covered) {
      const current = states.get(period);
      if (current !== undefined && STATE_RANK[state] > STATE_RANK[current]) {
        states.set(period, state);
      }
      if (state === "approved" && submission.id) approvedIds.set(period, submission.id);
    }
  }
  const periods = expected.map((period) => ({ period, state: states.get(period) ?? "missing" }));
  const approved = periods.filter((p) => p.state === "approved").length;
  const complete = approved === expected.length;
  const lastPeriod = expected[expected.length - 1];
  return {
    cooperativeId,
    year,
    periodType,
    periods,
    approved,
    expected: expected.length,
    complete,
    anchorId: complete && lastPeriod ? approvedIds.get(lastPeriod) : undefined,
  };
};

/**
 * Progress of each cooperative year, newest first. Mirrors
 * `services::reporting_year` on the backend: a year counts only once every
 * period of its frequency is approved, whatever the order they were filed in.
 */
export const yearProgress = (submissions: YearProgressSubmission[]): YearProgress[] => {
  const groups = new Map<string, YearProgressSubmission[]>();
  for (const submission of submissions) {
    const key = `${submission.cooperative_id ?? ""}|${submission.reporting_year}`;
    const list = groups.get(key) ?? [];
    list.push(submission);
    groups.set(key, list);
  }
  const result: YearProgress[] = [];
  for (const inYear of groups.values()) {
    const first = inYear[0];
    if (!first) continue;
    const types = FREQUENCY_ORDER.filter((type) =>
      inYear.some((s) => toPeriodType(s.period_type) === type),
    );
    const candidates = types.map((type) =>
      progressFor(first.cooperative_id ?? "", first.reporting_year, type, inYear),
    );
    const chosen =
      candidates.find((c) => c.complete) ??
      candidates.reduce<YearProgress | undefined>(
        (best, c) => (!best || c.approved / c.expected > best.approved / best.expected ? c : best),
        undefined,
      );
    if (chosen) result.push(chosen);
  }
  return result.sort((a, b) => b.year - a.year || a.cooperativeId.localeCompare(b.cooperativeId));
};

/** "Mar" for a monthly period, the period itself otherwise. */
export const periodDisplayName = (progress: YearProgress, period: string): string => {
  if (progress.periodType !== "MONTHLY") return period;
  return MONTH_NAMES[Number(period) - 1] ?? period;
};

/** i18n keys of the frequency names shown next to a year. */
export const FREQUENCY_LABEL_KEYS = {
  YEARLY: "reportingYears.frequency.yearly",
  QUARTERLY: "reportingYears.frequency.quarterly",
  MONTHLY: "reportingYears.frequency.monthly",
  SEMI_ANNUAL: "reportingYears.frequency.semiAnnual",
} as const;

export interface PeriodChoice {
  periodType: PeriodType;
  periodValue: string;
  fiscalStartMonth?: number;
}

/**
 * The choice the "new submission" dialog starts from for a year: the year's
 * frequency and start month, and its first period not created yet. `null` for
 * a year with no submission (the user chooses freely).
 */
export const choiceForYear = (lock: YearLock | null, year: number): PeriodChoice | null => {
  if (!lock) return null;
  if (lock.periodType === "YEARLY") return { periodType: "YEARLY", periodValue: String(year) };
  const free = expectedPeriods(lock.periodType).find((p) => !lock.taken.includes(p));
  return {
    periodType: lock.periodType,
    periodValue: free ?? expectedPeriods(lock.periodType)[0] ?? "",
    fiscalStartMonth: lock.fiscalStartMonth,
  };
};
