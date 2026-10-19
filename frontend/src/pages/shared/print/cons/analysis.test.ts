import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { analyse } from "@/pages/shared/print/cons/analysis";

const coop = (id: string, assets: number, surplus: number): CoopKpiRow =>
  ({
    cooperative_id: id,
    name: id,
    has_data: true,
    non_financial: { has_data: true, total_members: 10 },
    kpis: { total_assets: { value: assets }, net_surplus: { value: surplus } },
  }) as unknown as CoopKpiRow;

const build = (now: CoopKpiRow[], before?: CoopKpiRow[]) =>
  analyse({
    tier: "Apex",
    entityName: "Apex",
    year: 2023,
    data: { total_cooperatives: now.length, cooperatives: now } as never,
    priorData: before ? ({ cooperatives: before } as never) : undefined,
  });

describe("analyse: changes on the prior year", () => {
  // Our 2023 data: basic sacco in both years, saccocoop in 2023 only.
  const a = build(
    [coop("basic sacco", 3475180, 72000), coop("saccocoop", 5552000, 170340)],
    [coop("basic sacco", 3068510, 64000)],
  );

  it("keeps the totals of every cooperative that filed", () => {
    expect(a.now.assets).toBe(9027180);
    expect(a.before?.assets).toBe(3068510);
  });

  it("compares only the cooperatives with figures in both years", () => {
    expect(a.changes.assets?.text).toBe("+13.3%");
    expect(a.changes.surplus?.text).toBe("+12.5%");
    expect(a.likeForLike.added).toEqual(["saccocoop"]);
    expect(a.likeForLike.missing).toEqual([]);
  });

  it("names a cooperative whose year is not complete", () => {
    const b = build(
      [coop("basic sacco", 3697000, 80000)],
      [coop("basic sacco", 3475180, 72000), coop("saccocoop", 5552000, 170340)],
    );

    expect(b.changes.surplus?.text).toBe("+11.1%");
    expect(b.likeForLike.missing).toEqual(["saccocoop"]);
  });

  it("shows no change when no cooperative has both years", () => {
    const c = build([coop("saccocoop", 5552000, 170340)], [coop("basic sacco", 3068510, 64000)]);

    expect(c.changes.assets).toBeNull();
  });
});
