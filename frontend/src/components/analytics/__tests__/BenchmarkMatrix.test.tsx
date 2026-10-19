import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { BenchmarkMatrix, gapStatus } from "@/components/analytics/benchmark-matrix";
import { formatBenchmarkValue } from "@/components/analytics/benchmark-utils";
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
        legendCritical: "Critical",
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

describe("gapStatus", () => {
  it("rates a value by how far it falls behind the peers", () => {
    expect(gapStatus(18.94, 19.35, false)).toBe("healthy");
    expect(gapStatus(4_198_500, 5_159_250, false)).toBe("watch");
    expect(gapStatus(100_000, 150_000, false)).toBe("critical");
  });

  it("treats doing better than the peers as healthy, whichever way is better", () => {
    expect(gapStatus(220, 150, false)).toBe("healthy");
    expect(gapStatus(2.38, 1.63, true)).toBe("critical");
    expect(gapStatus(1.63, 2.38, true)).toBe("healthy");
  });
});

describe("formatBenchmarkValue", () => {
  it("shortens negative amounts like positive ones", () => {
    expect(formatBenchmarkValue(-960_750, "SZL")).toBe("SZL -960.8K");
    expect(formatBenchmarkValue(-1_250_000, "SZL")).toBe("SZL -1.25M");
    expect(formatBenchmarkValue(960_750, "SZL")).toBe("SZL 960.8K");
  });
});
