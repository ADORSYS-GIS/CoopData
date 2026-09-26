import { describe, expect, it } from "vitest";

import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import {
  checksOf,
  concernsOf,
  recommendationsOf,
  verdictOf,
} from "@/pages/shared/print/quest/text";
import type { BasicDashboardResponse, IndicatorValue } from "@/types/basic-dashboard";

const ind = (
  key: string,
  value: number | null,
  group: IndicatorValue["group"] = "risk",
): IndicatorValue => ({
  key,
  group,
  value,
  unit: "percent",
  status: value === null ? "not_reported" : "computed",
  previous: null,
  change_pct: null,
  formula: "",
  sources: [],
  note: null,
});

const analysis = (values: Record<string, number | null>) =>
  analyseQuestionnaire({
    submissionId: "abcde123",
    coopName: "Test Coop",
    dashboard: {
      scope: { reporting_year: 2026, period_label: "Q1 2026", currency: "SZL" },
      thresholds: { liquidity_minimum_pct: 15, institutional_capital_minimum_pct: 8 },
      indicators: Object.entries(values).map(([key, value]) => ind(key, value)),
      series: {},
    } as unknown as BasicDashboardResponse,
  });

describe("checksOf", () => {
  it("rates PAR, liquidity and capital against their limits", () => {
    const checks = checksOf(
      analysis({ par_gt_30_pct: 4, liquidity_ratio_pct: 12, institutional_capital_ratio_pct: 3 }),
    );

    expect(checks).toEqual({ par30: "ok", liquidity: "warn", capital: "bad" });
  });

  it("leaves an unreported indicator unrated", () => {
    expect(checksOf(analysis({ par_gt_30_pct: null })).par30).toBe("na");
  });
});

describe("verdictOf and recommendations", () => {
  it("calls the cooperative sound when every minimum is met", () => {
    const a = analysis({
      par_gt_30_pct: 2,
      liquidity_ratio_pct: 20,
      institutional_capital_ratio_pct: 10,
    });

    expect(verdictOf(a).verdict).toMatch(/^Sound/);
    expect(concernsOf(a)).toEqual([]);
  });

  it("asks for corrective action and names the failing measures", () => {
    const a = analysis({
      par_gt_30_pct: 12,
      liquidity_ratio_pct: 5,
      institutional_capital_ratio_pct: 10,
    });

    expect(verdictOf(a).verdict).toMatch(/corrective action/);
    expect(recommendationsOf(a).map((r) => r.lead)).toEqual(
      expect.arrayContaining(["Portfolio quality.", "Liquidity."]),
    );
  });

  it("flags indicators that could not be computed", () => {
    const a = analysis({ par_gt_30_pct: 2, par_gt_90_pct: null });

    expect(concernsOf(a).some((c) => c.includes("Annex A"))).toBe(true);
  });
});
