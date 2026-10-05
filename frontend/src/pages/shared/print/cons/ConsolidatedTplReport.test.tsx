import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CoopKpiRow, NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";

const kpi = (value: number, status: string | null = "green") => ({
  name: "",
  value,
  formatted: `${value}%`,
  unit: "percent",
  status,
  benchmark: null,
  description: "",
});

const coop = (index: number, hasData = true): CoopKpiRow =>
  ({
    cooperative_id: `c${index}`,
    name: index === 1 ? "Test Coop" : `Coop ${index}`,
    apex_id: `a${index % 2}`,
    apex_name: `Apex ${index % 2}`,
    sector: "Finance",
    has_data: hasData,
    non_financial: { total_members: 10, active_members: 8, active_borrowers: 5 },
    kpis: {
      total_assets: kpi(1000),
      gross_loan_portfolio: kpi(500),
      net_loan_portfolio: kpi(480),
      total_member_deposits: kpi(700),
      total_equity: kpi(120),
      net_surplus: kpi(20),
      par30: kpi(12, "red"),
      npl_ratio: kpi(12),
      capital_adequacy_ratio: kpi(12),
      roa: kpi(2, "red"),
      roe: kpi(9),
      operating_expense_ratio: kpi(4),
      loan_loss_coverage: kpi(100),
    },
  }) as unknown as CoopKpiRow;

const overview = (count: number, unfiled = 0): NationalOverviewResponse =>
  ({
    total_cooperatives: count,
    cooperatives_with_data: count - unfiled,
    cooperatives: Array.from({ length: count }, (_, i) => coop(i + 1, i >= unfiled)),
    distributions: {},
  }) as unknown as NationalOverviewResponse;

const text = (tier: "Apex" | "Federation" | "Ministry", count = 6) =>
  render(
    <ConsolidatedTplReport
      tier={tier}
      entityName="Entity"
      year={2026}
      data={overview(count)}
      priorData={overview(count)}
    />,
  ).container.textContent ?? "";

describe("ConsolidatedTplReport", () => {
  it("has the template's front matter and annexes for every tier", () => {
    for (const tier of ["Apex", "Federation", "Ministry"] as const) {
      const out = text(tier);

      expect(out).toContain("Document Control");
      expect(out).toContain("Status legend");
      expect(out).toContain("Executive Summary");
      expect(out).toContain("Data Validation & Corrections");
      expect(out).toContain("Indicator Definitions & Benchmarks");
      expect(out).toContain("END OF REPORT");
    }
  });

  it("uses cooperative pages for an apex and sector and PEARLS pages above it", () => {
    expect(text("Apex")).toContain("Cooperative Overview");
    expect(text("Apex")).not.toContain("PEARLS Benchmark Comparison");
    expect(text("Ministry")).toContain("PEARLS Benchmark Comparison");
    expect(text("Federation")).toContain("Sector & Apex Overview");
  });

  it("flags a test-named cooperative in Annex A", () => {
    expect(text("Ministry")).toContain("Test entities");
  });

  it("recommends action for indicators in breach", () => {
    expect(text("Apex")).toContain("Portfolio quality.");
  });

  it("renders without any cooperative", () => {
    const out = render(
      <ConsolidatedTplReport tier="Ministry" entityName="M" year={2026} data={overview(0)} />,
    ).container.textContent;

    expect(out).toContain("No returns have been filed");
  });
});
