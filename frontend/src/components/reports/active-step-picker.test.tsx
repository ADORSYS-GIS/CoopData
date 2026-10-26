import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActiveStepPicker } from "./active-step-picker";
import type { YearProgress } from "@/lib/period-rules";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const halfFiledMonthlyYear: YearProgress = {
  cooperativeId: "coop-1",
  year: 2025,
  periodType: "MONTHLY",
  periods: MONTHS.map((period, index) => ({
    period,
    state: index < 6 ? ("approved" as const) : ("missing" as const),
  })),
  approved: 6,
  expected: 12,
  complete: false,
};

function renderSubmissionStep() {
  return render(
    <ActiveStepPicker
      activeStepKey="submission"
      isLoadingSubmissions={false}
      federationList={[]}
      selectedFedId=""
      onSelectFed={vi.fn()}
      apexList={[]}
      selectedApexId=""
      onSelectApex={vi.fn()}
      cooperativeList={[]}
      selectedCoopId=""
      onSelectCoop={vi.fn()}
      filteredSubmissions={[
        {
          id: "sub-2025",
          reporting_year: 2025,
          status: "approved",
          created_at: "2026-01-01T00:00:00Z",
          pending: halfFiledMonthlyYear,
        },
      ]}
      selectedSubmissionId=""
      onSelectSubmission={vi.fn()}
      availableYears={[]}
      selectedYear=""
      onSelectYear={vi.fn()}
    />,
  );
}

describe("ActiveStepPicker, a year that is not complete", () => {
  it("lists the year as unavailable, not as a report to pick", () => {
    renderSubmissionStep();

    const row = screen.getByTestId("report-year-pending-2025");

    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the progress and a pill for each of the twelve months", () => {
    renderSubmissionStep();

    const row = screen.getByTestId("report-year-pending-2025");

    expect(within(row).getByText(/reportingYears\.approvedOf/)).toBeInTheDocument();
    expect(within(row).getAllByRole("listitem")).toHaveLength(12);
  });

  it("stacks the pills under the text so twelve months never squeeze the sentence", () => {
    renderSubmissionStep();

    const row = screen.getByTestId("report-year-pending-2025");

    expect(row.className).toContain("flex-col");
    expect(row.className).not.toMatch(/(^|\s)(sm|md|lg):flex-row/);
  });
});
