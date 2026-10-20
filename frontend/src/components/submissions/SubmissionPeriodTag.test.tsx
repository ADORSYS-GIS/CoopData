import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubmissionPeriodTag } from "./SubmissionPeriodTag";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key.split(".").pop() }),
}));

describe("SubmissionPeriodTag", () => {
  it("names a quarter and the months it covers", () => {
    render(
      <SubmissionPeriodTag
        submission={{ reporting_year: 2024, period_type: "QUARTERLY", period_value: "Q2" }}
      />,
    );

    expect(screen.getByTestId("submission-period")).toHaveTextContent("Q2 (Apr – Jun) · quarterly");
  });

  it("follows the fiscal start month", () => {
    render(
      <SubmissionPeriodTag
        submission={{
          reporting_year: 2024,
          period_type: "SemiAnnual",
          period_value: "H1",
          fiscal_start_month: 7,
        }}
      />,
    );

    expect(screen.getByTestId("submission-period")).toHaveTextContent("H1 (Jul – Dec)");
  });

  it("names a single month once", () => {
    render(
      <SubmissionPeriodTag
        submission={{ reporting_year: 2025, period_type: "MONTHLY", period_value: "03" }}
      />,
    );

    expect(screen.getByTestId("submission-period")).toHaveTextContent("Mar · monthly");
  });

  it("shows nothing for a yearly return", () => {
    const { container } = render(
      <SubmissionPeriodTag
        submission={{ reporting_year: 2025, period_type: "YEARLY", period_value: "2025" }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
