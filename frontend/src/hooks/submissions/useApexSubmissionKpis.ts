import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { getAccessToken } from "@/services/shared/authService";
import type { SubmissionKpisResponse } from "./useCooperativeKpis";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Fetches computed financial KPIs for a specific submission via the apex API.
 * Used in the Apex deep-dive analytics panel to show the same KPI figures
 * that the cooperative itself sees on its own dashboard.
 *
 * The backend authorises this by verifying the submission belongs to one of
 * the apex's cooperatives (resolve_caller_cooperative_ids).
 */
export const useApexSubmissionKpis = (submissionId: string | undefined, tokenOverride?: string) =>
  useOfflineQuery<SubmissionKpisResponse>({
    queryKey: ["apex-submission-kpis", submissionId, tokenOverride],
    cacheTable: "submissions",
    cacheKey: `apex-submission-kpis-${submissionId}`,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const res = await fetch(`${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<SubmissionKpisResponse>;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
