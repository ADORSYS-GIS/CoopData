import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";

/** Periods shown in a report trend; older points are dropped. */
export const TREND_LIMIT = 8;

export const PAR30_LIMIT = 5;
export const LIQUIDITY_MINIMUM = 15;
export const CAPITAL_MINIMUM = 10;

export interface TrendRow {
  label: string;
  assets: number;
  savings: number;
  loans: number;
  /** Loans overdue 31-60 days, 61-90 days and non-performing. */
  overdue: { d31to60: number; d61to90: number; nonPerforming: number };
  surplus: number;
  par30: number | null;
  liquidity: number | null;
  capital: number | null;
}

const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

/**
 * One row per period that carries a statement, oldest first. PAR over 30 days is
 * the 31-60, 61-90 and non-performing loan lines over gross loans; liquidity and
 * capital are shares of total assets.
 */
export const trendOf = (
  points: readonly PeriodSeriesPoint[] | undefined,
  limit = TREND_LIMIT,
): TrendRow[] =>
  (points ?? [])
    .filter((point) => point.assets > 0)
    .slice(-limit)
    .map((point) => ({
      label: point.period_label,
      assets: point.assets,
      savings: point.savings,
      loans: point.loans,
      overdue: {
        d31to60: point.arrears_31_60,
        d61to90: point.arrears_61_90,
        nonPerforming: point.non_performing,
      },
      surplus: point.net_income,
      par30: ratio(point.arrears_31_60 + point.arrears_61_90 + point.non_performing, point.loans),
      liquidity: ratio(point.liquid_assets, point.assets),
      capital: ratio(point.equity, point.assets),
    }));

export interface AmountUnit {
  divisor: number;
  label: string;
}

/** Millions for large amounts, thousands for small ones, so small figures do not round to zero. */
export const unitFor = (largest: number): AmountUnit =>
  largest >= 1_000_000
    ? { divisor: 1_000_000, label: "USD million" }
    : { divisor: 1_000, label: "USD thousand" };

/** Amount in the chosen unit, to two decimals. */
export const scaled = (value: number, unit: AmountUnit): number =>
  Math.round((value / unit.divisor) * 100) / 100;
