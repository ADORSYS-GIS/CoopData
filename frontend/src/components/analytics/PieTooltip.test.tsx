import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PieTooltip } from "@/components/analytics/PieTooltip";

const payload = [{ name: "Women", value: 30, payload: { fill: "var(--chart-1)" } }];

describe("PieTooltip", () => {
  it("shows the slice name, its value and its share of the total", () => {
    render(<PieTooltip active payload={payload} total={120} />);

    expect(screen.getByText("Women")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("25.0%")).toBeTruthy();
  });

  it("renders nothing when the pointer is not over a slice", () => {
    const { container } = render(<PieTooltip active={false} payload={payload} total={120} />);

    expect(container.firstChild).toBeNull();
  });

  it("can hide the share and show a detail line instead", () => {
    render(
      <PieTooltip
        active
        payload={[{ name: "A", value: 50, payload: { share_pct: 12.5 } }]}
        total={200}
        showPercent={false}
        detail={(slice) => `${String(slice["share_pct"])}% of total`}
      />,
    );

    expect(screen.queryByText("25.0%")).toBeNull();
    expect(screen.getByText("12.5% of total")).toBeTruthy();
  });
});
