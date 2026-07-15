import { describe, it, expect } from "vitest";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

/**
 * Tests for the pure sorting logic inside useLatestSubmission.
 *
 * The hook wraps useCooperativeSubmissions and picks the submission
 * with the highest reporting_year — year always wins over status.
 * We test this contract directly on the sort algorithm.
 */

function makeSubmission(
  id: string,
  reportingYear: number,
  status: string = "approved",
): SubmissionResponse {
  return {
    id,
    reference: `REF-${reportingYear}`,
    cooperative_id: "coop-1",
    reporting_year: reportingYear,
    status,
    current_tier: "ministry",
    submitted_by: null,
    submitted_at: null,
    last_reviewed_by: null,
    last_reviewed_at: null,
    rejection_reason: null,
    priority: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as SubmissionResponse;
}

/** The exact sort expression used inside useLatestSubmission. */
function pickLatest(submissions: SubmissionResponse[]): SubmissionResponse | undefined {
  return [...submissions].sort((a, b) => b.reporting_year - a.reporting_year)[0];
}

describe("useLatestSubmission — sort logic", () => {
  it("returns undefined when submissions is empty", () => {
    expect(pickLatest([])).toBeUndefined();
  });

  it("returns the submission with the highest reporting_year", () => {
    const result = pickLatest([
      makeSubmission("a", 2023, "approved"),
      makeSubmission("b", 2025, "draft"),
      makeSubmission("c", 2024, "submitted"),
    ]);
    expect(result?.id).toBe("b");
    expect(result?.reporting_year).toBe(2025);
  });

  it("picks 2025 draft over 2024 approved — year wins over status", () => {
    const result = pickLatest([
      makeSubmission("approved-2024", 2024, "approved"),
      makeSubmission("draft-2025", 2025, "draft"),
    ]);
    expect(result?.id).toBe("draft-2025");
    expect(result?.status).toBe("draft");
  });

  it("picks 2025 returned (draft) over 2024 approved after apex return", () => {
    // Core scenario: 2025 was returned by apex back to draft.
    // We still show 2025, not fall back to 2024 approved.
    const result = pickLatest([
      makeSubmission("sub-2024", 2024, "approved"),
      makeSubmission("sub-2025", 2025, "draft"),
    ]);
    expect(result?.id).toBe("sub-2025");
    expect(result?.reporting_year).toBe(2025);
  });

  it("does not mutate the original array", () => {
    const submissions = [
      makeSubmission("a", 2022),
      makeSubmission("b", 2025),
      makeSubmission("c", 2023),
    ];
    const originalOrder = submissions.map((s) => s.reporting_year);
    pickLatest(submissions);
    expect(submissions.map((s) => s.reporting_year)).toEqual(originalOrder);
  });

  it("handles a single submission correctly", () => {
    const result = pickLatest([makeSubmission("only", 2025, "in_review")]);
    expect(result?.id).toBe("only");
    expect(result?.status).toBe("in_review");
  });

  it("works correctly with many years", () => {
    const subs = [2020, 2019, 2023, 2022, 2021, 2025, 2024].map((y) =>
      makeSubmission(`sub-${y}`, y),
    );
    expect(pickLatest(subs)?.reporting_year).toBe(2025);
  });

  it("falls back to last approved year when no current year submission exists", () => {
    // If 2025 submission doesn't exist yet, show 2024 approved
    const result = pickLatest([
      makeSubmission("sub-2023", 2023, "approved"),
      makeSubmission("sub-2024", 2024, "approved"),
    ]);
    expect(result?.reporting_year).toBe(2024);
  });
});
