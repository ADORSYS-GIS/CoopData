import { describe, expect, it } from "vitest";

import { accountValuesAt, provisionAmount } from "@/lib/statement-grid";

const line = (account_code: number, month: number, value_usd: number) => ({
  account_code,
  month,
  value_usd,
});

describe("accountValuesAt", () => {
  const monthly = [line(1999, 1, 100), line(1999, 2, 110), line(4999, 1, 10), line(4999, 2, 12)];

  it("takes balances from the month and sums income year to date", () => {
    expect(accountValuesAt(monthly, 2)).toEqual({ 1999: 110, 4999: 22 });
  });

  it("uses the latest reported month when none is chosen", () => {
    expect(accountValuesAt(monthly, null)?.[1999]).toBe(110);
  });

  it("returns null for a month the statement does not cover", () => {
    expect(accountValuesAt(monthly, 12)).toBeNull();
  });

  it("lets an annual statement answer for any month", () => {
    expect(accountValuesAt([line(1999, 0, 500)], 6)).toEqual({ 1999: 500 });
  });

  it("ignores month 0 rows when monthly rows exist", () => {
    expect(accountValuesAt([...monthly, line(1999, 0, 9999)], 1)?.[1999]).toBe(100);
  });

  it("returns null without rows", () => {
    expect(accountValuesAt([], 12)).toBeNull();
  });
});

describe("provisionAmount", () => {
  it("returns a positive amount for negative stored provisions", () => {
    expect(provisionAmount({ 1250: -74 })).toBe(74);
  });
});
