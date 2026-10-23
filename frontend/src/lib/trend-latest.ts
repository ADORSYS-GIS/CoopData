import type { MonthlyTrendPoint } from "@/hooks/analytics/useMonthlyTrend";

/**
 * The most recent month that carries balance-sheet data. Months with neither assets
 * nor liabilities are periods no approved statement covers yet, not real zeros.
 */
export const latestReportedMonth = (
  months: readonly MonthlyTrendPoint[],
): MonthlyTrendPoint | undefined =>
  [...months].reverse().find((m) => m.assets !== 0 || (m.liabilities ?? 0) !== 0);
