import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { analyse } from "@/pages/shared/print/cons/analysis";
import { shareSlices, tileGroupsOf } from "@/pages/shared/print/cons/indicators";
import type { TrendRow } from "@/pages/shared/print/tpl/trend";

const coop = (id: string, members: number, active: number, loans: number): CoopKpiRow =>
  ({
    cooperative_id: id,
    name: id,
    has_data: true,
    non_financial: {
      has_data: true,
      total_members: members,
      active_members: active,
      active_borrowers: 10,
      women_borrowers: 4,
      youth_borrowers: 2,
      rural_borrowers: 5,
    },
    kpis: {
      gross_loan_portfolio: { value: loans },
      total_member_deposits: { value: 300 },
    },
  }) as unknown as CoopKpiRow;

const build = (now: CoopKpiRow[], before?: CoopKpiRow[]) =>
  analyse({
    tier: "Apex",
    entityName: "Apex",
    year: 2025,
    data: { total_cooperatives: now.length, cooperatives: now } as never,
    priorData: before ? ({ cooperatives: before } as never) : undefined,
  });

const tile = (groups: ReturnType<typeof tileGroupsOf>, label: string) =>
  groups.flatMap((g) => g.tiles).find((t) => t.label === label);

describe("tileGroupsOf", () => {
  it("sums members and derives inactive members and shares", () => {
    const groups = tileGroupsOf(build([coop("a", 100, 80, 500), coop("b", 50, 20, 500)]), []);

    expect(tile(groups, "Members")?.value).toBe("150");
    expect(tile(groups, "Active members")?.note).toBe("66.7% of members");
    expect(tile(groups, "Inactive members")?.value).toBe("50");
    expect(tile(groups, "Women borrowers")?.note).toBe("40.0% of borrowers");
  });

  it("computes the average loan balance from loans over active borrowers", () => {
    const groups = tileGroupsOf(build([coop("a", 100, 80, 500), coop("b", 50, 20, 700)]), []);

    expect(tile(groups, "Average loan balance")?.value).toBe("60");
  });

  it("shows the change on the prior year", () => {
    const groups = tileGroupsOf(build([coop("a", 120, 80, 500)], [coop("a", 100, 80, 500)]), []);

    expect(tile(groups, "Members")?.note).toBe("▲ 20.0% on prior year");
  });

  it("adds portfolio-at-risk tiles from the latest trend period", () => {
    const trend = [
      {
        label: "2025",
        loans: 1000,
        overdue: { d31to60: 20, d61to90: 10, nonPerforming: 20 },
      } as TrendRow,
    ];

    const groups = tileGroupsOf(build([coop("a", 100, 80, 500)]), trend);

    expect(tile(groups, "Value at risk (>30 days)")?.value).toBe("50");
    expect(tile(groups, "Value at risk (>30 days)")?.note).toBe("PAR >30 days 5.0%");
  });

  it("leaves out the risk tiles without a trend", () => {
    const groups = tileGroupsOf(build([coop("a", 100, 80, 500)]), []);

    expect(groups.some((g) => g.title.startsWith("Portfolio at risk"))).toBe(false);
  });
});

describe("shareSlices", () => {
  it("folds everything beyond the top items into Other", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ name: `n${i}`, value: 10 - i }));

    const slices = shareSlices(items, 6);

    expect(slices).toHaveLength(7);
    expect(slices[6]).toEqual({ label: "Other", value: 4 + 3 });
  });

  it("drops zero and negative values", () => {
    expect(
      shareSlices([
        { name: "a", value: 0 },
        { name: "b", value: -1 },
      ]),
    ).toEqual([]);
  });
});
