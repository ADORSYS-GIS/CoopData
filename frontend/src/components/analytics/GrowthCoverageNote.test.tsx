import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GrowthCoverageNote } from "./GrowthCoverageNote";
import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => `${key} ${JSON.stringify(options)}`,
  }),
}));

const point = (label: string, comparison?: PeriodSeriesPoint["comparison"]) =>
  ({ period_label: label, comparison }) as PeriodSeriesPoint;

const totals = {} as NonNullable<PeriodSeriesPoint["comparison"]>["current"];

describe("GrowthCoverageNote", () => {
  it("names the cooperatives left out of the comparison", () => {
    render(
      <GrowthCoverageNote
        previous={point("2023")}
        point={point("2024", {
          cooperatives_compared: 1,
          current: totals,
          previous: totals,
          new_cooperatives: [],
          missing_cooperatives: ["saccocoop"],
        })}
      />,
    );

    const note = screen.getByTestId("growth-coverage-note");
    expect(note).toHaveTextContent(/compared.*"count":1.*"current":"2024".*"previous":"2023"/);
    expect(note).toHaveTextContent(/missing.*"names":"saccocoop"/);
  });

  it("stays hidden when both years have the same cooperatives", () => {
    const { container } = render(
      <GrowthCoverageNote
        previous={point("2021")}
        point={point("2022", {
          cooperatives_compared: 1,
          current: totals,
          previous: totals,
          new_cooperatives: [],
          missing_cooperatives: [],
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
