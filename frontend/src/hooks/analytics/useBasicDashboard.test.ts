import { describe, expect, it } from "vitest";

import { buildBasicDashboardQuery } from "@/hooks/analytics/useBasicDashboard";

describe("buildBasicDashboardQuery", () => {
  it("maps only the provided filters to snake_case query parameters", () => {
    expect(
      buildBasicDashboardQuery({
        reportingYear: 2026,
        periodType: "QUARTERLY",
        periodValue: "Q1",
        region: "Manzini",
        sector: "Finance",
        cooperativeId: "abc",
        currency: "usd",
      }),
    ).toEqual({
      reporting_year: 2026,
      period_type: "QUARTERLY",
      period_value: "Q1",
      region: "Manzini",
      sector: "Finance",
      cooperative_id: "abc",
      currency: "usd",
    });
  });

  it("returns an empty object when nothing is set", () => {
    expect(buildBasicDashboardQuery({})).toEqual({});
  });
});
