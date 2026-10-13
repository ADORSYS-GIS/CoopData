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

const zar = { currency: "SZL" };

describe("formatIndicatorValue", () => {
  it("formats currency in SZL without decimals", () => {
    expect(formatIndicatorValue(makeIndicator({ value: 3485818 }), zar)).toBe("SZL 3,485,818");
  });

  it("formats native currency with its code", () => {
    const text = formatIndicatorValue(makeIndicator({ value: 1500 }), { currency: "SZL" });
    expect(text).toContain("1,500");
    expect(text).toContain("SZL");
  });

  it("formats counts with separators and percents with precision", () => {
    expect(formatIndicatorValue(makeIndicator({ unit: "count", value: 6992 }), zar)).toBe("6,992");
    expect(formatIndicatorValue(makeIndicator({ unit: "percent", value: 2.944 }), zar)).toBe(
      "2.94%",
    );
    expect(formatIndicatorValue(makeIndicator({ unit: "percent", value: 71.41 }), zar)).toBe(
      "71.4%",
    );
    expect(formatIndicatorValue(makeIndicator({ unit: "ratio", value: 1.234 }), zar)).toBe("1.23");
  });

  it("shows a dash instead of zero when not reported", () => {
    const missing = makeIndicator({ value: null, status: "not_reported" });
    expect(isNotReported(missing)).toBe(true);
    expect(formatIndicatorValue(missing, zar)).toBe("—");
    expect(formatIndicatorValue(makeIndicator({ value: 0, status: "not_reported" }), zar)).toBe(
      "—",
    );
  });

  it("keeps a genuine zero when the value is reported", () => {
    expect(formatIndicatorValue(makeIndicator({ unit: "count", value: 0 }), zar)).toBe("0");
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
      group: "coa",
      key: "debt_to_equity_ratio",
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
    expect(grouped.risk.map((i) => i.key)).toEqual(["par_gt_30_pct", "loan_recovery_rate_pct"]);
    expect(grouped.savings).toHaveLength(1);
    expect(grouped.training).toEqual([]);
  });

  it("finds an indicator by key", () => {
    expect(indicatorByKey(basicDashboardFixture.indicators, "meetings_held_count")?.value).toBe(
      6992,
    );
    expect(indicatorByKey(basicDashboardFixture.indicators, "nope")).toBeUndefined();
  });
});

describe("series mapping", () => {
  it("maps points to chart rows and nulls out missing values", () => {
    const rows = seriesToChartData(basicDashboardFixture.series.risk, [
      "par_gt_30_pct",
      "loan_recovery_rate_pct",
    ]);
    expect(rows[0]).toEqual({
      label: "Q1 2025",
      par_gt_30_pct: 5.3,
      loan_recovery_rate_pct: null,
    });
  });

  it("detects whether any requested key has data", () => {
    expect(hasSeriesData(basicDashboardFixture.series.risk, ["par_gt_30_pct"])).toBe(true);
    expect(hasSeriesData(basicDashboardFixture.series.risk, ["loan_recovery_rate_pct"])).toBe(
      false,
    );
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
    expect(sortRows(rows, "total_members", "desc")[0].name).toBe("SNAT");
  });

  it("colours PAR and minimum-based ratios", () => {
    expect(parTone(3)).toBe("good");
    expect(parTone(8)).toBe("warn");
    expect(parTone(12)).toBe("bad");
    expect(parTone(null)).toBe("neutral");
    expect(minimumTone(9, 15)).toBe("bad");
    expect(minimumTone(15, 15)).toBe("good");
  });

  it("no longer describes a conversion rate (conversion is removed)", () => {
    expect(rateNote(basicDashboardFixture.scope)).toBeNull();
    expect(rateNote({ ...basicDashboardFixture.scope, currency: "SZL" })).toBeNull();
  });
});

describe("women share", () => {
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
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({});
    expect(
      filtersToParams({
        ...DEFAULT_FILTERS,
        year: "2026",
        periodType: "QUARTERLY",
        periodValue: "Q1",
        region: "Manzini",
        cooperativeId: "abc",
      }),
    ).toEqual({
      reportingYear: 2026,
      periodType: "QUARTERLY",
      periodValue: "Q1",
      region: "Manzini",
      cooperativeId: "abc",
    });
  });
});
