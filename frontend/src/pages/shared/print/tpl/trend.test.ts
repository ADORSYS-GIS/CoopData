import { describe, expect, it } from "vitest";

import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";
import { scaled, trendOf, unitFor } from "@/pages/shared/print/tpl/trend";

const point = (label: string, overrides: Partial<PeriodSeriesPoint> = {}): PeriodSeriesPoint =>
  ({
    period_label: label,
    assets: 1000,
    savings: 600,
    loans: 500,
    liquid_assets: 200,
    equity: 100,
    net_income: 30,
    arrears_1_30: 10,
    arrears_31_60: 10,
    arrears_61_90: 5,
    non_performing: 10,
    ...overrides,
  }) as PeriodSeriesPoint;

describe("trendOf", () => {
  it("computes PAR over 30 days from the 31-60, 61-90 and non-performing lines", () => {
    const [row] = trendOf([point("2025")]);

    expect(row?.par30).toBe(5);
  });

  it("computes liquidity and capital as shares of total assets", () => {
    const [row] = trendOf([point("2025")]);

    expect(row?.liquidity).toBe(20);
    expect(row?.capital).toBe(10);
  });

  it("returns null ratios when there are no loans", () => {
    const [row] = trendOf([point("2025", { loans: 0 })]);

    expect(row?.par30).toBeNull();
  });

  it("drops periods without a statement", () => {
    const rows = trendOf([point("2023", { assets: 0 }), point("2024")]);

    expect(rows.map((r) => r.label)).toEqual(["2024"]);
  });

  it("keeps only the latest periods, oldest first", () => {
    const points = Array.from({ length: 10 }, (_, i) => point(String(2016 + i)));

    const rows = trendOf(points, 8);

    expect(rows).toHaveLength(8);
    expect(rows[0]?.label).toBe("2018");
    expect(rows[7]?.label).toBe("2025");
  });

  it("handles a missing series", () => {
    expect(trendOf(undefined)).toEqual([]);
  });
});

describe("unitFor", () => {
  it("uses millions for large amounts and thousands for small ones", () => {
    expect(unitFor(2_500_000).label).toBe("USD million");
    expect(unitFor(80_000).label).toBe("USD thousand");
  });

  it("scales an amount to two decimals in the chosen unit", () => {
    expect(scaled(1_234_567, unitFor(2_000_000))).toBe(1.23);
    expect(scaled(45_600, unitFor(80_000))).toBe(45.6);
  });
});
