import type { AnalyticsTrack } from "@/hooks/cooperatives/useAnalyticsTrackNav";

interface DashboardSubmission {
  status: string;
  reporting_year: number;
  submission_method?: string | null;
}

/**
 * The submission a cooperative's dashboard is built from: its latest return
 * approved by the apex, of the kind its type uses, so the cooperative sees only
 * validated figures. A SACCO's dashboard ignores
 * questionnaires (left over from before the type rules) and a multipurpose
 * cooperative's ignores financial statements. Without a known type, any kind counts.
 */
export function dashboardSubmission<T extends DashboardSubmission>(
  submissions: readonly T[],
  track: AnalyticsTrack | undefined,
): T | undefined {
  if (track === undefined) return undefined;
  const matchesTrack = (s: T) =>
    track === "both" ||
    (track === "basic"
      ? s.submission_method === "questionnaire"
      : s.submission_method !== "questionnaire");
  return submissions
    .filter((s) => s.status === "approved" && matchesTrack(s))
    .sort((a, b) => b.reporting_year - a.reporting_year)[0];
}
