import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatementDateSelect } from "@/components/analytics/StatementDateSelect";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "common.months.dec" ? "31. Dec " : key),
  }),
}));

describe("StatementDateSelect", () => {
  it("shows just the year when only the year end is on offer", () => {
    render(<StatementDateSelect months={[12]} value="12" year={2025} onChange={() => {}} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("2025");
    expect(screen.getByRole("combobox")).not.toHaveTextContent("31. Dec");
  });

  it("keeps the period date when several period ends are on offer", () => {
    render(<StatementDateSelect months={[6, 12]} value="12" year={2025} onChange={() => {}} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("31. Dec 2025");
  });
});
