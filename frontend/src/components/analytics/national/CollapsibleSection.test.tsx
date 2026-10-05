import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) => `${key}:${options?.title ?? ""}`,
  }),
}));

describe("CollapsibleSection", () => {
  it("shows its content by default", () => {
    render(
      <CollapsibleSection id="s" title="Loans">
        <p>content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("content")).toBeTruthy();
  });

  it("folds and unfolds when the title is clicked", () => {
    render(
      <CollapsibleSection id="s" title="Loans">
        <p>content</p>
      </CollapsibleSection>,
    );
    const toggle = screen.getByRole("button");

    fireEvent.click(toggle);
    expect(screen.queryByText("content")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("starts folded when asked to", () => {
    render(
      <CollapsibleSection id="s" title="Loans" defaultOpen={false}>
        <p>content</p>
      </CollapsibleSection>,
    );

    expect(screen.queryByText("content")).toBeNull();
  });
});
