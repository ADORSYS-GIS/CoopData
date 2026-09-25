import { describe, expect, it } from "vitest";

import {
  compactNumber,
  deltaDirection,
  deltaTone,
  formatDelta,
  formatIndicatorValue,
  groupIndicators,
  hasSeriesData,
  indicatorByKey,
  isNotReported,
  minimumTone,
  parTone,
  rateNote,
  seriesToChartData,
  sortRows,
  topShares,
  womenSharePct,
} from "@/lib/basic-dashboard";
import {
  DEFAULT_FILTERS,
  filtersToParams,
  periodOptions,
  periodTypeOptions,
  yearOptions,
} from "@/lib/basic-dashboard-filters";
import { basicDashboardFixture, makeIndicator } from "@/test-fixtures/basicDashboard";

const usd = { currency: "USD" };

describe("formatIndicatorValue", () => {
  it("formats currency in USD without decimals", () => {
    expect(formatIndicatorValue(makeIndicator({ value: 3485818 }), usd)).toBe("$3,485,818");
  });

  it("formats native currency with its code", () => {
    const text = formatIndicatorValue(makeIndicator({ value: 1500 }), { currency: "SZL" });
    expect(text).toContain("1,500");
    expect(text).toContain("SZL");
  });

  it("formats counts with separators and percents with precision", () => {
    expect(formatIndicatorValue(makeIndicator({ unit: "count", value: 6992 }), usd)).toBe("6,992");
    expect(formatIndicatorValue(makeIndicator({ unit: "percent", value: 2.944 }), usd)).toBe(
      "2.94%",
    );
    expect(formatIndicatorValue(makeIndicator({ unit: "percent", value: 71.41 }), usd)).toBe(
      "71.4%",
    );
    expect(formatIndicatorValue(makeIndicator({ unit: "ratio", value: 1.234 }), usd)).toBe("1.23");
  });

  it("shows a dash instead of zero when not reported", () => {
    const missing = makeIndicator({ value: null, status: "not_reported" });
    expect(isNotReported(missing)).toBe(true);
    expect(formatIndicatorValue(missing, usd)).toBe("—");
    expect(formatIndicatorValue(makeIndicator({ value: 0, status: "not_reported" }), usd)).toBe(
      "—",
    );
  });

  it("keeps a genuine zero when the value is reported", () => {
    expect(formatIndicatorValue(makeIndicator({ unit: "count", value: 0 }), usd)).toBe("0");
  });
});

describe("delta semantics", () => {
  it("treats a rise in a risk metric as bad and a fall as good", () => {
    const par = makeIndicator({ group: "risk", key: "par_gt_30_pct", change_pct: 5 });
    expect(deltaTone(par)).toBe("bad");
    expect(deltaTone({ ...par, change_pct: -5 })).toBe("good");
  });

  it("treats a rise in a normal metric as good", () => {
    const loans = makeIndicator({ change_pct: 3 });
    expect(deltaTone(loans)).toBe("good");
    expect(deltaTone({ ...loans, change_pct: -3 })).toBe("bad");
  });

  it("treats borrowed funds ratio and inactive members as worse when they rise", () => {
    const borrowed = makeIndicator({
      group: "structure",
      key: "borrowed_funds_ratio",
      change_pct: 2,
    });
    expect(deltaTone(borrowed)).toBe("bad");
  });

  it("is neutral without a previous value", () => {
    expect(deltaTone(makeIndicator({ change_pct: null }))).toBe("neutral");
    expect(deltaTone(makeIndicator({ change_pct: 0 }))).toBe("neutral");
  });

  it("formats deltas and directions", () => {
    expect(formatDelta(3.24)).toBe("+3.2%");
    expect(formatDelta(-1.5)).toBe("-1.5%");
    expect(formatDelta(null)).toBeNull();
    expect(deltaDirection(2)).toBe("up");
    expect(deltaDirection(-2)).toBe("down");
    expect(deltaDirection(null)).toBe("flat");
  });
});

describe("groupIndicators", () => {
  it("groups by indicator group and follows the display order", () => {
    const grouped = groupIndicators(basicDashboardFixture.indicators);
    expect(grouped.risk.map((i) => i.key)).toEqual(["par_gt_30_pct", "par_gt_90_pct"]);
    expect(grouped.loans).toHaveLength(1);
    expect(grouped.governance).toEqual([]);
  });

  it("finds an indicator by key", () => {
    expect(indicatorByKey(basicDashboardFixture.indicators, "registered_members")?.value).toBe(
      6992,
    );
    expect(indicatorByKey(basicDashboardFixture.indicators, "nope")).toBeUndefined();
  });
});

