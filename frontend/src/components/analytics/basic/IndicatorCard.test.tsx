import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IndicatorCard } from "@/components/analytics/basic/IndicatorCard";
import { makeIndicator } from "@/test-fixtures/basicDashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key.split(".").pop() ?? key,
    i18n: { exists: () => false },
  }),
}));

const scope = { currency: "USD" };

describe("IndicatorCard", () => {
  it("shows the formatted value and the delta with the right colour class", () => {
    render(
      <IndicatorCard
        indicator={makeIndicator({
          key: "par_gt_30_pct",
          group: "risk",
          unit: "percent",
          value: 2.94,
          change_pct: -29.8,
        })}
        scope={scope}
      />,
    );
    expect(screen.getByText("2.94%")).toBeTruthy();
    const delta = screen.getByText("-29.8%");
    expect(delta.className).toContain("text-success");
  });

  it("marks a rising risk metric as bad", () => {
    render(
      <IndicatorCard
        indicator={makeIndicator({
          key: "par_gt_30_pct",
          group: "risk",
          unit: "percent",
          value: 6,
          change_pct: 10,
        })}
        scope={scope}
      />,
    );
    expect(screen.getByText("+10.0%").className).toContain("text-destructive");
  });

  it("shows a dash and a not-reported badge instead of zero", () => {
    render(
      <IndicatorCard
        indicator={makeIndicator({ value: null, status: "not_reported" })}
        scope={scope}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("notReported")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("badges approximate values", () => {
    render(<IndicatorCard indicator={makeIndicator({ status: "approximate" })} scope={scope} />);
    expect(screen.getByText("approximate")).toBeTruthy();
  });
});
