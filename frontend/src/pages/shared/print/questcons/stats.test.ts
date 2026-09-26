import { describe, expect, it } from "vitest";

import { complianceOf, coverageOf, marketSlices } from "@/pages/shared/print/questcons/stats";
import { concernsOf, recommendationsOf, strengthsOf } from "@/pages/shared/print/questcons/text";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import type { BasicDashboardResponse, CooperativeRow } from "@/types/basic-dashboard";

const row = (
  id: string,
  par: number | null,
  liquidity: number | null,
  capital: number | null,
): CooperativeRow =>
  ({
    cooperative_id: id,
    name: id,
    par_gt_30_pct: par,
    liquidity_ratio_pct: liquidity,
    institutional_capital_ratio_pct: capital,
  }) as CooperativeRow;

const dashboard = (rows: CooperativeRow[], inScope = rows.length): BasicDashboardResponse =>
  ({
    scope: {
      cooperatives_reporting: rows.length,
      cooperatives_in_scope: inScope,
      period_label: "2025",
      currency: "USD",
    },
    thresholds: { liquidity_minimum_pct: 15, institutional_capital_minimum_pct: 8 },
    indicators: [],
    series: {},
    demographics: {},
    market_share: {
      by_assets: [
        { cooperative_id: "a", name: "A", value: 60, share_pct: 60 },
        { cooperative_id: "b", name: "B", value: 40, share_pct: 40 },
      ],
      by_loans: [],
    },
    cooperatives: rows,
  }) as unknown as BasicDashboardResponse;

const rows = [
  row("a", 3, 20, 10),
  row("b", 7, 10, 9),
  row("c", 12, 15, 5),
  row("d", null, null, 8),
];

describe("complianceOf", () => {
  it("counts cooperatives that meet, miss or do not report each limit", () => {
    const c = complianceOf(dashboard(rows));

    expect(c.par30).toEqual({ meets: 1, below: 2, notReported: 1 });
    expect(c.liquidity).toEqual({ meets: 2, below: 1, notReported: 1 });
    expect(c.capital).toEqual({ meets: 3, below: 1, notReported: 0 });
  });

  it("splits cooperatives into PAR bands that add up to the total", () => {
    const { parBands } = complianceOf(dashboard(rows));

    expect(parBands).toEqual({ within: 1, watch: 1, above: 1, notReported: 1 });
  });
});

describe("coverageOf", () => {
  it("reports the filing rate and the cooperatives that did not file", () => {
    const cover = coverageOf(dashboard(rows, 8));

    expect(cover).toMatchObject({ reporting: 4, inScope: 8, missing: 4, rate: 50 });
  });

  it("handles an empty scope", () => {
    expect(coverageOf(dashboard([], 0)).rate).toBe(0);
  });
});

describe("marketSlices", () => {
  it("builds slices from the market share rows", () => {
    expect(marketSlices(dashboard(rows)).assets).toEqual([
      { label: "A", value: 60 },
      { label: "B", value: 40 },
    ]);
    expect(marketSlices(dashboard(rows)).loans).toEqual([]);
  });
});

describe("findings", () => {
  const analysis = (d: BasicDashboardResponse) =>
    analyseQuestionnaire({ dashboard: d, submissionId: "", coopName: "Fed", narratives: null });

  it("names the number of cooperatives outside each limit", () => {
    const concerns = concernsOf(analysis(dashboard(rows, 6)));

    expect(concerns.some((c) => c.startsWith("2 cooperatives have PAR"))).toBe(true);
    expect(concerns.some((c) => c.includes("2 cooperatives have no questionnaire return"))).toBe(
      true,
    );
  });

  it("lists strengths and no reporting recommendation when everything filed", () => {
    const d = dashboard([row("a", 3, 20, 10)]);

    expect(strengthsOf(analysis(d))[0]).toContain("The cooperative in scope filed");
    expect(recommendationsOf(analysis(d)).map((r) => r.lead)).not.toContain("Reporting coverage.");
  });
});
