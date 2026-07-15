import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  generateInsights,
  BenchmarkInsightPanel,
} from "@/components/analytics/BenchmarkInsightPanel";
import type { KpiItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import type { BenchmarkResponse } from "@/hooks/analytics/useBenchmarks";

// ── Test data factories ──────────────────────────────────────────────────────

function makeKpi(overrides: Partial<KpiItemResponse> & { name: string }): KpiItemResponse {
  return {
    value: 5.0,
    formatted: "5.0%",
    unit: "percent",
    status: "green",
    benchmark: 5.0,
    description: "Test KPI",
    ...overrides,
  };
}

function makeBenchmark(
  overrides: Partial<BenchmarkResponse> & { kpi_name: string },
): BenchmarkResponse {
  return {
    cooperative_type: "sacco",
    reporting_year: 2025,
    sector_average: 5.0,
    national_average: 5.0,
    percentile_25: 3.0,
    percentile_50: 5.0,
    percentile_75: 8.0,
    sample_count: 20,
    ...overrides,
  };
}

// ── generateInsights unit tests ──────────────────────────────────────────────

describe("generateInsights", () => {
  it("returns empty array when no benchmarks match any KPI", () => {
    const kpis = [makeKpi({ name: "par30", value: 3.0, formatted: "3.0%" })];
    const benchmarks: BenchmarkResponse[] = [];
    expect(generateInsights(kpis, benchmarks)).toHaveLength(0);
  });

  it("returns empty array when difference is less than 5%", () => {
    // 5.2% value vs 5.0% benchmark = 4% diff — below threshold
    const kpis = [makeKpi({ name: "roa", value: 5.2, formatted: "5.2%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 5.0 })];
    const result = generateInsights(kpis, benchmarks);
    expect(result).toHaveLength(0);
  });

  it("generates positive insight when higher-is-better KPI is above average", () => {
    // ROA: higher is better. 6.0 vs benchmark 3.0 = 100% above → positive
    const kpis = [makeKpi({ name: "roa", value: 6.0, formatted: "6.0%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 3.0 })];
    const result = generateInsights(kpis, benchmarks);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("positive");
    expect(result[0].direction).toBe("above");
  });

  it("generates critical insight when higher-is-better KPI is 30% below average", () => {
    // CAR: higher is better. 7.0 vs benchmark 10.0 = 30% below → critical
    const kpis = [
      makeKpi({ name: "capital_adequacy_ratio", value: 7.0, formatted: "7.0%", unit: "percent" }),
    ];
    const benchmarks = [
      makeBenchmark({ kpi_name: "capital_adequacy_ratio", sector_average: 10.0 }),
    ];
    const result = generateInsights(kpis, benchmarks);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("critical");
    expect(result[0].direction).toBe("below");
  });

  it("generates positive insight when lower-is-better KPI is below average (good)", () => {
    // PAR30: lower is better. 3.0 vs benchmark 6.0 = 50% below → positive
    const kpis = [makeKpi({ name: "par30", value: 3.0, formatted: "3.0%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "par30", sector_average: 6.0 })];
    const result = generateInsights(kpis, benchmarks);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("positive");
    expect(result[0].direction).toBe("below");
  });

  it("generates warning insight when lower-is-better KPI is 20% above average (bad)", () => {
    // PAR30: lower is better. 8.4 vs benchmark 7.0 = 20% above → warning
    const kpis = [makeKpi({ name: "par30", value: 8.4, formatted: "8.4%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "par30", sector_average: 7.0 })];
    const result = generateInsights(kpis, benchmarks);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("warning");
  });

  it("sorts insights: critical first, then warning, then positive", () => {
    const kpis = [
      makeKpi({ name: "roa", value: 6.0, formatted: "6.0%", unit: "percent" }), // positive
      makeKpi({ name: "capital_adequacy_ratio", value: 7.0, formatted: "7.0%", unit: "percent" }), // critical
      makeKpi({ name: "par30", value: 8.4, formatted: "8.4%", unit: "percent" }), // warning
    ];
    const benchmarks = [
      makeBenchmark({ kpi_name: "roa", sector_average: 3.0 }),
      makeBenchmark({ kpi_name: "capital_adequacy_ratio", sector_average: 10.0 }),
      makeBenchmark({ kpi_name: "par30", sector_average: 7.0 }),
    ];
    const result = generateInsights(kpis, benchmarks);
    expect(result[0].severity).toBe("critical");
    expect(result[1].severity).toBe("warning");
    expect(result[2].severity).toBe("positive");
  });

  it("skips benchmarks with zero sample_count", () => {
    const kpis = [makeKpi({ name: "roa", value: 10.0, formatted: "10.0%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 3.0, sample_count: 0 })];
    expect(generateInsights(kpis, benchmarks)).toHaveLength(0);
  });

  it("skips benchmarks with zero sector_average (avoids division by zero)", () => {
    const kpis = [makeKpi({ name: "roa", value: 5.0, formatted: "5.0%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 0 })];
    expect(generateInsights(kpis, benchmarks)).toHaveLength(0);
  });

  it("includes kpi.formatted in the generated message", () => {
    const kpis = [makeKpi({ name: "roa", value: 6.0, formatted: "6.0%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 3.0 })];
    const result = generateInsights(kpis, benchmarks);
    expect(result[0].message).toContain("6.0%");
  });
});

// ── BenchmarkInsightPanel rendering tests ────────────────────────────────────

describe("BenchmarkInsightPanel", () => {
  it("renders loading skeletons when isLoading=true", () => {
    render(<BenchmarkInsightPanel kpis={[]} benchmarks={[]} isLoading={true} />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders empty state when benchmarks array is empty", () => {
    render(<BenchmarkInsightPanel kpis={[]} benchmarks={[]} isLoading={false} />);
    expect(screen.getByText(/No benchmark data available yet/i)).toBeInTheDocument();
  });

  it("renders 'all metrics within' message when no actionable insights exist", () => {
    const kpis = [makeKpi({ name: "roa", value: 5.1, formatted: "5.1%", unit: "percent" })];
    const benchmarks = [makeBenchmark({ kpi_name: "roa", sector_average: 5.0 })];
    render(<BenchmarkInsightPanel kpis={kpis} benchmarks={benchmarks} isLoading={false} />);
    expect(screen.getByText(/All metrics within/i)).toBeInTheDocument();
  });

  it("renders insight panel title", () => {
    render(<BenchmarkInsightPanel kpis={[]} benchmarks={[]} />);
    expect(screen.getByText("Performance Insights")).toBeInTheDocument();
  });

  it("shows expand button when more than 3 insights exist", () => {
    const kpis = [
      makeKpi({ name: "roa", value: 0.5, formatted: "0.5%", unit: "percent" }),
      makeKpi({ name: "capital_adequacy_ratio", value: 5.0, formatted: "5.0%", unit: "percent" }),
      makeKpi({ name: "par30", value: 15.0, formatted: "15.0%", unit: "percent" }),
      makeKpi({ name: "liquid_funds_ratio", value: 3.0, formatted: "3.0%", unit: "percent" }),
    ];
    const benchmarks = [
      makeBenchmark({ kpi_name: "roa", sector_average: 3.0 }),
      makeBenchmark({ kpi_name: "capital_adequacy_ratio", sector_average: 10.0 }),
      makeBenchmark({ kpi_name: "par30", sector_average: 5.0 }),
      makeBenchmark({ kpi_name: "liquid_funds_ratio", sector_average: 15.0 }),
    ];
    render(<BenchmarkInsightPanel kpis={kpis} benchmarks={benchmarks} isLoading={false} />);
    const expandButton = screen.getByText(/See all/i);
    expect(expandButton).toBeInTheDocument();
  });

  it("expand button shows all insights when clicked", () => {
    const kpis = [
      makeKpi({ name: "roa", value: 0.5, formatted: "0.5%", unit: "percent" }),
      makeKpi({ name: "capital_adequacy_ratio", value: 5.0, formatted: "5.0%", unit: "percent" }),
      makeKpi({ name: "par30", value: 15.0, formatted: "15.0%", unit: "percent" }),
      makeKpi({ name: "liquid_funds_ratio", value: 3.0, formatted: "3.0%", unit: "percent" }),
    ];
    const benchmarks = [
      makeBenchmark({ kpi_name: "roa", sector_average: 3.0 }),
      makeBenchmark({ kpi_name: "capital_adequacy_ratio", sector_average: 10.0 }),
      makeBenchmark({ kpi_name: "par30", sector_average: 5.0 }),
      makeBenchmark({ kpi_name: "liquid_funds_ratio", sector_average: 15.0 }),
    ];
    render(<BenchmarkInsightPanel kpis={kpis} benchmarks={benchmarks} isLoading={false} />);
    const expandButton = screen.getByText(/See all/i);
    fireEvent.click(expandButton);
    expect(screen.getByText(/Show less/i)).toBeInTheDocument();
  });
});
