import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { BenchmarkMatrix } from "@/components/analytics/benchmark-matrix";
import type { BenchmarkRow } from "@/components/analytics/benchmark-types";

const coop: BenchmarkRow = {
  cooperative_id: "c1",
  name: "multiP",
  region: "Hhohho",
  sector: "agriculture",
  has_data: true,
};

const renderMatrix = (getCompareValue: (key: string) => number | null) =>
  render(
    <BenchmarkMatrix
      metrics={[
        { key: "members", label: "Registered Members", unit: "count", group: "m", description: "" },
      ]}
      groups={{
        m: { label: "Membership", icon: Users, colorClass: "", comboboxIconClass: "" },
      }}
      selectedCoop={coop}
      compareTargetName="National Average"
      getValue={() => 220}
      getCompareValue={getCompareValue}
      selectedKpi="members"
      onSelectKpi={() => {}}
      formatValue={(v) => String(v)}
      labels={{
        title: "Comparison",
        subtitle: "",
        searchPlaceholder: "",
        allCategories: (n) => `All (${n})`,
        comparisonAll: "All",
        metricKpi: "Metric",
        variance: "Variance",
        status: "Status",
        legendHealthy: "Healthy",
        legendWatch: "Watch",
      }}
    />,
  );

describe("BenchmarkMatrix", () => {
  it("shows no average, variance or verdict when there are not enough peers", () => {
    renderMatrix(() => null);

    const row = screen.getByText("Registered Members").closest("tr");
    expect(row?.textContent).not.toMatch(/Healthy|Watch|\+220/);
    expect(row?.querySelectorAll("td")[2]?.textContent).toBe("—");
  });

  it("compares with the peer average when there is one", () => {
    renderMatrix(() => 200);

    const row = screen.getByText("Registered Members").closest("tr");
    expect(row?.textContent).toMatch(/\+20/);
    expect(row?.textContent).toMatch(/Healthy/);
  });
});
