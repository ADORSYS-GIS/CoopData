import { describe, expect, it } from "vitest";

import type { MonthlyTrendPoint } from "@/hooks/analytics/useMonthlyTrend";

import { latestReportedMonth } from "./trend-latest";

const month = (n: number, assets: number, liabilities = 0): MonthlyTrendPoint => ({
  month: n,
  month_label: `M${n}`,
  savings: 0,
  loans: 0,
  liquid_assets: 0,
  assets,
  liabilities,
  equity: assets - liabilities,
});

describe("latestReportedMonth", () => {
  it("returns the last month with balance-sheet data", () => {
    const months = [month(1, 100), month(2, 250), month(3, 0), month(4, 0)];

    expect(latestReportedMonth(months)?.month).toBe(2);
  });

  it("counts a month with liabilities but no assets as reported", () => {
    const months = [month(1, 100), month(2, 0, 40)];

    expect(latestReportedMonth(months)?.month).toBe(2);
  });

  it("returns undefined when no month has data", () => {
    expect(latestReportedMonth([month(1, 0), month(2, 0)])).toBeUndefined();
    expect(latestReportedMonth([])).toBeUndefined();
  });
});
