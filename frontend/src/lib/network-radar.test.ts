import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { buildNetworkRadar } from "@/lib/network-radar";

const kpi = (value: number, formatted = String(value)) => ({
  name: "",
  value,
  formatted,
  unit: "",
  status: null,
  benchmark: null,
  description: "",
});

const coop = (assets: number, roa: number, reported = true): CoopKpiRow =>
  ({
    has_data: true,
    kpis: {
      total_assets: kpi(assets),
      roa: reported ? kpi(roa) : kpi(0, "—"),
    },
  }) as unknown as CoopKpiRow;

describe("buildNetworkRadar", () => {
  it("weights each ratio by its assets instead of averaging", () => {
    const earnings = buildNetworkRadar([coop(900, 1), coop(100, 5)]).find(
      (s) => s.axis === "earnings",
    );

    expect(earnings?.ratio).toBeCloseTo(1.4, 5);
  });

  it("leaves out cooperatives that did not report the ratio", () => {
    const earnings = buildNetworkRadar([coop(500, 2), coop(500, 0, false)]).find(
      (s) => s.axis === "earnings",
    );

    expect(earnings?.ratio).toBeCloseTo(2, 5);
  });

  it("reports nothing rather than zero when no cooperative reports", () => {
    const spokes = buildNetworkRadar([coop(500, 0, false)]);

    expect(spokes.find((s) => s.axis === "earnings")).toEqual({
      axis: "earnings",
      ratio: null,
      score: null,
    });
  });
});
