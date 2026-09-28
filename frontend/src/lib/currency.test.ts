import { describe, expect, it } from "vitest";

import { describeRate, formatNative, formatSzl, toSzl } from "@/lib/currency";

describe("currency", () => {
  const rates = { ZAR: 1, SZL: 18.5 };

  it("does not convert amounts — returns the value unchanged", () => {
    expect(toSzl(5_383_818, "SZL", rates)).toBe(5_383_818);
    expect(toSzl(100, "ZAR", rates)).toBe(100);
    expect(toSzl(100, "XYZ", rates)).toBe(100);
  });

  it("keeps negative amounts negative", () => {
    expect(toSzl(-1_786_066, "SZL", rates)).toBe(-1_786_066);
  });

  it("formats SZL and native amounts with their symbols", () => {
    expect(formatSzl(291_017.19)).toBe("SZL 291,017.19");
    expect(formatNative(1000, "ZAR")).toBe("ZAR 1,000.00");
  });

  it("describes a frozen rate with its date and source", () => {
    expect(
      describeRate({
        currency_code: "SZL",
        rate_to_zar: 18.5,
        effective_date: "2026-09-24",
        source: "Central Bank of Eswatini",
        frozen: true,
      }),
    ).toBe(
      "1 SZL = 18.5 SZL (set on 24 Sep 2026; source: Central Bank of Eswatini; frozen at approval)",
    );
  });

  it("marks a non-frozen rate as current", () => {
    expect(describeRate({ currency_code: "SZL", rate_to_zar: 20, frozen: false })).toContain(
      "current rate, not yet frozen",
    );
  });
});
