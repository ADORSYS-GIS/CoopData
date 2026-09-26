import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";
import type { SeriesPoint } from "@/types/basic-dashboard";

const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

const toSeriesPoint = (
  point: PeriodSeriesPoint,
  values: Record<string, number | null>,
): SeriesPoint => ({
  period_label: point.period_label,
  reporting_year: point.reporting_year,
  period_type: point.period_type,
  period_value: point.period_value,
  values: Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null),
  ),
});

/**
 * How assets are funded and deployed, as a share of total assets. Member shares
 * are not reported in the financial statements, so that band is left out.
 */
export const toStructureSeries = (points: readonly PeriodSeriesPoint[]): SeriesPoint[] =>
  points.map((p) =>
    toSeriesPoint(p, {
      earning_asset_ratio: ratio(p.loans + p.liquid_assets, p.assets),
      member_savings_ratio: ratio(p.savings, p.assets),
      borrowed_funds_ratio: ratio(p.borrowings, p.assets),
    }),
  );

export const toProfitabilitySeries = (points: readonly PeriodSeriesPoint[]): SeriesPoint[] =>
  points.map((p) => toSeriesPoint(p, { net_income: p.net_income }));
