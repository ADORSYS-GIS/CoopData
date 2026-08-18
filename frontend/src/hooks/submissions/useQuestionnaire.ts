import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { fetchWithAuth, getUserProfile } from "@/services/shared/authService";
import { runMutation } from "@/services/shared/syncQueueService";
import { cacheSet } from "@/services/shared/offlineCache";
import i18n from "@/i18n";
import type { QuestionnaireSection } from "@/hooks/admin/useQuestionnaireTemplates";

const QUESTIONNAIRE_KEY = "questionnaire-response";
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type QuestionnaireAnswers = Record<string, unknown>;

export interface QuestionnaireResponseData {
  id: string;
  submission_id: string;
  cooperative_id: string;
  questionnaire_type: string;
  reporting_year: number;
  answers: QuestionnaireAnswers;
  created_at: string;
  updated_at: string;
}

export const useQuestionnaire = (submissionId: string, questionnaireType?: string) =>
  useOfflineQuery({
    queryKey: [QUESTIONNAIRE_KEY, submissionId, questionnaireType],
    cacheTable: "submissions",
    cacheKey: `questionnaire-${submissionId}-${questionnaireType}`,
    queryFn: async () => {
      const url = questionnaireType
        ? `${BASE}/api/v1/cooperative/submissions/${submissionId}/questionnaire?questionnaire_type=${questionnaireType}`
        : `${BASE}/api/v1/cooperative/submissions/${submissionId}/questionnaire`;
      const res = await fetchWithAuth(url);
      if (res.status === 404) return null;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to load questionnaire");
      }
      return (await res.json()) as QuestionnaireResponseData;
    },
    enabled: !!submissionId,
  });

export const useSaveQuestionnaire = (submissionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { questionnaire_type: string; answers: QuestionnaireAnswers }) => {
      const userId = getUserProfile()?.id ?? "anon";
      const cachedData: QuestionnaireResponseData = {
        id: crypto.randomUUID(),
        submission_id: submissionId,
        cooperative_id: "self",
        questionnaire_type: payload.questionnaire_type,
        reporting_year: new Date().getFullYear(),
        answers: payload.answers,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save answers into IndexedDB immediately so offline view/refresh works seamlessly
      try {
        await cacheSet(
          "submissions",
          `questionnaire-${submissionId}-${payload.questionnaire_type}`,
          userId,
          cachedData,
        );
      } catch (e) {
        console.warn("Failed to update cached questionnaire answers offline", e);
      }

      // 2. Enqueue REST mutation for sync when online
      return runMutation<QuestionnaireResponseData>(
        "/api/v1/cooperative/submissions/{id}/questionnaire",
        "POST",
        {
          pathParams: { id: submissionId },
          body: payload,
          optimisticData: cachedData,
          online: async () => {
            const res = await fetchWithAuth(
              `${BASE}/api/v1/cooperative/submissions/${submissionId}/questionnaire`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(
                (body as { message?: string }).message ?? "Failed to save questionnaire",
              );
            }
            return (await res.json()) as QuestionnaireResponseData;
          },
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUESTIONNAIRE_KEY, submissionId] });
      qc.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId, "sections"] });
      qc.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      qc.invalidateQueries({ queryKey: ["cooperative-submissions"] });
    },
  });
};

export const useActiveTemplate = (type: string) => {
  const lang = i18n.language?.split("-")[0] || "en";
  return useOfflineQuery({
    queryKey: ["active-questionnaire-template", type, lang],
    cacheTable: "submissions",
    cacheKey: `active-template-${type}-${lang}`,
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${BASE}/api/v1/cooperative/questionnaire-templates/active?questionnaire_type=${type}&lang=${encodeURIComponent(lang)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to load active template");
      }
      return (await res.json()) as {
        id: string;
        questionnaire_type: string;
        version: number;
        label: string;
        sections: QuestionnaireSection[];
      };
    },
    enabled: !!type,
  });
};

export interface QuestionnaireAnalyticsData {
  total_reporting_cooperatives: number;
  total_registered_members: number;
  total_active_members: number;
  total_members_male: number;
  total_members_female: number;
  total_share_capital: number;
  total_borrowed_funds: number;
  total_savings_value: number;
  total_loans_outstanding: number;
  total_income: number;
  total_expenditure: number;
  total_net_income: number;
  members_by_age:
    | {
        age_18_25: number;
        age_26_35: number;
        age_36_60: number;
        age_61plus: number;
      }
    | null
    | undefined;
  region_counts: Record<string, number> | null | undefined;
  sector_counts: Record<string, number> | null | undefined;
  details:
    | {
        id: string;
        cooperative_name: string;
        questionnaire_type: string;
        reporting_year: number;
        region: string;
        total_members: number;
        total_share_capital: number;
        net_income: number;
      }[]
    | null
    | undefined;
}

export const useQuestionnaireAnalytics = (filters: {
  reporting_year?: string;
  region?: string;
  sector?: string;
  cooperative_id?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (filters.reporting_year && filters.reporting_year !== "all") {
    queryParams.append("reporting_year", filters.reporting_year);
  }
  if (filters.region && filters.region !== "all") {
    queryParams.append("region", filters.region);
  }
  if (filters.sector && filters.sector !== "all") {
    queryParams.append("sector", filters.sector);
  }
  if (filters.cooperative_id && filters.cooperative_id !== "all") {
    queryParams.append("cooperative_id", filters.cooperative_id);
  }

  return useOfflineQuery({
    queryKey: ["questionnaire-analytics", filters],
    cacheTable: "submissions",
    cacheKey: `questionnaire-analytics-${JSON.stringify(filters)}`,
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${BASE}/api/v1/analytics/questionnaire?${queryParams.toString()}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? "Failed to load questionnaire analytics",
        );
      }
      return (await res.json()) as QuestionnaireAnalyticsData;
    },
  });
};
