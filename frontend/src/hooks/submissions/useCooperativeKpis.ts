import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

// Types matching the backend SubmissionKpisResponse
export interface KpiItemResponse {
  name: string;
  value: number;
  formatted: string;
  unit: "percent" | "currency" | "ratio";
  status?: "green" | "amber" | "red";
  benchmark?: number;
  description: string;
}

export interface SubmissionKpisResponse {
  submission_id: string;
  reporting_year: number;
  computed_at: string;
  submission_status: string;
  kpis: KpiItemResponse[];
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Fetches computed KPIs for a specific submission.
 * KPIs are computed on-demand from the submission's balance sheet line items.
 * The submission_id should be the latest submission (highest reporting_year)
 * from useCooperativeSubmissions — regardless of status.
 */
export const useCooperativeKpis = (submissionId: string | undefined) =>
  useQuery<SubmissionKpisResponse>({
    queryKey: ["coop-kpis", submissionId],
    queryFn: async () => {
      const token = await getAccessToken();
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
      // Don't retry 404s — no financial statement yet
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
