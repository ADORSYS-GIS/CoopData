import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReportingYearsPanel } from "./ReportingYearsPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("@/components/app-shell", () => ({
  Card: ({
    title,
    action,
    children,
  }: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
  }) => (
    <section aria-label={title}>
      {action}
      {children}
    </section>
  ),
}));

const sub = (year: number, period_type: string, period_value: string, status: string) => ({
  cooperative_id: "c1",
  reporting_year: year,
  period_type,
  period_value,
  status,
});

describe("ReportingYearsPanel", () => {
  it("marks a year counted once every period is approved", () => {
    render(<ReportingYearsPanel submissions={[sub(2025, "YEARLY", "2025", "approved")]} />);

    const row = screen.getByTestId("reporting-year-2025");
    expect(within(row).getByText("reportingYears.counted")).toBeInTheDocument();
  });

  it("shows the progress and each quarter's state while a year is incomplete", () => {
    render(
      <ReportingYearsPanel
        submissions={[
          sub(2026, "QUARTERLY", "Q1", "approved"),
          sub(2026, "QUARTERLY", "Q3", "approved"),
          sub(2026, "QUARTERLY", "Q2", "submitted"),
        ]}
      />,
    );

    const row = screen.getByTestId("reporting-year-2026");
    expect(within(row).getByText(/approvedOf.*"approved":2.*"expected":4/)).toBeInTheDocument();
    expect(within(row).getByText("reportingYears.notCounted")).toBeInTheDocument();
    const pills = within(row)
      .getAllByRole("listitem")
      .filter((li) => li.dataset.state);
    expect(pills.map((li) => [li.textContent, li.dataset.state])).toEqual([
      ["Q1", "approved"],
      ["Q2", "in_review"],
      ["Q3", "approved"],
      ["Q4", "missing"],
    ]);
  });

  it("names monthly periods by month", () => {
    render(<ReportingYearsPanel submissions={[sub(2024, "MONTHLY", "03", "draft")]} />);

    expect(screen.getByLabelText("Mar: reportingYears.state.draft")).toBeInTheDocument();
  });

  it("renders nothing without submissions", () => {
    const { container } = render(<ReportingYearsPanel submissions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
