import {
  useCooperativeSubmissions,
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
} from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import { useUserRole } from "@/lib/auth";
import { useMemo } from "react";

/**
 * Returns the cooperative's approved/submitted submission for the given reporting year.
 * If `reportingYear` is provided, only submissions matching that year are
 * considered. If none is approved for that year, returns undefined (so all
 * analytics show empty rather than stale data from a different year).
 *
 * This ensures that the executive analytics dashboard never displays
 * tentative or unapproved data that could later be rejected.
 */
export const useLatestSubmission = (
  reportingYear?: number,
  cooperativeId?: string,
): SubmissionResponse | undefined => {
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

    const allSubs = isApex
      ? apexSubmissions
      : isFed
        ? fedSubmissions
        : minSubmissions;

    if (cooperativeId && cooperativeId !== "all") {
      return allSubs.filter((sub) => sub.cooperative_id === cooperativeId);
    }
    return allSubs;
  }, [isCoop, isApex, isFed, minSubmissions, coopSubmissions, apexSubmissions, fedSubmissions, cooperativeId]);

  const approvedSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (sub.status !== "approved" && sub.status !== "submitted") return false;
      if (reportingYear !== undefined && sub.reporting_year !== reportingYear) return false;
      return true;
    });
  }, [submissions, reportingYear]);

  if (approvedSubmissions.length === 0) return undefined;

  return [...approvedSubmissions].sort((a, b) => b.reporting_year - a.reporting_year)[0];
};
