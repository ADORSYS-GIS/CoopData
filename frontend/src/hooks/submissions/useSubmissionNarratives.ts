import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

const NARRATIVES_KEY = "submission-narratives";

export interface CooperativeNarratives {
  executive_summary: string;
  financial_position: string;
  portfolio_quality: string;
  non_financial: string;
  benchmark_comparison: string;
}

export const useSubmissionNarratives = (submissionId: string | undefined, tokenOverride?: string) =>
  useQuery({
    queryKey: [NARRATIVES_KEY, submissionId, tokenOverride],
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(
        `${baseUrl}/api/v1/cooperative/submissions/${submissionId}/narratives`,
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
      const token = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(
        `${baseUrl}/api/v1/cooperative/submissions/${submissionId}/narratives/generate`,
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
    onSuccess: (_, submissionId) => {
      queryClient.invalidateQueries({ queryKey: [NARRATIVES_KEY, submissionId] });
    },
  });
};
