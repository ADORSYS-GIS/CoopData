import { describe, it, expect } from "vitest";
import { dashboardSubmission } from "./dashboard-submission";

const sub = (reporting_year: number, submission_method: string, status = "approved") => ({
  reporting_year,
  submission_method,
  status,
});

describe("dashboardSubmission", () => {
  const legacySacco = [sub(2024, "manual"), sub(2025, "questionnaire"), sub(2023, "upload")];

  it("builds a SACCO's dashboard from its latest financial statement, not a leftover questionnaire", () => {
    expect(dashboardSubmission(legacySacco, "standard")).toEqual(sub(2024, "manual"));
  });

  it("builds a multipurpose dashboard from its latest questionnaire", () => {
    const subs = [sub(2025, "manual"), sub(2024, "questionnaire")];

    expect(dashboardSubmission(subs, "basic")).toEqual(sub(2024, "questionnaire"));
  });

  it("uses the latest of any kind when the type is unknown", () => {
    expect(dashboardSubmission(legacySacco, "both")).toEqual(sub(2025, "questionnaire"));
  });

  it("uses only submissions approved by the apex", () => {
    const subs = [
      sub(2027, "manual", "submitted"),
      sub(2026, "manual", "draft"),
      sub(2025, "manual", "returned"),
      sub(2024, "upload"),
    ];

    expect(dashboardSubmission(subs, "standard")).toEqual(sub(2024, "upload"));
  });

  it("returns nothing while the type is still loading or when nothing matches", () => {
    expect(dashboardSubmission(legacySacco, undefined)).toBeUndefined();
    expect(dashboardSubmission([sub(2025, "manual")], "basic")).toBeUndefined();
  });
});
