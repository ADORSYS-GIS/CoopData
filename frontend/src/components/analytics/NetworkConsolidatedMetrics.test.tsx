import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NetworkConsolidatedMetrics } from "./NetworkConsolidatedMetrics";
import { yearSeriesQuery } from "@/hooks/analytics/usePeriodSeries";

const seriesCalls = vi.hoisted(() => [] as unknown[]);

vi.mock("@/hooks/analytics/usePeriodSeries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/analytics/usePeriodSeries")>();
  return {
    ...actual,
    usePeriodSeries: (params: unknown) => {
      seriesCalls.push(params);
      return { data: { period_type: "YEARLY", points: [] } };
    },
  };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/analytics/national/NationalCharts", () => ({ NationalCharts: () => null }));
vi.mock("@/components/analytics/national/NationalMetricSections", () => ({
  NationalMetricSections: () => null,
}));
vi.mock("@/components/analytics/basic/IndicatorSearch", () => ({ IndicatorSearch: () => null }));

describe("yearSeriesQuery", () => {
  it("keeps the scope and the chosen year but asks for whole years", () => {
    expect(
      yearSeriesQuery({
        reportingYear: 2023,
        periodType: "QUARTERLY",
        periodValue: "Q4",
        apexId: "a1",
      }),
    ).toEqual({ reportingYear: 2023, periodType: "YEARLY", periodValue: undefined, apexId: "a1" });
  });
});

describe("NetworkConsolidatedMetrics", () => {
  it("builds the indicator cards from whole years even when quarters are chosen", () => {
    render(
      <NetworkConsolidatedMetrics
        totalCooperatives={2}
        cooperativesWithData={2}
        seriesQuery={{ reportingYear: 2023, periodType: "QUARTERLY", periodValue: "Q4" }}
      />,
    );

    expect(seriesCalls).toContainEqual({
      reportingYear: 2023,
      periodType: "YEARLY",
      periodValue: undefined,
    });
  });
});
