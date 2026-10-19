import { describe, expect, it } from "vitest";

import {
  choiceForYear,
  createBlock,
  periodReminders,
  toPeriodType,
  yearLock,
  yearProgress,
} from "@/lib/period-rules";

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

    expect(lock).toEqual({
      year: 2017,
      periodType: "QUARTERLY",
      onlyDrafts: false,
      fiscalStartMonth: undefined,
      taken: ["Q1"],
    });
  });

  it("keeps the start month and the periods already created", () => {
    const lock = yearLock(
      [
        {
          reporting_year: 2024,
          period_type: "QUARTERLY",
          period_value: "Q4",
          fiscal_start_month: 7,
        },
        {
          reporting_year: 2024,
          period_type: "QUARTERLY",
          period_value: "q1",
          fiscal_start_month: 7,
        },
      ],
      2024,
    );

    expect(lock?.fiscalStartMonth).toBe(7);
    expect(lock?.taken).toEqual(["Q4", "Q1"]);
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

describe("yearProgress", () => {
  const sub = (
    year: number,
    period_type: string,
    period_value: string,
    status: string,
    cooperative_id = "c1",
  ) => ({ cooperative_id, reporting_year: year, period_type, period_value, status });

  it("counts an approved yearly return as a complete year", () => {
    const [year] = yearProgress([sub(2025, "YEARLY", "2025", "approved")]);

    expect(year).toMatchObject({ year: 2025, complete: true, approved: 1, expected: 1 });
    expect(year?.periods).toEqual([{ period: "2025", state: "approved" }]);
  });

  it("needs every quarter approved, whatever the order they were filed in", () => {
    const [year] = yearProgress([
      sub(2026, "QUARTERLY", "Q3", "approved"),
      sub(2026, "QUARTERLY", "Q1", "approved"),
      sub(2026, "QUARTERLY", "Q2", "in_review"),
    ]);

    expect(year).toMatchObject({ complete: false, approved: 2, expected: 4 });
    expect(year?.periods.map((p) => p.state)).toEqual([
      "approved",
      "in_review",
      "approved",
      "missing",
    ]);
  });

  it("completes the year once the last quarter is approved, anchored on Q4", () => {
    const [year] = yearProgress(
      ["Q4", "Q2", "Q1", "Q3"].map((q) => ({ ...sub(2026, "QUARTERLY", q, "approved"), id: q })),
    );

    expect(year?.complete).toBe(true);
    expect(year?.anchorId).toBe("Q4");
  });

  it("has no anchor while the year is incomplete", () => {
    const [year] = yearProgress([{ ...sub(2026, "QUARTERLY", "Q4", "approved"), id: "q4" }]);

    expect(year?.anchorId).toBeUndefined();
  });

  it("treats a returned period as a draft and a rejected one as missing", () => {
    const [year] = yearProgress([
      sub(2025, "SEMI_ANNUAL", "H1", "returned"),
      sub(2025, "SEMI_ANNUAL", "H2", "rejected"),
    ]);

    expect(year?.periods).toEqual([
      { period: "H1", state: "draft" },
      { period: "H2", state: "missing" },
    ]);
  });

  it("counts a full-year monthly return as all twelve months", () => {
    const [year] = yearProgress([sub(2025, "MONTHLY", "FULL_YEAR", "approved")]);

    expect(year).toMatchObject({ complete: true, approved: 12, expected: 12 });
  });

  it("keeps cooperatives and years apart, newest year first", () => {
    const progress = yearProgress([
      sub(2024, "YEARLY", "2024", "approved"),
      sub(2025, "QUARTERLY", "Q1", "draft"),
      sub(2025, "YEARLY", "2025", "approved", "c2"),
    ]);

    expect(progress.map((p) => [p.cooperativeId, p.year, p.complete])).toEqual([
      ["c1", 2025, false],
      ["c2", 2025, true],
      ["c1", 2024, true],
    ]);
  });
});

describe("createBlock", () => {
  const lock = yearLock(
    [
      { reporting_year: 2024, period_type: "QUARTERLY", period_value: "Q1", fiscal_start_month: 1 },
      { reporting_year: 2024, period_type: "QUARTERLY", period_value: "Q4", fiscal_start_month: 1 },
    ],
    2024,
  );

  it("allows a free quarter with the year's start month", () => {
    expect(createBlock(lock, "QUARTERLY", "Q2", 1)).toBeNull();
  });

  it("explains a different frequency, start month or a quarter already created", () => {
    expect(createBlock(lock, "YEARLY", "2024", 1)).toEqual({
      reason: "frequency",
      periodType: "QUARTERLY",
    });
    expect(createBlock(lock, "QUARTERLY", "Q2", 4)).toEqual({ reason: "startMonth", month: 1 });
    expect(createBlock(lock, "QUARTERLY", "Q4", 1)).toEqual({ reason: "taken", period: "Q4" });
  });

  it("does not let a full-year monthly return sit next to single months", () => {
    const monthly = yearLock(
      [{ reporting_year: 2025, period_type: "MONTHLY", period_value: "03" }],
      2025,
    );

    expect(createBlock(monthly, "MONTHLY", "FULL_YEAR", 1)).toEqual({ reason: "fullYearOverlap" });
    expect(createBlock(monthly, "MONTHLY", "04", 1)).toBeNull();
  });

  it("says when every quarter of the year already exists", () => {
    const full = yearLock(
      ["Q1", "Q2", "Q3", "Q4"].map((q) => ({
        reporting_year: 2024,
        period_type: "QUARTERLY",
        period_value: q,
      })),
      2024,
    );

    expect(createBlock(full, "QUARTERLY", "Q1", 1)).toEqual({
      reason: "allTaken",
      periodType: "QUARTERLY",
    });
  });

  it("allows anything in a year with no submission", () => {
    expect(createBlock(null, "QUARTERLY", "Q1", 10)).toBeNull();
  });
});

describe("choiceForYear", () => {
  it("starts from the year's frequency, start month and first free quarter", () => {
    const lock = yearLock(
      [
        {
          reporting_year: 2024,
          period_type: "QUARTERLY",
          period_value: "Q1",
          fiscal_start_month: 7,
        },
        {
          reporting_year: 2024,
          period_type: "QUARTERLY",
          period_value: "Q4",
          fiscal_start_month: 7,
        },
      ],
      2024,
    );

    expect(choiceForYear(lock, 2024)).toEqual({
      periodType: "QUARTERLY",
      periodValue: "Q2",
      fiscalStartMonth: 7,
    });
  });

  it("leaves a year with no submission free", () => {
    expect(choiceForYear(null, 2026)).toBeNull();
  });
});
