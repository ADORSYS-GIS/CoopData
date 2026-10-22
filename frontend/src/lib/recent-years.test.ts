import { describe, expect, it } from "vitest";

import { recentYears } from "./recent-years";

describe("recentYears", () => {
  it("starts at the current year and counts back, newest first", () => {
    expect(recentYears(4, new Date(2026, 9, 22))).toEqual(["2026", "2025", "2024", "2023"]);
  });

  it("rolls forward with the calendar so the current year is always offered", () => {
    expect(recentYears(4, new Date(2027, 0, 1))[0]).toBe("2027");
  });

  it("returns an empty list for a non-positive count", () => {
    expect(recentYears(0)).toEqual([]);
    expect(recentYears(-2)).toEqual([]);
  });
});
