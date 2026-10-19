import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateBlockNotice } from "./CreateBlockNotice";
import { PeriodSelector } from "./PeriodSelector";
import type { YearLock } from "@/lib/period-rules";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({ t }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

const lock: YearLock = {
  year: 2024,
  periodType: "QUARTERLY",
  onlyDrafts: false,
  fiscalStartMonth: 7,
  taken: ["Q1", "Q4"],
};

const renderSelector = () =>
  render(
    <PeriodSelector
      year={2024}
      periodType="QUARTERLY"
      periodValue="Q2"
      fiscalStartMonth={7}
      lock={lock}
      onTypeChange={vi.fn()}
      onValueChange={vi.fn()}
      onFiscalStartChange={vi.fn()}
    />,
  );

describe("PeriodSelector with a year already started", () => {
  it("keeps the year's start month and greys out the other months", () => {
    renderSelector();

    expect(screen.getByRole("button", { name: "Jul" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Jan" })).toBeDisabled();
    expect(screen.getByText(/lockedStartMonth.*Jul/)).toBeInTheDocument();
  });

  it("greys out the quarters already created", () => {
    renderSelector();

    expect(screen.getByRole("button", { name: /^Q1/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Q4/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Q2/ })).toBeEnabled();
    expect(screen.getAllByText("periodReminders.alreadyCreated")).toHaveLength(2);
  });
});

describe("CreateBlockNotice", () => {
  it("explains a different start month", () => {
    render(<CreateBlockNotice block={{ reason: "startMonth", month: 7 }} year={2024} />);

    expect(screen.getByTestId("create-block-notice")).toHaveTextContent(
      /block.startMonth.*"month":"Jul"/,
    );
  });

  it("names a month already created", () => {
    render(<CreateBlockNotice block={{ reason: "taken", period: "03" }} year={2025} />);

    expect(screen.getByTestId("create-block-notice")).toHaveTextContent(/"period":"Mar"/);
  });
});
