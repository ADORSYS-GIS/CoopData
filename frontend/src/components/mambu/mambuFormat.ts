export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const itemTone = (status: string): StatusTone => {
  switch (status) {
    case "synced":
      return "success";
    case "flagged":
      return "warning";
    case "failed":
      return "danger";
    case "running":
      return "info";
    default:
      return "neutral";
  }
};

export const runTone = (status: string): StatusTone => {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "info";
  return "neutral";
};

/** Month 0 is a whole-year sync: one "Full 12 Mo" return per SACCO. */
export const WHOLE_YEAR = 0;

export const periodLabel = (year: number, month: number): string =>
  month === WHOLE_YEAR ? `Whole year ${year}` : `${MONTH_NAMES[month - 1] ?? month} ${year}`;

export const previousMonth = (now: Date): { year: number; month: number } => {
  const month = now.getMonth();
  return month === 0
    ? { year: now.getFullYear() - 1, month: 12 }
    : { year: now.getFullYear(), month };
};
