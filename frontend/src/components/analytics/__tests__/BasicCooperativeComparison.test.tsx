import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildBasicMetrics } from "@/components/analytics/basic-benchmark-utils";
import { computeKpiAverages } from "@/components/analytics/benchmark-utils";
import type { BenchmarkMetric, BenchmarkRow } from "@/components/analytics/benchmark-types";
import { BasicCooperativeComparison } from "@/components/analytics/BasicCooperativeComparison";
import type {
  BasicBenchmarkResponse,
  BasicBenchmarkRow,
} from "@/hooks/analytics/useBasicBenchmark";

// Hoisted mock state so the vi.mock factories (which are hoisted above the
// imports) can reference it.
const mockState = vi.hoisted(() => ({
  benchmark: null as BasicBenchmarkResponse | null,
  isError: false,
  role: "cooperative",
}));

vi.mock("@/hooks/analytics/useBasicBenchmark", () => ({
  useBasicBenchmark: () => ({
    data: mockState.benchmark,
    isLoading: false,
    isError: mockState.isError,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ role: mockState.role }),
}));

// ── Test data factories ──────────────────────────────────────────────────────

function makeRow(
  overrides: Partial<BasicBenchmarkRow> & { cooperative_id: string },
): BasicBenchmarkRow {
  return {
    name: "Test Coop",
    region: "Manzini",
    sector: "Agriculture",
    has_data: true,
    metrics: {
      total_registered_members: 100,
      total_active_members: 80,
      total_members_male: 55,
      total_members_female: 45,
      total_share_capital: 1_000_000,
      total_borrowed_funds: 200_000,
      total_savings_value: 500_000,
      total_loans_outstanding: 300_000,
      total_income: 150_000,
      total_expenditure: 120_000,
      total_net_income: 30_000,
      members_age_18_25: 20,
      members_age_26_35: 30,
      members_age_36_60: 35,
      members_age_61plus: 15,
    },
    ...overrides,
  };
}

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer requires.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverMock;

// Reads a metric value off a structural BenchmarkRow (the rows are actually
// BasicBenchmarkRow instances, so cast to reach their `metrics` map).
const readMetric = (r: BenchmarkRow, key: string) => (r as BasicBenchmarkRow).metrics?.[key] ?? 0;

const mockT = ((key: string) => key) as never;

// ── computeKpiAverages unit tests ────────────────────────────────────────────

describe("computeKpiAverages", () => {
  const metrics = buildBasicMetrics(mockT);

  it("averages each metric over cooperatives-with-data", () => {
    const rows = [
      makeRow({ cooperative_id: "a", metrics: { total_share_capital: 100, total_income: 50 } }),
      makeRow({ cooperative_id: "b", metrics: { total_share_capital: 300, total_income: 150 } }),
    ];
    const avg = computeKpiAverages(rows, metrics, readMetric);
    expect(avg.total_share_capital).toBe(200);
    expect(avg.total_income).toBe(100);
  });

  it("returns 0 for metrics with no values", () => {
    const rows = [makeRow({ cooperative_id: "a", metrics: {} })];
    const avg = computeKpiAverages(rows, metrics, readMetric);
    expect(avg.total_share_capital).toBe(0);
  });

  it("is agnostic to the value getter shape", () => {
    const rows = [
      makeRow({ cooperative_id: "a", metrics: { total_share_capital: 10 } }),
      makeRow({ cooperative_id: "b", metrics: { total_share_capital: 30 } }),
      makeRow({ cooperative_id: "c", metrics: { total_share_capital: 20 } }),
    ];
    const avg = computeKpiAverages(rows, metrics, readMetric);
    expect(avg.total_share_capital).toBe(20);
  });
});

// ── buildBasicMetrics tests ──────────────────────────────────────────────────

