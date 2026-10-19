import { describe, expect, it } from "vitest";

import { monthsCoveredLabel, periodFromSubmission, periodMonths, periodShortLabel } from "./period";

describe("periodFromSubmission", () => {
  it("reads the period the submission was created for", () => {
    const period = periodFromSubmission({
      reporting_year: 2025,
      period_type: "Quarterly",
      period_value: "q2",
      fiscal_start_month: 7,
    });

    expect(period).toEqual({
      year: 2025,
      periodType: "QUARTERLY",
      periodValue: "Q2",
      startMonth: 7,
      accountingYear: "fiscal",
    });
  });

  it("uses the year as the value of a yearly return and January as the default start", () => {
    const period = periodFromSubmission({ reporting_year: 2024, period_type: "YEARLY" });

    expect(period.periodValue).toBe("2024");
    expect(period.startMonth).toBe(1);
    expect(period.accountingYear).toBe("calendar");
  });

  it("understands the API spelling of semi-annual", () => {
    expect(periodFromSubmission({ period_type: "SemiAnnual", period_value: "H2" }).periodType).toBe(
      "SEMI_ANNUAL",
    );
  });
});

describe("periodMonths", () => {
  it("returns the annual column for a yearly return", () => {
    expect(periodMonths("YEARLY", "2025", 1)).toEqual([0]);
  });

  it("follows the fiscal start for quarters and halves", () => {
    expect(periodMonths("QUARTERLY", "Q2", 1)).toEqual([4, 5, 6]);
    expect(periodMonths("QUARTERLY", "Q1", 11)).toEqual([11, 12, 1]);
    expect(periodMonths("SEMI_ANNUAL", "H2", 7)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("returns one calendar month, or all twelve for a full-year monthly return", () => {
    expect(periodMonths("MONTHLY", "03", 7)).toEqual([3]);
    expect(periodMonths("MONTHLY", "FULL_YEAR", 4)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3,
    ]);
  });
});

describe("labels", () => {
  it("describes the months covered", () => {
    expect(monthsCoveredLabel([4, 5, 6])).toBe("Apr – Jun");
    expect(monthsCoveredLabel([3])).toBe("Mar");
    expect(monthsCoveredLabel([0])).toBe("");
  });

  it("names the period", () => {
    expect(
      periodShortLabel(periodFromSubmission({ period_type: "QUARTERLY", period_value: "Q3" })),
    ).toBe("Q3");
    expect(
      periodShortLabel(periodFromSubmission({ period_type: "MONTHLY", period_value: "03" })),
    ).toBe("Mar");
    expect(periodShortLabel(periodFromSubmission({ reporting_year: 2025 }))).toBe("2025");
  });
});
