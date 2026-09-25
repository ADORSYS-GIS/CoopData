import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NationalMetricSections } from "@/components/analytics/national/NationalMetricSections";
import type { MetricCard, MetricGroup } from "@/components/analytics/national/metrics";

const card = (key: string, label: string, value: string): MetricCard => ({
  key,
  label,
  value,
  tooltip: "",
});

const groups: MetricGroup[] = [
  {
    id: "membership",
    title: "Membership",
    metrics: [card("members", "Total members", "3,116"), card("dormant", "Dormant members", "667")],
  },
  { id: "loans", title: "Loans", metrics: [card("arrears", "Loans in arrears", "278")] },
];

const headline = [card("cooperatives", "Cooperatives", "4")];

describe("NationalMetricSections", () => {
  it("shows the headline row and every group when there is no query", () => {
    render(
      <NationalMetricSections headline={headline} groups={groups} query="" noResults="none" />,
    );

    expect(screen.getByText("Cooperatives")).toBeTruthy();
    expect(screen.getByText("Membership")).toBeTruthy();
    expect(screen.getByText("Loans in arrears")).toBeTruthy();
  });

  it("keeps only the metrics matching the query", () => {
    render(
      <NationalMetricSections
        headline={headline}
        groups={groups}
        query="dormant"
        noResults="none"
      />,
    );

    expect(screen.getByText("Dormant members")).toBeTruthy();
    expect(screen.queryByText("Loans in arrears")).toBeNull();
    expect(screen.queryByText("Cooperatives")).toBeNull();
  });

  it("shows the no-results message when nothing matches", () => {
    render(
      <NationalMetricSections
        headline={headline}
        groups={groups}
        query="zzz"
        noResults="nothing found"
      />,
    );

    expect(screen.getByText("nothing found")).toBeTruthy();
  });
});
