import {
  useCooperativeSubmissions,
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
} from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import { useUserRole } from "@/lib/auth";
import { yearProgress, type YearProgress } from "@/lib/period-rules";
import { useMemo } from "react";

export interface AnalyticsYear {
  /** The last period's submission of the year, once the year is complete. */
  submission?: SubmissionResponse;
  /** The year's progress while it is not complete yet. */
  pending?: YearProgress;
}

/**
 * The cooperative's complete year for the analytics: every period of
 * `reportingYear` approved by the apex (a year reported by quarters, halves or
 * months is combined by the backend from the last period's submission). Without
 * a year, the newest complete one. While the year is incomplete nothing is
 * shown and `pending` says where its periods stand, so analytics never display
 * part of a year or figures that could still be rejected.
 */
export const useAnalyticsYear = (reportingYear?: number, cooperativeId?: string): AnalyticsYear => {
  const role = useUserRole();

  const isCoop = role === "cooperative";
  const isApex = role === "apex";
  const isFed = role === "federation";
  const isMin = role === "ministry";

  const { data: coopSubmissions = [] } = useCooperativeSubmissions(isCoop);
  const { data: apexSubmissions = [] } = useApexSubmissions(isApex);
  const { data: fedSubmissions = [] } = useFederationSubmissions({ all: true, enabled: isFed });
  const { data: minSubmissions = [] } = useMinistrySubmissions({ all: true, enabled: isMin });

  const submissions = useMemo(() => {
    if (isCoop) return coopSubmissions;

    const allSubs = isApex ? apexSubmissions : isFed ? fedSubmissions : minSubmissions;

    if (cooperativeId && cooperativeId !== "all") {
      return allSubs.filter((sub) => sub.cooperative_id === cooperativeId);
    }
    return allSubs;
  }, [
    isCoop,
    isApex,
    isFed,
    minSubmissions,
    coopSubmissions,
    apexSubmissions,
    fedSubmissions,
    cooperativeId,
  ]);

  return useMemo(() => {
    const years = yearProgress(submissions);
    const year =
      reportingYear !== undefined && !Number.isNaN(reportingYear)
        ? years.find((y) => y.year === reportingYear)
        : (years.find((y) => y.complete) ?? years[0]);
    if (!year) return {};
    if (!year.complete) return { pending: year };
    return { submission: submissions.find((s) => s.id === year.anchorId) };
  }, [submissions, reportingYear]);
};
