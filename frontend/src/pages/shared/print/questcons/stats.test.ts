import { describe, expect, it } from "vitest";

import { complianceOf, coverageOf } from "@/pages/shared/print/questcons/stats";
import { concernsOf, recommendationsOf, strengthsOf } from "@/pages/shared/print/questcons/text";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import type { BasicDashboardResponse, CooperativeRow } from "@/types/basic-dashboard";

const row = (
  id: string,
  par: number | null,
  margin: number | null,
  reserve: number | null,
): CooperativeRow =>
  ({
    cooperative_id: id,
    name: id,
    par_gt_30_pct: par,
    total_operating_margin_pct: margin,
    monetary_reserve_coverage_pct: reserve,
  }) as CooperativeRow;

const dashboard = (rows: CooperativeRow[], inScope = rows.length): BasicDashboardResponse =>
  ({
    scope: {
      cooperatives_reporting: rows.length,
      cooperatives_in_scope: inScope,
      period_label: "2025",
      currency: "SZL",
    },
    thresholds: { liquidity_minimum_pct: 15, institutional_capital_minimum_pct: 8 },
    indicators: [],
    series: {},
    demographics: {},
    cooperatives: rows,
  }) as unknown as BasicDashboardResponse;

const rows = [
  row("a", 3, 20, 120),
  row("b", 7, -5, 90),
  row("c", 12, 0, 50),
  row("d", null, null, 100),
];

describe("complianceOf", () => {
  it("counts cooperatives that meet, miss or do not report each limit", () => {
    const c = complianceOf(dashboard(rows));

    expect(c.par30).toEqual({ meets: 1, below: 2, notReported: 1 });
    expect(c.operatingMargin).toEqual({ meets: 2, below: 1, notReported: 1 });
    expect(c.reserveCoverage).toEqual({ meets: 2, below: 2, notReported: 0 });
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
    const d = dashboard([row("a", 3, 20, 120)]);

    expect(strengthsOf(analysis(d))[0]).toContain("The cooperative in scope filed");
    expect(recommendationsOf(analysis(d)).map((r) => r.lead)).not.toContain("Reporting coverage.");
  });
});
