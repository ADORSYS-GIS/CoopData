import { describe, it, expect } from "vitest";
import { dashboardYear } from "./dashboard-submission";

const sub = (
  reporting_year: number,
  submission_method: string,
  status = "approved",
  period_type = "YEARLY",
  period_value = String(reporting_year),
) => ({
  id: `${reporting_year}-${submission_method}-${period_value}`,
  reporting_year,
  submission_method,
  status,
  period_type,
  period_value,
});

describe("dashboardYear", () => {
  const legacySacco = [sub(2024, "manual"), sub(2025, "questionnaire"), sub(2023, "upload")];

  it("builds a SACCO's dashboard from its latest financial statement, not a leftover questionnaire", () => {
    expect(dashboardYear(legacySacco, "standard")?.submission).toEqual(sub(2024, "manual"));
  });

  it("builds a multipurpose dashboard from its latest questionnaire", () => {
    const subs = [sub(2025, "manual"), sub(2024, "questionnaire")];

    expect(dashboardYear(subs, "basic")?.submission).toEqual(sub(2024, "questionnaire"));
  });

  it("uses the latest of any kind when the type is unknown", () => {
    expect(dashboardYear(legacySacco, "both")?.submission).toEqual(sub(2025, "questionnaire"));
  });

  it("uses only years approved by the apex", () => {
    const subs = [
      sub(2027, "manual", "submitted"),
      sub(2026, "manual", "draft"),
      sub(2025, "manual", "returned"),
      sub(2024, "upload"),
    ];

    expect(dashboardYear(subs, "standard")?.submission).toEqual(sub(2024, "upload"));
  });

  it("waits for every quarter of a year and reports the newer incomplete year", () => {
    const quarters = ["Q1", "Q2", "Q3"].map((q) => sub(2026, "manual", "approved", "QUARTERLY", q));
    const subs = [sub(2025, "manual"), ...quarters];

    const result = dashboardYear(subs, "standard");

    expect(result?.submission).toEqual(sub(2025, "manual"));
    expect(result?.pending).toMatchObject({ year: 2026, approved: 3, expected: 4 });
  });

  it("uses the last quarter's submission once the year is complete", () => {
    const quarters = ["Q3", "Q1", "Q4", "Q2"].map((q) =>
      sub(2026, "manual", "approved", "QUARTERLY", q),
    );

    const result = dashboardYear(quarters, "standard");

    expect(result?.submission?.period_value).toBe("Q4");
    expect(result?.pending).toBeUndefined();
  });

  it("returns nothing while the type is still loading or when nothing matches", () => {
    expect(dashboardYear(legacySacco, undefined)).toBeUndefined();
    expect(dashboardYear([sub(2025, "manual")], "basic")?.submission).toBeUndefined();
  });
});
