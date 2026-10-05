import { describe, expect, it } from "vitest";

import { periodReminders, toPeriodType, yearLock } from "@/lib/period-rules";

const NOW = new Date("2026-09-25T00:00:00Z");

describe("yearLock", () => {
  it("returns null when the year has no submission", () => {
    expect(yearLock([], 2017)).toBeNull();
  });

  it("locks the frequency of the first submission of the year", () => {
    const lock = yearLock(
      [{ reporting_year: 2017, period_type: "QUARTERLY", period_value: "Q1", status: "approved" }],
      2017,
    );

    expect(lock).toEqual({ year: 2017, periodType: "QUARTERLY", onlyDrafts: false });
  });

  it("reports when every submission of the year is still a draft", () => {
    const lock = yearLock(
      [{ reporting_year: 2017, period_type: "YEARLY", period_value: "2017", status: "draft" }],
      2017,
    );

    expect(lock?.onlyDrafts).toBe(true);
  });
});

describe("periodReminders", () => {
  it("lists the quarters still missing for a past year", () => {
    const reminders = periodReminders(
      [{ reporting_year: 2017, period_type: "QUARTERLY", period_value: "Q1" }],
      NOW,
    );

    expect(reminders).toEqual([
      { year: 2017, periodType: "QUARTERLY", missing: ["Q2", "Q3", "Q4"] },
    ]);
  });

  it("does not remind for quarters that have not started in the current year", () => {
    const reminders = periodReminders(
      [{ reporting_year: 2026, period_type: "QUARTERLY", period_value: "Q1" }],
      NOW,
    );

    expect(reminders[0]?.missing).toEqual(["Q2", "Q3"]);
  });

  it("never reminds for yearly submissions", () => {
    expect(
      periodReminders([{ reporting_year: 2017, period_type: "YEARLY", period_value: "2017" }], NOW),
    ).toEqual([]);
  });

  it("treats month 1 and 01 as the same month", () => {
    const reminders = periodReminders(
      [{ reporting_year: 2017, period_type: "MONTHLY", period_value: "1" }],
      NOW,
    );

    expect(reminders[0]?.missing).toHaveLength(11);
  });

  it("returns nothing when the year is complete", () => {
    const reminders = periodReminders(
      ["H1", "H2"].map((value) => ({
        reporting_year: 2017,
        period_type: "SEMI_ANNUAL",
        period_value: value,
      })),
      NOW,
    );

    expect(reminders).toEqual([]);
  });
});

describe("toPeriodType", () => {
  it("falls back to yearly for unknown values", () => {
    expect(toPeriodType("weekly")).toBe("YEARLY");
    expect(toPeriodType("semi_annual")).toBe("SEMI_ANNUAL");
  });
});
