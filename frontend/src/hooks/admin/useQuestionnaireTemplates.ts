import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/services/shared/authService";

const TEMPLATE_LIST_KEY = "questionnaire-templates";
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface QuestionnaireTemplate {
  id: string;
  questionnaire_type: "financial" | "non_financial";
  version: number;
  label: string;
  sections: any[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const useQuestionnaireTemplates = () =>
  useQuery({
    queryKey: [TEMPLATE_LIST_KEY],
    queryFn: async () => {
      const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to load templates");
      }
      return res.json() as Promise<QuestionnaireTemplate[]>;
    },
  });

export const useQuestionnaireTemplate = (id: string) =>
  useQuery({
    queryKey: [TEMPLATE_LIST_KEY, id],
    queryFn: async () => {
      const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to load template");
      }
      return res.json() as Promise<QuestionnaireTemplate>;
    },
    enabled: !!id,
  });

export const useCreateQuestionnaireTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      questionnaire_type: "financial" | "non_financial";
      label: string;
      sections: any[];
    }) => {
      const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create template");
      }
      return res.json() as Promise<QuestionnaireTemplate>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATE_LIST_KEY] });
    },
  });
};

export const useUpdateQuestionnaireTemplate = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { label?: string; sections?: any[] }) => {
      const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to update template");
      }
      return res.json() as Promise<QuestionnaireTemplate>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATE_LIST_KEY] });
      qc.invalidateQueries({ queryKey: [TEMPLATE_LIST_KEY, id] });
      qc.invalidateQueries({ queryKey: ["active-questionnaire-template"] });
    },
  });
};

export const useActivateQuestionnaireTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(
        `${BASE}/api/v1/ministry/questionnaire-templates/${id}/activate`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to activate template");
      }
      return res.json() as Promise<QuestionnaireTemplate>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATE_LIST_KEY] });
      qc.invalidateQueries({ queryKey: ["questionnaire-response"] }); // Invalidate coop form active check
      qc.invalidateQueries({ queryKey: ["active-questionnaire-template"] });
    },
  });
};

export const useDeleteQuestionnaireTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to delete template");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATE_LIST_KEY] });
    },
  });
};
