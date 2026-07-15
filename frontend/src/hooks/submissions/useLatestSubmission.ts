import { useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

/**
 * Returns the cooperative's submission with the highest reporting_year.
 *
 * Design decision: we always pick by year, not by status.
 * If the 2025 submission was returned by apex (back to draft),
 * we still show its KPIs — not fall back to the 2024 approved one.
 * KPIs reflect whatever data is currently on the submission's financial
 * statement, giving the cooperative accurate feedback during correction.
 */
export const useLatestSubmission = (): SubmissionResponse | undefined => {
  const { data: submissions = [] } = useCooperativeSubmissions();
  if (submissions.length === 0) return undefined;
  return [...submissions].sort((a, b) => b.reporting_year - a.reporting_year)[0];
};
