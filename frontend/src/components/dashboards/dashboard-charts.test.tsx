import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { StatusBreakdownDonut } from "./dashboard-charts";

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({ t: (key: string) => key.split(".").pop() }),
}));

vi.mock("recharts", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Box,
    PieChart: Box,
    Pie: Box,
    Cell: () => null,
    Tooltip: () => null,
    AreaChart: Box,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
  };
});

describe("StatusBreakdownDonut", () => {
  it("lists each status on its own row with its count and share", () => {
    render(
      <StatusBreakdownDonut
        approved={11}
        pending={0}
        rejected={0}
        draft={4}
        totalLabel="Submissions"
        emptyLabel="none"
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Submissions" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["approved1173%", "draft427%"]);
  });
});
