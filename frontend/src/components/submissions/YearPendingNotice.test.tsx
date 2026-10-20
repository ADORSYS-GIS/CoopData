import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { YearPendingNotice } from "./YearPendingNotice";
import type { YearProgress } from "@/lib/period-rules";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key.split(".").pop() }),
}));

const pending: YearProgress = {
  cooperativeId: "c1",
  year: 2024,
  periodType: "QUARTERLY",
  periods: [
    { period: "Q1", state: "draft" },
    { period: "Q2", state: "draft" },
    { period: "Q3", state: "draft" },
    { period: "Q4", state: "approved" },
  ],
  approved: 1,
  expected: 4,
  complete: false,
};

describe("YearPendingNotice", () => {
  it("names the complete year shown instead", () => {
    render(<YearPendingNotice pending={pending} shownYear={2023} />);

    expect(screen.getByTestId("year-pending-notice")).toHaveTextContent("showingYear");
  });

  it("suggests another year when the user picked this one", () => {
    render(<YearPendingNotice pending={pending} chosenYear />);

    expect(screen.getByTestId("year-pending-notice")).toHaveTextContent("chooseAnotherYear");
  });

  it("says there is no complete year otherwise", () => {
    render(<YearPendingNotice pending={pending} />);

    expect(screen.getByTestId("year-pending-notice")).toHaveTextContent("noCompleteYear");
  });
});
