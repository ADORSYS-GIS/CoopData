import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { YearPickerFilter } from "@/components/shared/YearPickerFilter";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const setup = (value = "all", onValueChange = vi.fn()) => {
  render(
    <YearPickerFilter
      label="Year"
      value={value}
      onValueChange={onValueChange}
      latestValue="all"
      latestLabel="Latest available"
      currentYear={2026}
    />,
  );
  return onValueChange;
};

describe("YearPickerFilter", () => {
  it("shows the latest-available label until a year is chosen", () => {
    setup();

    expect(screen.getByRole("button", { name: "Year" }).textContent).toContain("Latest available");
  });

  it("opens a year grid and reports the chosen year", () => {
    const onChange = setup();

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(onChange).toHaveBeenCalledWith("2024");
  });

  it("reaches older years by paging back", () => {
    const onChange = setup();

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous years" }));
    fireEvent.click(screen.getByRole("button", { name: "2005" }));

    expect(onChange).toHaveBeenCalledWith("2005");
  });

  it("can go back to latest available", () => {
    const onChange = setup("2019");

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    fireEvent.click(screen.getByRole("button", { name: "Latest available" }));

    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("does not allow future years", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Year" }));

    expect((screen.getByRole("button", { name: "2027" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
