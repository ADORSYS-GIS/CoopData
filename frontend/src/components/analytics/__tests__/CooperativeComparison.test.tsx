import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import type { BenchmarkResponse } from "@/hooks/analytics/useBenchmark";

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer requires.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverMock;

const mockState = vi.hoisted(() => ({
  benchmark: null as BenchmarkResponse | null,
  isError: false,
}));

vi.mock("@/hooks/analytics/useBenchmark", () => ({
  useBenchmark: () => ({
    data: mockState.benchmark,
    isLoading: false,
    isError: mockState.isError,
  }),
}));

vi.mock("@/hooks/analytics/useNationalOverview", () => ({
  useNationalOverview: () => ({ data: null, isLoading: false, isError: false }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ role: "cooperative" }),
}));

function makeCoopRow(): CoopKpiRow {
  return {
    cooperative_id: "c1",
    submission_id: null,
    name: "Swazi Agro Coop",
    apex_id: null,
    apex_name: null,
    region: "Manzini",
    sector: "Agriculture",
    institution_type: null,
    has_data: true,
    non_financial: {
      has_data: true,
      total_members: 1200,
      active_members: 900,
      active_borrowers: 300,
      women_borrowers: 100,
      youth_borrowers: 50,
      rural_borrowers: 200,
      active_members_pct: 75,
      savings_penetration_pct: 60,
      credit_penetration_pct: 40,
      fd_penetration_pct: 20,
      on_time_repayment_pct: 88,
      dormancy_pct: 12,
      agm_participation_pct: 65,
      arrears_rate_pct: 8,
      fd_early_withdrawal_pct: 5,
    },
    kpis: {
      total_assets: {
        name: "total_assets",
        value: 5_000_000,
        formatted: "5M",
        unit: "SZL",
        status: "green",
        benchmark: null,
        description: "",
      },
      capital_adequacy_ratio: {
        name: "capital_adequacy_ratio",
        value: 18.2,
        formatted: "18.2%",
        unit: "%",
        status: "green",
        benchmark: null,
        description: "",
      },
    },
    custom_kpis: {},
  };
}

describe("CooperativeComparison", () => {
  it("renders the full widget for a coop user with financial + non-financial data", () => {
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: makeCoopRow(),
      national_average: { capital_adequacy_ratio: 15 },
      regional_average: { capital_adequacy_ratio: 16 },
      sector_average: { capital_adequacy_ratio: 17 },
      sector_regional_average: null,
      insufficient_data: {
        national: false,
        regional: false,
        sector: false,
        sector_regional: true,
      },
    };

    render(<CooperativeComparison reportingYear={2026} />);
    // Labels resolve to keys via the mocked t(); assert the widget's card,
    // matrix and the coop's name are all present.
    expect(screen.getByText("analytics.benchmarkingTitle")).toBeInTheDocument();
    expect(screen.getByText("analytics.kpiMatrixTitle")).toBeInTheDocument();
    // The coop name appears in both the combobox and the insight panel.
    expect(screen.getAllByText("Swazi Agro Coop").length).toBeGreaterThan(0);
  });

  it("renders the no-data empty state for a coop user without a row", () => {
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: null,
      national_average: null,
      regional_average: null,
      sector_average: null,
      sector_regional_average: null,
      insufficient_data: {
        national: true,
        regional: true,
        sector: true,
        sector_regional: true,
      },
    };

    render(<CooperativeComparison reportingYear={2026} />);
    expect(screen.getByText("analytics.noBenchmarkingData")).toBeInTheDocument();
  });
});
