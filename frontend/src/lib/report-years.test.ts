import { describe, expect, it } from "vitest";

import { reportChoices } from "./report-years";

const EXPORTABLE = ["submitted", "approved"];

const sub = (id: string, year: number, type: string, value: string, status = "approved") => ({
  id,
  cooperative_id: "c1",
  reporting_year: year,
  period_type: type,
  period_value: value,
  status,
});

describe("reportChoices", () => {
  it("offers each submitted or approved yearly return", () => {
    const choices = reportChoices(
      [
        sub("y24", 2024, "YEARLY", "2024"),
        sub("y25", 2025, "YEARLY", "2025", "submitted"),
        sub("y26", 2026, "YEARLY", "2026", "draft"),
      ],
      EXPORTABLE,
    );

    expect(choices.map((c) => c.id)).toEqual(["y25", "y24"]);
  });

  it("offers one report for a complete quarterly year, under its last quarter", () => {
    const choices = reportChoices(
      ["Q2", "Q4", "Q1", "Q3"].map((q) => sub(q, 2026, "QUARTERLY", q)),
      EXPORTABLE,
    );

    expect(choices).toHaveLength(1);
    expect(choices[0]?.id).toBe("Q4");
    expect(choices[0]?.pending).toBeUndefined();
  });

  it("lists an incomplete quarterly year with its progress", () => {
    const choices = reportChoices(
      [sub("Q1", 2026, "QUARTERLY", "Q1"), sub("Q2", 2026, "QUARTERLY", "Q2", "submitted")],
      EXPORTABLE,
    );

    expect(choices).toHaveLength(1);
    expect(choices[0]?.pending).toMatchObject({ year: 2026, approved: 1, expected: 4 });
  });

  it("leaves out a year with nothing submitted yet", () => {
    expect(reportChoices([sub("Q1", 2026, "QUARTERLY", "Q1", "draft")], EXPORTABLE)).toEqual([]);
  });
});
