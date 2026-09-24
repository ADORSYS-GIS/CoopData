import { describe, expect, it } from "vitest";

import { buildSubmissionTrend } from "@/lib/submission-trend";

const NOW = new Date(2026, 8, 24, 12, 0, 0);

describe("buildSubmissionTrend", () => {
  it("returns 30 daily buckets and counts today's submission", () => {
    const points = buildSubmissionTrend([{ created_at: "2026-09-24T09:00:00" }], "day", NOW);
    expect(points).toHaveLength(30);
    expect(points[points.length - 1].count).toBe(1);
  });

  it("groups submissions of the same ISO week into one weekly bucket", () => {
    const points = buildSubmissionTrend(
      [{ created_at: "2026-09-21T10:00:00" }, { created_at: "2026-09-24T10:00:00" }],
      "week",
      NOW,
    );
    expect(points).toHaveLength(12);
    expect(points[points.length - 1].count).toBe(2);
  });

  it("returns 12 monthly buckets and ignores older submissions", () => {
    const points = buildSubmissionTrend(
      [{ created_at: "2026-08-05T10:00:00" }, { created_at: "2024-01-05T10:00:00" }],
      "month",
      NOW,
    );
    expect(points).toHaveLength(12);
    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(1);
  });

  it("returns 5 yearly buckets", () => {
    const points = buildSubmissionTrend(
      [{ created_at: "2026-02-01T10:00:00" }, { created_at: "2023-02-01T10:00:00" }],
      "year",
      NOW,
    );
    expect(points.map((p) => p.label)).toEqual(["2022", "2023", "2024", "2025", "2026"]);
    expect(points[1].count).toBe(1);
    expect(points[4].count).toBe(1);
  });

  it("prefers submitted_at over created_at and skips undated rows", () => {
    const points = buildSubmissionTrend(
      [{ submitted_at: "2026-09-24T08:00:00", created_at: "2020-01-01T00:00:00" }, {}],
      "day",
      NOW,
    );
    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(1);
  });
});