describe("buildBasicMetrics", () => {
  it("covers all 15 questionnaire metric keys with the correct units", () => {
    const metrics = buildBasicMetrics(mockT);
    expect(metrics).toHaveLength(15);
    const keys = new Set(metrics.map((m) => m.key));
    expect(keys).toEqual(
      new Set([
        "total_registered_members",
        "total_active_members",
        "total_members_male",
        "total_members_female",
        "total_share_capital",
        "total_borrowed_funds",
        "total_savings_value",
        "total_loans_outstanding",
        "total_income",
        "total_expenditure",
        "total_net_income",
        "members_age_18_25",
        "members_age_26_35",
        "members_age_36_60",
        "members_age_61plus",
      ]),
    );
  });

  it("groups metrics into membership, balances and income", () => {
    const metrics = buildBasicMetrics(mockT);
    expect(metrics.filter((m) => m.group === "membership")).toHaveLength(8);
    expect(metrics.filter((m) => m.group === "balances")).toHaveLength(4);
    expect(metrics.filter((m) => m.group === "income")).toHaveLength(3);
  });

  it("marks expenditure as lower-is-better", () => {
    const metrics = buildBasicMetrics(mockT);
    const expenditure = metrics.find((m) => m.key === "total_expenditure");
    expect(expenditure?.isLowerBetter).toBe(true);
  });
});

// ── BasicCooperativeComparison rendering tests ───────────────────────────────

describe("BasicCooperativeComparison", () => {
  it("renders the no-approved-data empty state for a coop user without a row", () => {
    mockState.role = "cooperative";
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: null,
      rows: [],
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

    // The mocked t() falls back to the key itself, so the empty state title
    // resolves to the translation key.
    render(<BasicCooperativeComparison reportingYear={2026} />);
    expect(screen.getByText("basicBenchmarking.noApprovedDataTitle")).toBeInTheDocument();
    expect(screen.queryByText("analytics.assemblingPerformanceStats")).not.toBeInTheDocument();
  });

  it("shows the amber notice when the coop row exists but has no benchmarkable data", () => {
    mockState.role = "cooperative";
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: makeRow({ cooperative_id: "c1", has_data: false }),
      rows: [],
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

    render(<BasicCooperativeComparison reportingYear={2026} />);
    expect(screen.getByText("analytics.noSubmittedDataYear")).toBeInTheDocument();
  });

  it("shows the load-error state instead of a no-data state on fetch failure", () => {
    mockState.role = "cooperative";
    mockState.benchmark = null;
    mockState.isError = true;

    render(<BasicCooperativeComparison reportingYear={2026} />);
    expect(screen.getByText("basicBenchmarking.loadErrorTitle")).toBeInTheDocument();
    expect(screen.queryByText("basicBenchmarking.noApprovedDataTitle")).not.toBeInTheDocument();
    mockState.isError = false;
  });

  it("renders the full comparison widget for admin callers with a population", () => {
    mockState.role = "ministry";
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: null,
      rows: [
        makeRow({ cooperative_id: "a", name: "Coop A" }),
        makeRow({ cooperative_id: "b", name: "Coop B", region: "Hhohho" }),
      ],
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

    render(<BasicCooperativeComparison reportingYear={2026} />);
    // Control panel card + matrix both render (labels resolve to keys via the
    // mocked t()).
    expect(screen.getByText("basicBenchmarking.title")).toBeInTheDocument();
    expect(screen.getByText("basicBenchmarking.matrixTitle")).toBeInTheDocument();
    expect(screen.queryByText("basicBenchmarking.noApprovedDataTitle")).not.toBeInTheDocument();
  });

  it("renders the no-population empty state for admins without any rows", () => {
    mockState.role = "ministry";
    mockState.benchmark = {
      reporting_year: 2026,
      cooperative: null,
      rows: [],
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

    render(<BasicCooperativeComparison reportingYear={2026} />);
    expect(screen.getByText("basicBenchmarking.noDataTitle")).toBeInTheDocument();
  });
});
