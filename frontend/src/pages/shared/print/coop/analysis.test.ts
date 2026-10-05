import { describe, expect, it } from "vitest";

import type { ReportDataProps } from "@/pages/shared/print/components/types";
import { analyseCoop } from "@/pages/shared/print/coop/analysis";
import { verdictOf } from "@/pages/shared/print/coop/text";

const row = (code: number, value: number) => ({
  id: String(code),
  account_code: code,
  account_name: `Account ${code}`,
  account_category: "x",
  month: 0,
  value,
});

const kpi = (name: string, value: number, status?: "green" | "amber" | "red") => ({
  name,
  value,
  formatted: String(value),
  unit: "percent" as const,
  status,
  description: "",
});

const props = (overrides: Partial<ReportDataProps> = {}): ReportDataProps => ({
  submission: { reporting_year: 2025, status: "approved" } as never,
  submissionId: "abcde123",
  kpisData: {
    submission_id: "s",
    reporting_year: 2025,
    computed_at: "",
    submission_status: "approved",
    kpis: [
      kpi("total_assets", 1000, "green"),
      kpi("par30", 0, "green"),
      kpi("capital_adequacy_ratio", 15, "green"),
      kpi("loan_loss_coverage", 0, "red"),
    ],
    prior_year_kpis: [],
  },
  lineItemsData: {
    submission_id: "s",
    current_year: [row(1101, 400), row(1201, 600), row(1999, 1000), row(2999, 700), row(3999, 300)],
    prior_year: [],
  },
  portfolioData: {
    submission_id: "s",
    categories: [{ category: "Arrears 31-60", balance: 10, count: 5 }],
  },
  membershipData: {
    submission_id: "s",
    male_members: 5,
    female_members: 5,
    youth_members: 1,
    active_members: 8,
    inactive_members: 2,
    agm_attendance: 6,
  },
  coopName: "Test Coop",
  kpiMap: new Map(),
  narratives: null,
  ...overrides,
});

describe("analyseCoop", () => {
  it("marks PAR unverified when the register shows arrears but the ledger reports none", () => {
    const a = analyseCoop(props());

    expect(a.validation.some((v) => v.key === "par30")).toBe(true);
    expect(a.scorecard.find((r) => r.key === "par30")?.tone).toBe("na");
  });

  it("reports a balance sheet that does not balance", () => {
    const a = analyseCoop(
      props({
        lineItemsData: {
          submission_id: "s",
          current_year: [row(1999, 1000), row(2999, 500), row(3999, 100)],
          prior_year: [],
        },
      }),
    );

    expect(a.validation.some((v) => v.key === "balance")).toBe(true);
  });

  it("finds nothing to correct in a consistent return", () => {
    const a = analyseCoop(
      props({
        portfolioData: { submission_id: "s", categories: [] },
        membershipData: {
          submission_id: "s",
          male_members: 5,
          female_members: 5,
          youth_members: 1,
          active_members: 5,
          inactive_members: 5,
          agm_attendance: 6,
        },
      }),
    );

    expect(a.validation).toEqual([]);
  });

  it("builds a reference from the year and submission id", () => {
    expect(analyseCoop(props()).ref).toBe("SUB-2025-ABCDE");
  });
});

describe("verdictOf", () => {
  it("cannot assess a return without total assets", () => {
    const empty = props({
      kpisData: {
        submission_id: "s",
        reporting_year: 2025,
        computed_at: "",
        submission_status: "approved",
        kpis: [kpi("total_assets", 0)],
      },
      lineItemsData: { submission_id: "s", current_year: [], prior_year: [] },
    });

    expect(verdictOf(analyseCoop(empty)).verdict).toContain("cannot be assessed");
  });

  it("names the weak areas", () => {
    expect(verdictOf(analyseCoop(props())).verdict).toContain("provisioning");
  });
});
