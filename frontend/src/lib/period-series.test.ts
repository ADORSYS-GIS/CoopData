import { describe, expect, it } from "vitest";

import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";
import { toProfitabilitySeries, toStructureSeries } from "@/lib/period-series";

const point = (overrides: Partial<PeriodSeriesPoint>): PeriodSeriesPoint => ({
  period_label: "Q1 2026",
  reporting_year: 2026,
  period_type: "QUARTERLY",
  period_value: "Q1",
  cooperatives_reporting: 2,
  assets: 1000,
  loans: 500,
  liquid_assets: 100,
  savings: 600,
  liabilities: 800,
  equity: 200,
  total_income: 90,
  total_expenses: 60,
  net_income: 30,
  arrears_1_30: 0,
  arrears_31_60: 0,
  arrears_61_90: 0,
  non_performing: 0,
  provisions: 0,
  borrowings: 100,
  share_capital: 0,
  reserves: 0,
  statutory_reserve: 0,
  retained_earnings: 0,
  financial_income: 0,
  other_income: 0,
  financial_expenses: 0,
  operating_expenses: 0,
  credit_loss_expense: 0,
  ...overrides,
});

describe("toStructureSeries", () => {
  it("expresses funding and deployment as a share of total assets", () => {
    const [first] = toStructureSeries([point({})]);

    expect(first?.values).toEqual({
      earning_asset_ratio: 60,
      member_savings_ratio: 60,
      borrowed_funds_ratio: 10,
    });
  });

  it("keeps the period label so the chart follows the frequency", () => {
    expect(toStructureSeries([point({})])[0]?.period_label).toBe("Q1 2026");
  });

  it("leaves ratios out when there are no assets", () => {
    expect(toStructureSeries([point({ assets: 0 })])[0]?.values).toEqual({});
  });

  it("uses borrowings only, not other liabilities", () => {
    const [first] = toStructureSeries([point({ liabilities: 900, savings: 600, borrowings: 50 })]);

    expect(first?.values.borrowed_funds_ratio).toBe(5);
  });
});

describe("toProfitabilitySeries", () => {
  it("carries net income, including losses", () => {
    const series = toProfitabilitySeries([point({ net_income: -12 })]);

    expect(series[0]?.values).toEqual({ net_income: -12 });
  });
});
