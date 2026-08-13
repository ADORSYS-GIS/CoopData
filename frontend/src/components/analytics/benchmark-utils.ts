import type { BenchmarkMetric, BenchmarkRow } from "@/components/analytics/benchmark-types";

/** Shared averaging helper — used for the national, regional, sector and
 *  sector+regional slices to avoid duplicating the averaging math. */
export function computeKpiAverages(
  rows: BenchmarkRow[],
  metrics: BenchmarkMetric[],
  getValue: (row: BenchmarkRow, metricKey: string) => number,
): Record<string, number> {
  const averages: Record<string, number> = {};
  metrics.forEach((metric) => {
    const vals = rows.map((c) => getValue(c, metric.key)).filter((v) => !isNaN(v));
    averages[metric.key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });
  return averages;
}
