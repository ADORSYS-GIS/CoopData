import { describe, it, expect } from "vitest";
import { loanQualityShares } from "./loan-quality";

describe("loanQualityShares", () => {
  it("has no shares when there is no loan data", () => {
    expect(loanQualityShares(undefined, undefined)).toBeNull();
  });

  it("splits the portfolio from PAR 30 and PAR 90", () => {
    expect(loanQualityShares(12, 5)).toEqual({ performing: 88, watchList: 7, nonPerforming: 5 });
  });

  it("keeps shares within 0-100% when overdue amounts exceed the loans", () => {
    expect(loanQualityShares(443, 336)).toEqual({
      performing: 0,
      watchList: 0,
      nonPerforming: 100,
    });
  });
});
