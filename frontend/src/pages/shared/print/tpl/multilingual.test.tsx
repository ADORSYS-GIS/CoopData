import { render } from "@testing-library/react";
import { afterAll, describe, expect, it } from "vitest";

import type { CoopKpiRow, NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import i18n from "@/i18n";
import type { ReportDataProps } from "@/pages/shared/print/components/types";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";
import { CooperativeTplReport } from "@/pages/shared/print/coop/CooperativeTplReport";

/** English sentences that must never reach a report rendered in another language. */
const ENGLISH = [
  "Executive Summary",
  "Overall supervisory view",
  "Scorecard at a glance",
  "Areas of concern",
  "Strengths",
  "Document Control",
  "Status legend",
  "Basis of preparation",
  "Statement of Financial",
  "Prudential Ratio Scorecard",
  "Loan Portfolio Quality",
  "Membership, Governance",
  "Multi-Period Trend",
  "Peer Comparison",
  "Supervisory Findings",
  "Data Validation",
  "Indicator Definitions",
  "Recommendation",
  "Benchmark",
  "Total assets",
  "Net surplus",
  "Key indicator",
  "Prepared by",
  "END OF REPORT",
  "on prior",
  "Page 2 of",
  "Consolidated Financial Position",
  "Social Impact",
  "Sector & Apex",
  "Cooperative Overview",
  "PEARLS Benchmark",
  "Key Indicators",
  "Portfolio Structure",
];

const ratio = (value: number, status: string | null = "green") => ({
  name: "",
  value,
  formatted: `${value}%`,
  unit: "percent",
  status,
  benchmark: null,
  description: "",
});

const peer = (index: number): CoopKpiRow =>
  ({
    cooperative_id: `c${index}`,
    name: `Coop ${index}`,
    apex_id: `a${index % 3}`,
    apex_name: `Apex ${index % 3}`,
    sector: index % 2 === 0 ? "finance" : "agriculture",
    has_data: index !== 7,
    non_financial: {
      has_data: true,
      total_members: 100 + index,
      active_members: 80,
      active_borrowers: 50,
      women_borrowers: 20 + index,
      youth_borrowers: 10,
      rural_borrowers: 15,
      savings_penetration_pct: 60,
      credit_penetration_pct: 40,
    },
    kpis: {
      total_assets: ratio(1_200_000 + index * 10_000),
      gross_loan_portfolio: ratio(700_000),
      net_loan_portfolio: ratio(680_000),
      total_member_deposits: ratio(900_000),
      total_equity: ratio(150_000),
      net_surplus: ratio(25_000),
      par30: ratio(4 + index, index > 3 ? "red" : "green"),
      npl_ratio: ratio(3),
      capital_adequacy_ratio: ratio(12.5),
      roa: ratio(2.1, "red"),
      roe: ratio(9),
      operating_expense_ratio: ratio(4.4),
      loan_loss_coverage: ratio(85, "amber"),
      liquid_funds_ratio: ratio(18),
    },
  }) as unknown as CoopKpiRow;

const overview = (): NationalOverviewResponse =>
  ({
    total_cooperatives: 8,
    cooperatives_with_data: 7,
    cooperatives: Array.from({ length: 8 }, (_, i) => peer(i)),
    distributions: {},
  }) as unknown as NationalOverviewResponse;

const point = (label: string, scale: number) => ({
  period_label: label,
  assets: 1_000_000 * scale,
  savings: 700_000 * scale,
  loans: 600_000 * scale,
  arrears_31_60: 10_000,
  arrears_61_90: 5_000,
  non_performing: 8_000,
  net_income: 40_000 * scale,
  liquid_assets: 200_000 * scale,
  equity: 130_000 * scale,
});

const line = (code: number, value: number, name = `ACCOUNT ${code}`) => ({
  id: String(code),
  account_code: code,
  account_name: name,
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

const coopProps = (): ReportDataProps => ({
  submission: {
    reporting_year: 2025,
    status: "approved",
    apex_name: "Apex 1",
    cooperative_id: "c1",
    apex_id: "a1",
  } as never,
  submissionId: "abcde123",
  kpisData: {
    submission_id: "s",
    reporting_year: 2025,
    computed_at: "",
    submission_status: "approved",
    kpis: [
      kpi("total_assets", 1_500_000, "green"),
      kpi("net_loan_portfolio", 800_000),
      kpi("gross_loan_portfolio", 850_000),
      kpi("total_member_deposits", 1_000_000),
      kpi("par30", 0, "green"),
      kpi("par90", 3.5, "red"),
      kpi("capital_adequacy_ratio", 15.25, "green"),
      kpi("loan_loss_coverage", 40, "red"),
      kpi("roa", 1.2, "amber"),
      kpi("liquid_funds_ratio", 22, "green"),
    ],
    prior_year_kpis: [
      kpi("net_loan_portfolio", 700_000),
      kpi("total_member_deposits", 900_000),
      kpi("par30", 2),
    ],
  },
  lineItemsData: {
    submission_id: "s",
    current_year: [
      line(1101, 300_000, "CASH ON HAND"),
      line(1201, 800_000),
      line(1203, 50_000),
      line(1251, -20_000),
      line(1999, 1_500_000),
      line(2101, 900_000),
      line(2999, 1_100_000),
      line(3101, 300_000),
      line(3999, 400_000),
      line(4101, 200_000),
      line(5201, 150_000),
      line(6999, 60_000),
    ],
    prior_year: [line(1999, 1_300_000), line(4101, 180_000), line(6999, 40_000)],
  },
  portfolioData: {
    submission_id: "s",
    categories: [
      { category: "Arrears 31-60", balance: 10_000, count: 5 },
      { category: "Current", balance: 790_000, count: 95 },
    ],
  },
  membershipData: {
    submission_id: "s",
    male_members: 60,
    female_members: 45,
    youth_members: 30,
    active_members: 80,
    inactive_members: 20,
    agm_attendance: 50,
  },
  coopName: "Test Coop",
  kpiMap: new Map(),
  narratives: null,
  trend: [point("2023", 0.8), point("2024", 0.9), point("2025", 1)] as never,
  peers: overview().cooperatives,
});

const coopText = () =>
  render(<CooperativeTplReport {...coopProps()} />).container.textContent ?? "";

const consText = (tier: "Apex" | "Federation" | "Ministry") =>
  render(
    <ConsolidatedTplReport
      tier={tier}
      entityName="Entity"
      year={2026}
      data={overview()}
      priorData={overview()}
      trend={[point("2024", 0.9), point("2025", 1)] as never}
    />,
  ).container.textContent ?? "";

const reportsIn = async (language: string): Promise<string[]> => {
  await i18n.changeLanguage(language);
  return [coopText(), consText("Apex"), consText("Federation"), consText("Ministry")];
};

describe("PDF report templates", () => {
  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  it.each(["en", "fr", "pt", "ss"])("never show a raw translation key in %s", async (language) => {
    for (const text of await reportsIn(language)) {
      expect(text).not.toMatch(/\bpdf\.[a-z_]+\./);
      expect(text).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it.each(["fr", "pt", "ss"])("contain no English report text in %s", async (language) => {
    for (const text of await reportsIn(language)) {
      const leaked = ENGLISH.filter((phrase) => text.includes(phrase));
      expect(leaked).toEqual([]);
    }
  });

  it("uses French headings, decimal commas and percent spacing", async () => {
    const [coop, apex] = await reportsIn("fr");

    expect(coop).toContain("Résumé analytique");
    expect(coop).toContain("FIN DU RAPPORT");
    expect(coop).toContain("Caisse");
    expect(coop).toMatch(/15,3\u202F%/);
    expect(apex).toContain("Rapport consolidé");
  });

  it("uses Portuguese headings and decimal commas", async () => {
    const [coop] = await reportsIn("pt");

    expect(coop).toContain("Sumário executivo");
    expect(coop).toContain("FIM DO RELATÓRIO");
    expect(coop).toMatch(/15,3%/);
  });

  it("uses siSwati headings and month names", async () => {
    const [coop] = await reportsIn("ss");

    expect(coop).toContain("Sifinyeto Sebaphatsi");
    expect(coop).toContain("SIPHETSO SEMBIKO");
    expect(coop).toMatch(
      /Bhimbidvwane|iNdlovana|iNdlovu-lenkhulu|Mabasa|iNkhwekhweti|iNhlaba|Kholwane|iNgci|iNyoni|iMphala|Lweti|iNgongoni/,
    );
  });

  it("keeps the submitted account names in English", async () => {
    const [coop] = await reportsIn("en");

    expect(coop).toContain("Cash on hand");
    expect(coop).toContain("Executive Summary");
    expect(coop).toMatch(/15\.3%/);
  });
});
