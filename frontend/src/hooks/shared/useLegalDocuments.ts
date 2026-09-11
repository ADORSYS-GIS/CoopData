// frontend/src/hooks/shared/useLegalDocuments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type {
  LegalPolicy,
  LegalPolicyCreateInput,
  LegalPolicyUpdateInput,
} from "@/types/legalPolicy";

const FALLBACK_POLICIES: Record<
  string,
  { title_en: string; title_fr: string; title_pt: string; title_ss: string; file: string }
> = {
  privacy: {
    title_en: "Privacy Policy",
    title_fr: "Politique de confidentialité",
    title_pt: "Política de Privacidade",
    title_ss: "Inqubomgomo Yebumfihlo",
    file: "privacy.md",
  },
  terms: {
    title_en: "Terms of Service",
    title_fr: "Conditions d'utilisation",
    title_pt: "Termos de Serviço",
    title_ss: "Imigomo Yekusebentisa",
    file: "terms.md",
  },
  cookies: {
    title_en: "Cookie & Storage Policy",
    title_fr: "Politique relative aux cookies",
    title_pt: "Política de Cookies",
    title_ss: "Inqubomgomo Yemakhukhi",
    file: "cookies.md",
  },
  "acceptable-use": {
    title_en: "Acceptable Use & Code of Conduct",
    title_fr: "Utilisation acceptable et code de conduite",
    title_pt: "Uso Aceitável e Código de Conduta",
    title_ss: "Kusetjentiswa Lokwemukelekako Nekhodi Yekutiphatsa",
    file: "acceptable_use.md",
  },
  security: {
    title_en: "Security & Protection Policy",
    title_fr: "Politique de sécurité et de protection",
    title_pt: "Política de Segurança e Proteção",
    title_ss: "Inqubomgomo Yekuvikeleka",
    file: "security.md",
  },
  "data-retention": {
    title_en: "Data Retention & Processing Policy",
    title_fr: "Politique de conservation des données",
    title_pt: "Política de Retenção de Dados",
    title_ss: "Inqubomgomo Yekugcina Datha",
    file: "data_retention.md",
  },
};

export function useLegalDocuments() {
  const queryClient = useQueryClient();

  const {
    data: policies = [],
    isLoading,
    error,
    refetch,
  } = useQuery<LegalPolicy[]>({
    queryKey: ["legal-policies"],
    queryFn: async () => {
      try {
        const { data, error: apiErr } = await apiClient.GET("/api/v1/legal/policies", {});
        if (!apiErr && Array.isArray(data) && data.length > 0) {
          return data as LegalPolicy[];
        }
      } catch {
        // Ignore API error and fallback
      }

      // Fallback: build synthetic items from local files
      const fallbacks: LegalPolicy[] = [];
      const now = new Date().toISOString();
      for (const [slug, info] of Object.entries(FALLBACK_POLICIES)) {
        fallbacks.push({
          id: `fallback-${slug}`,
          policy_id: `fallback-policy-${slug}`,
          slug,
          title_en: info.title_en,
          title_fr: info.title_fr,
          title_pt: info.title_pt,
          title_ss: info.title_ss,
          content_en: "",
          content_fr: "",
          content_pt: "",
          content_ss: "",
          version: 1,
          created_at: now,
          updated_at: now,
        });
      }
      return fallbacks;
    },
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (input: LegalPolicyCreateInput) => {
      const { data, error } = await apiClient.POST("/api/v1/legal/policies", {
        body: input,
      });
      if (error) throw new Error(typeof error === "string" ? error : "Failed to create policy");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-policies"] });
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ policy_id, ...input }: LegalPolicyUpdateInput & { policy_id: string }) => {
      const { data, error } = await apiClient.PUT("/api/v1/legal/policies/{policy_id}", {
        params: { path: { policy_id } },
        body: input,
      });
      if (error) throw new Error(typeof error === "string" ? error : "Failed to update policy");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-policies"] });
    },
  });

  return {
    policies,
    isLoading,
    error,
    refetch,
    createPolicy: createPolicyMutation.mutateAsync,
    isCreating: createPolicyMutation.isPending,
    updatePolicy: updatePolicyMutation.mutateAsync,
    isUpdating: updatePolicyMutation.isPending,
  };
}
