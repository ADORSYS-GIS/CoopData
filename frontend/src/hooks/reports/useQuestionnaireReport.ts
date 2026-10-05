import { useQuery } from "@tanstack/react-query";

import type { BasicDashboardResponse } from "@/types/basic-dashboard";
import type { QuestionnaireNarratives } from "@/types/questionnaire-report";
import { getAccessToken } from "@/services/shared/authService";

const fetchJson = async <T>(path: string, tokenOverride?: string): Promise<T> => {
  const token = tokenOverride || (await getAccessToken());
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
};

/** KPI data behind the questionnaire PDF report of one submission. */
export const useQuestionnaireReport = (submissionId: string | undefined, tokenOverride?: string) =>
  useQuery({
    queryKey: ["questionnaire-report", "v1", submissionId, tokenOverride],
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchJson<BasicDashboardResponse>(
        `/api/v1/cooperative/submissions/${submissionId}/questionnaire-report`,
        tokenOverride,
      ),
  });

/** AI narratives stored on the submission by the report pipeline (null until generated). */
export const useQuestionnaireNarratives = (
  submissionId: string | undefined,
  tokenOverride?: string,
) =>
  useQuery({
    queryKey: ["questionnaire-narratives", "v1", submissionId, tokenOverride],
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchJson<QuestionnaireNarratives | null>(
        `/api/v1/cooperative/submissions/${submissionId}/narratives`,
        tokenOverride,
      ),
  });
