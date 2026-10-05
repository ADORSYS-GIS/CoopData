import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { compareWithPeers } from "@/pages/shared/print/coop/peers";

const coop = (id: string, apex: string, par30: number, roa: number, hasData = true): CoopKpiRow =>
  ({
    cooperative_id: id,
    apex_id: apex,
    has_data: hasData,
    kpis: { par30: { value: par30 }, roa: { value: roa } },
  }) as unknown as CoopKpiRow;

const peers = [
  coop("a", "x", 2, 4),
  coop("b", "x", 6, 2),
  coop("c", "x", 9, 1),
  coop("d", "y", 1, 5),
  coop("e", "y", 3, 3, false),
];

const row = (comparison: ReturnType<typeof compareWithPeers>, key: string) =>
  comparison?.rows.find((r) => r.key === key);

describe("compareWithPeers", () => {
  it("ranks a lower PAR as better", () => {
    const comparison = compareWithPeers("b", "x", peers);

    expect(row(comparison, "par30")?.apexRank).toEqual({ position: 2, of: 3 });
    expect(row(comparison, "par30")?.nationalRank).toEqual({ position: 3, of: 4 });
  });

  it("ranks a higher return as better", () => {
    const comparison = compareWithPeers("a", "x", peers);

    expect(row(comparison, "roa")?.apexRank).toEqual({ position: 1, of: 3 });
  });

  it("averages over the apex and over every cooperative that filed", () => {
    const comparison = compareWithPeers("a", "x", peers);

    expect(row(comparison, "par30")?.apexAverage).toBeCloseTo((2 + 6 + 9) / 3);
    expect(row(comparison, "par30")?.nationalAverage).toBeCloseTo((2 + 6 + 9 + 1) / 4);
  });

  it("ignores cooperatives that did not file", () => {
    const comparison = compareWithPeers("a", "x", peers);

    expect(comparison?.nationalCount).toBe(4);
  });

  it("returns null when the cooperative did not file or has no peers", () => {
    expect(compareWithPeers("e", "y", peers)).toBeNull();
    expect(compareWithPeers("a", "x", [coop("a", "x", 1, 1)])).toBeNull();
    expect(compareWithPeers("a", "x", undefined)).toBeNull();
  });

  it("leaves the apex columns empty when the apex has a single cooperative", () => {
    const comparison = compareWithPeers("d", "y", peers);

    expect(row(comparison, "par30")?.apexAverage).toBeNull();
    expect(row(comparison, "par30")?.apexRank).toBeNull();
  });
});
