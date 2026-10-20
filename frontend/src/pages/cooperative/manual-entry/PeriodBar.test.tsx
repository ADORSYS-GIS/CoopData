import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PeriodBar } from "./PeriodBar";
import { periodFromSubmission } from "./period";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

describe("PeriodBar", () => {
  it("shows a quarter, its months and the year start, without any control to change them", () => {
    const period = periodFromSubmission({
      reporting_year: 2025,
      period_type: "Quarterly",
      period_value: "Q2",
      fiscal_start_month: 7,
    });

    render(<PeriodBar period={period} />);

    expect(screen.getByText("Q2 2025")).toBeInTheDocument();
    expect(screen.getByText("Oct – Dec")).toBeInTheDocument();
    expect(screen.getByText(/yearStarts.*Jul/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows only the year for a yearly return", () => {
    render(<PeriodBar period={periodFromSubmission({ reporting_year: 2024 })} />);

    expect(screen.getByText(/periodBar.yearly.*2024/)).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });

  it("names a full-year monthly return", () => {
    const period = periodFromSubmission({
      reporting_year: 2025,
      period_type: "MONTHLY",
      period_value: "FULL_YEAR",
    });

    render(<PeriodBar period={period} />);

    expect(screen.getByText(/periodBar.fullYear.*2025/)).toBeInTheDocument();
  });
});
