import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import {
  avgKpi,
  changeOf,
  chunk,
  groupBy,
  money,
  pointChange,
  sumKpi,
  toneOf,
} from "@/pages/shared/print/consolidated/stats";

const coop = (name: string, hasData: boolean, kpis: Record<string, number>): CoopKpiRow =>
  ({
    cooperative_id: name,
    name,
    has_data: hasData,
    kpis: Object.fromEntries(Object.entries(kpis).map(([k, value]) => [k, { value }])),
  }) as unknown as CoopKpiRow;

describe("consolidated report stats", () => {
  it("sums a KPI across cooperatives", () => {
    expect(
      sumKpi(
        [coop("a", true, { total_assets: 10 }), coop("b", true, { total_assets: 5 })],
        "total_assets",
      ),
    ).toBe(15);
  });

  it("averages only cooperatives that filed and have the KPI", () => {
    const coops = [
      coop("a", true, { par30: 2 }),
      coop("b", true, { par30: 4 }),
      coop("c", false, { par30: 90 }),
      coop("d", true, {}),
    ];

    expect(avgKpi(coops, "par30")).toBe(3);
  });

  it("returns null when nobody reported the KPI", () => {
    expect(avgKpi([coop("a", true, {})], "par30")).toBeNull();
  });

  it("reports change against a prior figure and nothing without one", () => {
    expect(changeOf(110, 100)).toEqual({ text: "+10.0%", tone: "up" });
    expect(changeOf(50, 0)).toBeNull();
  });

  it("reports ratio changes in percentage points", () => {
    expect(pointChange(3, 5)).toEqual({ text: "-2.0 pp", tone: "down" });
    expect(pointChange(null, 5)).toBeNull();
  });

  it("uses lower-is-better and higher-is-better benchmarks", () => {
    expect(toneOf("par30", 4)).toBe("ok");
    expect(toneOf("par30", 12)).toBe("bad");
    expect(toneOf("capital_adequacy_ratio", 9)).toBe("warn");
    expect(toneOf("roa", null)).toBe("na");
  });

  it("formats money compactly", () => {
    expect(money(2_500_000)).toBe("2.5 m");
    expect(money(950)).toBe("950");
    expect(money(undefined)).toBe("—");
  });

  it("groups and chunks lists", () => {
    expect([...groupBy([1, 2, 3], (n) => (n % 2 ? "odd" : "even")).keys()]).toEqual([
      "odd",
      "even",
    ]);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
