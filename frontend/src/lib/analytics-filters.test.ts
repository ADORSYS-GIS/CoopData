import { describe, expect, it } from "vitest";

import {
  periodLabel,
  resolveSelection,
  resolveYear,
  toPeriodOptions,
} from "@/lib/analytics-filters";

describe("toPeriodOptions", () => {
  it("keeps only approved submissions, newest first, without duplicates", () => {
    const options = toPeriodOptions([
      { reporting_year: 2024, period_type: "QUARTERLY", period_value: "Q1", status: "approved" },
      { reporting_year: 2025, period_type: "QUARTERLY", period_value: "Q2", status: "approved" },
      { reporting_year: 2025, period_type: "QUARTERLY", period_value: "Q2", status: "approved" },
      { reporting_year: 2026, period_type: "YEARLY", period_value: "2026", status: "draft" },
    ]);

    expect(options.map((o) => o.label)).toEqual(["Q2 2025", "Q1 2024"]);
  });
});

describe("toPeriodOptions with excluded methods", () => {
  it("skips questionnaire returns so latest available lands on a statement period", () => {
    const options = toPeriodOptions(
      [
        {
          reporting_year: 2026,
          period_type: "QUARTERLY",
          period_value: "Q1",
          status: "approved",
          submission_method: "questionnaire",
        },
        {
          reporting_year: 2025,
          period_type: "YEARLY",
          period_value: "2025",
          status: "approved",
          submission_method: "upload",
        },
      ],
      ["questionnaire"],
    );

    expect(options.map((o) => o.label)).toEqual(["2025"]);
    expect(resolveYear("all", options)).toBe(2025);
  });
});

describe("periodLabel", () => {
  it("names months and yearly periods", () => {
    expect(periodLabel("MONTHLY", "03", 2026)).toBe("Mar 2026");
    expect(periodLabel("YEARLY", "2026", 2026)).toBe("2026");
  });
});

describe("resolveYear", () => {
  const periods = toPeriodOptions([
    { reporting_year: 2025, period_type: "YEARLY", period_value: "2025", status: "approved" },
  ]);

  it("uses the newest approved year for latest available", () => {
    expect(resolveYear("all", periods)).toBe(2025);
  });

  it("falls back to the given year when nothing is approved", () => {
    expect(resolveYear("all", [], 2030)).toBe(2030);
  });

  it("keeps an explicit year", () => {
    expect(resolveYear("2023", periods)).toBe(2023);
  });
});

describe("resolveSelection", () => {
  const periods = toPeriodOptions([
    { reporting_year: 2025, period_type: "QUARTERLY", period_value: "Q1", status: "approved" },
    { reporting_year: 2025, period_type: "QUARTERLY", period_value: "Q2", status: "approved" },
    { reporting_year: 2024, period_type: "YEARLY", period_value: "2024", status: "approved" },
  ]);
  const all = { year: "all", periodType: "all", periodValue: "all" };

  it("picks the newest approved period when everything is latest available", () => {
    expect(resolveSelection(all, periods)).toEqual({
      year: 2025,
      periodType: "QUARTERLY",
      periodValue: "Q2",
    });
  });

  it("respects a chosen year and frequency", () => {
    expect(resolveSelection({ ...all, year: "2024", periodType: "YEARLY" }, periods)).toEqual({
      year: 2024,
      periodType: "YEARLY",
      periodValue: "2024",
    });
  });

  it("respects a chosen period", () => {
    expect(resolveSelection({ ...all, periodValue: "Q1" }, periods).periodValue).toBe("Q1");
  });

  it("keeps the raw choice when no approved period matches", () => {
    expect(resolveSelection({ ...all, year: "2019" }, periods, 2026)).toEqual({
      year: 2019,
      periodType: "all",
      periodValue: "all",
    });
  });
});
