import type { AnalyticsTrack } from "@/hooks/cooperatives/useAnalyticsTrackNav";
import { yearProgress, type YearProgress } from "@/lib/period-rules";

interface DashboardSubmission {
  id: string;
  status: string;
  reporting_year: number;
  period_type?: string | null;
  period_value?: string | null;
  submission_method?: string | null;
}

export interface DashboardYear<T> {
  /** The last period's submission of the newest complete year. */
  submission?: T;
  /** The newest complete year. */
  year?: YearProgress;
  /** A newer year that is not complete yet, so not shown. */
  pending?: YearProgress;
}

/**
 * The year a cooperative's dashboard is built from: its newest complete year
 * (every period approved by the apex), of the kind its type uses, so the
 * cooperative sees only validated figures for a whole year. A SACCO's
 * dashboard ignores questionnaires (left over from before the type rules) and
 * a multipurpose cooperative's ignores financial statements. Without a known
 * type, any kind counts. Returns `undefined` while the type is loading.
 */
export function dashboardYear<T extends DashboardSubmission>(
  submissions: readonly T[],
  track: AnalyticsTrack | undefined,
): DashboardYear<T> | undefined {
  if (track === undefined) return undefined;
  const matchesTrack = (s: T) =>
    track === "both" ||
    (track === "basic"
      ? s.submission_method === "questionnaire"
      : s.submission_method !== "questionnaire");
  const ofKind = submissions.filter(matchesTrack);
  const years = yearProgress(ofKind);
  const year = years.find((y) => y.complete);
  const pending = years.find((y) => !y.complete && (!year || y.year > year.year));
  const submission = year?.anchorId ? ofKind.find((s) => s.id === year.anchorId) : undefined;
  return { submission, year, pending };
}
