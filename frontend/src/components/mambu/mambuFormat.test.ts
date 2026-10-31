import { describe, it, expect } from "vitest";
import { itemTone, periodLabel, previousMonth, runTone } from "./mambuFormat";

describe("mambuFormat", () => {
  it("labels a period with the month name", () => {
    expect(periodLabel(2026, 9)).toBe("September 2026");
  });

  it("returns the previous month and wraps over the year", () => {
    expect(previousMonth(new Date(2026, 9, 15))).toEqual({ year: 2026, month: 9 });
    expect(previousMonth(new Date(2026, 0, 3))).toEqual({ year: 2025, month: 12 });
  });

  it("maps item and run statuses to tones", () => {
    expect(itemTone("synced")).toBe("success");
    expect(itemTone("flagged")).toBe("warning");
    expect(itemTone("failed")).toBe("danger");
    expect(itemTone("skipped")).toBe("neutral");
    expect(runTone("running")).toBe("info");
    expect(runTone("completed")).toBe("success");
  });
});
