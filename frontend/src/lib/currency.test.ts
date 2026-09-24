import { describe, expect, it } from "vitest";

import { describeRate, formatNative, formatUsd, toUsd } from "@/lib/currency";

describe("currency", () => {
  const rates = { USD: 1, SZL: 18.5 };

  it("converts native amounts to USD using the configured rate", () => {
    expect(toUsd(5_383_818, "SZL", rates)).toBeCloseTo(291_017.19, 2);
  });

  it("returns USD amounts unchanged", () => {
    expect(toUsd(100, "USD", rates)).toBe(100);
  });

  it("does not alter the value when no rate is configured", () => {
    expect(toUsd(100, "XYZ", rates)).toBe(100);
  });

  it("keeps negative amounts negative", () => {
    expect(toUsd(-1_786_066, "SZL", rates)).toBeCloseTo(-96_544.11, 2);
  });

  it("formats USD and native amounts with their symbols", () => {
    expect(formatUsd(291_017.19)).toBe("$291,017.19");
    expect(formatNative(1000, "USD")).toBe("$1,000.00");
  });

  it("describes a frozen rate with its date and source", () => {
    expect(
      describeRate({
        currency_code: "SZL",
        rate_to_usd: 18.5,
        effective_date: "2026-09-24",
        source: "Central Bank of Eswatini",
        frozen: true,
      }),
    ).toBe(
      "Converted at 1 USD = 18.5 SZL (set on 24 Sep 2026; source: Central Bank of Eswatini; frozen at approval)",
    );
  });

  it("marks a non-frozen rate as current", () => {
    expect(describeRate({ currency_code: "SZL", rate_to_usd: 20, frozen: false })).toContain(
      "current rate, not yet frozen",
    );
  });
});
