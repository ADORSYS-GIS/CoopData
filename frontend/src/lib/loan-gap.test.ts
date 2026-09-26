import { describe, expect, it } from "vitest";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { aggregateLoanGap } from "@/lib/loan-gap";

const kpi = (value: number) => ({
  name: "",
  value,
  formatted: String(value),
  unit: "",
  status: null,
  benchmark: null,
  description: "",
});

const coop = (glp: number, par30?: number, coverage?: number): CoopKpiRow =>
  ({
    kpis: {
      gross_loan_portfolio: kpi(glp),
      ...(par30 === undefined ? {} : { par30: kpi(par30) }),
      ...(coverage === undefined ? {} : { loan_loss_coverage: kpi(coverage) }),
    },
  }) as unknown as CoopKpiRow;

describe("aggregateLoanGap", () => {
  it("weights PAR 30 by loan book instead of averaging", () => {
    const totals = aggregateLoanGap([coop(900, 2), coop(100, 20)]);

    expect(totals.par30Pct).toBeCloseTo(3.8, 5);
  });

  it("weights coverage by overdue balance", () => {
    const totals = aggregateLoanGap([coop(1000, 10, 100), coop(1000, 30, 0)]);

    expect(totals.provisionsPct).toBeCloseTo(25, 5);
  });

  it("ignores cooperatives without a PAR 30 figure", () => {
    const totals = aggregateLoanGap([coop(500, 4), coop(500)]);

    expect(totals.par30Pct).toBe(4);
    expect(totals.totalGLP).toBe(1000);
  });

  it("returns zeros for an empty portfolio", () => {
    expect(aggregateLoanGap([])).toEqual({ totalGLP: 0, par30Pct: 0, provisionsPct: 0 });
  });

  it("ignores a PAR 30 printed as not reported instead of counting it as zero", () => {
    const missing = coop(500, 0);
    missing.kpis["par30"] = { ...kpi(0), formatted: "—" };

    const totals = aggregateLoanGap([coop(500, 4), missing]);

    expect(totals.par30Pct).toBeCloseTo(4, 5);
  });
});
