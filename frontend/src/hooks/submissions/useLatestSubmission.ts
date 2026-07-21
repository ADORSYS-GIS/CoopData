import { useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

/**
 * Returns the cooperative's approved submission for the given reporting year.
 * If `reportingYear` is provided, only submissions matching that year are
 * considered. If none is approved for that year, returns undefined (so all
 * analytics show empty rather than stale data from a different year).
 *
 * This ensures that the executive analytics dashboard never displays
 * tentative or unapproved data that could later be rejected.
 */
export const useLatestSubmission = (reportingYear?: number): SubmissionResponse | undefined => {
  const { data: submissions = [] } = useCooperativeSubmissions();

  const approvedSubmissions = submissions.filter((sub) => {
    if (sub.status !== "approved") return false;
    if (reportingYear !== undefined && sub.reporting_year !== reportingYear) return false;
    return true;
  });

  if (approvedSubmissions.length === 0) return undefined;

  return [...approvedSubmissions].sort((a, b) => b.reporting_year - a.reporting_year)[0];
};
