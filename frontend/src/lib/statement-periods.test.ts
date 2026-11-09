import { describe, expect, it } from "vitest";

import { periodEndMonths } from "@/lib/statement-periods";

describe("periodEndMonths", () => {
  it("offers the quarter ends when every cooperative reports quarterly", () => {
    expect(periodEndMonths(["QUARTERLY", "QUARTERLY"])).toEqual([3, 6, 9, 12]);
  });

  it("offers every month when every cooperative reports monthly", () => {
    expect(periodEndMonths(["MONTHLY"])).toHaveLength(12);
  });

  it("offers only the year end for a yearly cooperative", () => {
    expect(periodEndMonths(["YEARLY"])).toEqual([12]);
  });

  it("falls back to the year end when the frequencies differ", () => {
    expect(periodEndMonths(["QUARTERLY", "MONTHLY"])).toEqual([12]);
  });

  it("ignores cooperatives without a statement and falls back when none is known", () => {
    expect(periodEndMonths(["SEMI_ANNUAL", null])).toEqual([6, 12]);
    expect(periodEndMonths([null, undefined])).toEqual([12]);
  });
});