describe("series mapping", () => {
  it("maps points to chart rows and nulls out missing values", () => {
    const rows = seriesToChartData(basicDashboardFixture.series.par_trend, [
      "par_gt_30_pct",
      "par_gt_90_pct",
    ]);
    expect(rows[0]).toEqual({ label: "Q1 2025", par_gt_30_pct: 5.3, par_gt_90_pct: null });
  });

  it("detects whether any requested key has data", () => {
    expect(hasSeriesData(basicDashboardFixture.series.par_trend, ["par_gt_30_pct"])).toBe(true);
    expect(hasSeriesData(basicDashboardFixture.series.par_trend, ["par_gt_90_pct"])).toBe(false);
    expect(hasSeriesData(undefined, ["x"])).toBe(false);
  });

  it("compacts axis numbers", () => {
    expect(compactNumber(3_485_818)).toBe("3.5M");
    expect(compactNumber(2_500)).toBe("3K");
    expect(compactNumber(42)).toBe("42");
  });
});

describe("ranking helpers", () => {
  it("sorts numbers, strings and pushes nulls last", () => {
    const rows = basicDashboardFixture.cooperatives;
    expect(sortRows(rows, "par_gt_30_pct", "asc").map((r) => r.name)).toEqual(["SNAT", "Bunye"]);
    expect(sortRows(rows, "par_gt_30_pct", "desc").map((r) => r.name)).toEqual(["SNAT", "Bunye"]);
    expect(sortRows(rows, "name", "asc")[0].name).toBe("Bunye");
    expect(sortRows(rows, "total_assets", "desc")[0].name).toBe("SNAT");
  });

  it("colours PAR and minimum-based ratios", () => {
    expect(parTone(3)).toBe("good");
    expect(parTone(8)).toBe("warn");
    expect(parTone(12)).toBe("bad");
    expect(parTone(null)).toBe("neutral");
    expect(minimumTone(9, 15)).toBe("bad");
    expect(minimumTone(15, 15)).toBe("good");
  });

  it("describes the conversion rate only for USD scopes", () => {
    expect(rateNote(basicDashboardFixture.scope)).toBe("1 USD = 18.5 SZL");
    expect(rateNote({ ...basicDashboardFixture.scope, currency: "SZL" })).toBeNull();
  });
});

describe("share helpers", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    cooperative_id: String(i),
    name: `Coop ${i}`,
    value: 100 - i,
    share_pct: 10 - i * 0.5,
  }));

  it("keeps everything when there are few slices", () => {
    expect(topShares(rows.slice(0, 3), 9, "Other")).toHaveLength(3);
  });

  it("groups the smallest slices into Other and preserves the total share", () => {
    const slices = topShares(rows, 5, "Other");
    expect(slices).toHaveLength(5);
    expect(slices[4].name).toBe("Other");
    const original = rows.reduce((sum, r) => sum + r.share_pct, 0);
    const grouped = slices.reduce((sum, s) => sum + s.share_pct, 0);
    expect(grouped).toBeCloseTo(original, 6);
  });

  it("computes the women share and returns null with no members", () => {
    expect(womenSharePct({ male: 3, female: 1 })).toBe(25);
    expect(womenSharePct({ male: 0, female: 0 })).toBeNull();
  });
});

describe("filters", () => {
  const { available_periods: periods } = basicDashboardFixture.scope;

  it("lists every year back to 2000 and keeps years that already have data", () => {
    const years = yearOptions(periods, 2026);

    expect(years[0]).toBe("2027");
    expect(years).toContain("2005");
    expect(years[years.length - 1]).toBe("2000");
    expect(new Set(years).size).toBe(years.length);
  });

  it("derives period type and period options from the available periods", () => {
    expect(periodTypeOptions(periods)).toEqual(["QUARTERLY"]);
    expect(periodOptions(periods, "2025", "all").map((p) => p.period_value)).toEqual(["Q4"]);
  });

  it("omits unset filters when building request params", () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({ currency: "usd" });
    expect(
      filtersToParams({
        ...DEFAULT_FILTERS,
        year: "2026",
        periodType: "QUARTERLY",
        periodValue: "Q1",
        region: "Manzini",
        cooperativeId: "abc",
        currency: "native",
      }),
    ).toEqual({
      currency: "native",
      reportingYear: 2026,
      periodType: "QUARTERLY",
      periodValue: "Q1",
      region: "Manzini",
      cooperativeId: "abc",
    });
  });
});
