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
  it("rates PAR against its limit", () => {
    expect(checksOf(analysis({ par_gt_30_pct: 4 }))).toEqual({ par30: "ok" });
    expect(checksOf(analysis({ par_gt_30_pct: 12 }))).toEqual({ par30: "bad" });
  });

  it("leaves an unreported indicator unrated", () => {
    expect(checksOf(analysis({ par_gt_30_pct: null })).par30).toBe("na");
  });
});

describe("verdictOf and recommendations", () => {
  it("calls the cooperative sound when the limits are met", () => {
    const a = analysis({
      par_gt_30_pct: 2,
      total_operating_margin_pct: 10,
      monetary_reserve_coverage_pct: 120,
    });

    expect(verdictOf(a).verdict).toMatch(/^Sound/);
    expect(concernsOf(a)).toEqual([]);
  });

  it("asks for corrective action and names the failing measures", () => {
    const a = analysis({
      par_gt_30_pct: 12,
      total_operating_margin_pct: -5,
    });

    expect(verdictOf(a).verdict).toMatch(/corrective action/);
    expect(recommendationsOf(a).map((r) => r.lead)).toEqual(
      expect.arrayContaining(["Portfolio quality.", "Operating performance."]),
    );
  });

  it("flags indicators that could not be computed", () => {
    const a = analysis({ par_gt_30_pct: 2, loan_recovery_rate_pct: null });

    expect(concernsOf(a).some((c) => c.includes("Annex A"))).toBe(true);
  });
});
