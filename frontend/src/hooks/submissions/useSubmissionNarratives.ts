import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { getAccessToken } from "@/services/shared/authService";
import { runMutation } from "@/services/shared/syncQueueService";

const NARRATIVES_KEY = "submission-narratives";

const BASE_URL =
  window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")
    ? "http://backend:3000"
    : import.meta.env.VITE_API_BASE_URL || "";

export interface CooperativeNarratives {
  executive_summary: string;
  financial_position: string;
  portfolio_quality: string;
  non_financial: string;
  benchmark_comparison: string;
}

export const useSubmissionNarratives = (
  submissionId: string | undefined,
  tokenOverride?: string,
  lng?: string,
) =>
  useOfflineQuery({
    queryKey: [NARRATIVES_KEY, submissionId, tokenOverride, lng],
    cacheTable: "submissions",
    cacheKey: `narratives-${submissionId}-${lng ?? "en"}`,
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const lngParam = lng ? `&lng=${encodeURIComponent(lng)}` : "";
      const res = await fetch(
        `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/narratives?_=${Date.now()}${lngParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(`Failed to fetch narratives (${res.status})`);
      const data = await res.json();
      return data as CooperativeNarratives | null;
    },
  });

export const useGenerateSubmissionNarratives = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      return runMutation<CooperativeNarratives>(
        "/api/v1/cooperative/submissions/{id}/narratives/generate",
        "POST",
        {
          pathParams: { id: submissionId },
          optimisticData: undefined,
          online: async () => {
            const token = await getAccessToken();
            const res = await fetch(
              `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/narratives/generate`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error((body as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
            }
            return (await res.json()) as CooperativeNarratives;
          },
        },
      );
    },
    onSuccess: (_, submissionId) => {
      queryClient.invalidateQueries({ queryKey: [NARRATIVES_KEY, submissionId] });
    },
  });
};
