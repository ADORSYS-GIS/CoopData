import { describe, expect, it } from "vitest";

import {
  hasHistory,
  methodologyIndicators,
  narrativeText,
  pickIndicators,
  reportCode,
  reportedShare,
  seriesLabelKey,
} from "@/lib/questionnaire-report";
import type { IndicatorValue, SeriesPoint } from "@/types/basic-dashboard";

const indicator = (key: string, overrides: Partial<IndicatorValue> = {}): IndicatorValue => ({
  key,
  group: "risk",
  value: 10,
  unit: "count",
  status: "computed",
  previous: null,
  change_pct: null,
  formula: "",
  sources: [],
  note: null,
  ...overrides,
});

describe("questionnaire report helpers", () => {
  it("picks indicators in the requested order and skips unknown keys", () => {
    const list = [indicator("b"), indicator("a")];
    expect(pickIndicators(list, ["a", "missing", "b"]).map((i) => i.key)).toEqual(["a", "b"]);
  });

  it("flags estimated and not reported indicators for the methodology page", () => {
    const list = [
      indicator("ok"),
      indicator("est", { status: "approximate" }),
      indicator("gone", { status: "not_reported", value: null }),
    ];
    expect(methodologyIndicators(list).map((i) => i.key)).toEqual(["est", "gone"]);
  });

  it("counts reported indicators", () => {
    const list = [indicator("a"), indicator("b", { status: "not_reported", value: null })];
    expect(reportedShare(list)).toEqual({ reported: 1, total: 2 });
  });

  it("returns narrative text only when it has content", () => {
    const narratives = {
      executive_summary: "  Strong year. ",
      membership_governance: "   ",
      portfolio_quality: "",
      liquidity_capital: "x",
      financial_structure_profitability: "y",
      outlook_recommendations: "z",
    };
    expect(narrativeText(narratives, "executive_summary")).toBe("Strong year.");
    expect(narrativeText(narratives, "membership_governance")).toBeUndefined();
    expect(narrativeText(null, "portfolio_quality")).toBeUndefined();
  });

  it("maps series value names to translation key suffixes", () => {
    expect(seriesLabelKey("maintained_pct")).toBe("maintained");
    expect(seriesLabelKey("ratio_pct")).toBe("capital");
    expect(seriesLabelKey("unknown_name")).toBe("unknown_name");
  });

  it("needs two points before a trend is shown", () => {
    const point = { period_label: "Q1", values: {} } as unknown as SeriesPoint;
    expect(hasHistory([point])).toBe(false);
    expect(hasHistory([point, point])).toBe(true);
    expect(hasHistory(undefined)).toBe(false);
  });

  it("uses the submission's own reference when it has one", () => {
    expect(reportCode(2025, "cb675a39-53bf", "SUB-2025-00002")).toBe("SUB-2025-00002");
  });

  it("builds a report code from the year and submission id", () => {
    expect(reportCode(2026, "abcde12345")).toBe("SUB-2026-ABCDE");
    expect(reportCode(null, "abcde12345")).toBe("SUB------ABCDE");
  });
});
