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

/** Formats a benchmark value; amounts are shortened to K / M whatever their sign. */
export function formatBenchmarkValue(val: number, unit: string): string {
  if (unit === "%") return `${val.toFixed(2)}%`;
  if (unit === "count") return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(val) >= 1_000_000) return `SZL ${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `SZL ${(val / 1_000).toFixed(1)}K`;
  return `SZL ${val.toFixed(2)}`;
}
