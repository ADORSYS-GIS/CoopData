// frontend/src/hooks/shared/useLegalDocuments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { LegalPolicy, LegalPolicyCreateInput, LegalPolicyUpdateInput } from "@/types/legalPolicy";

const FALLBACK_POLICIES: Record<string, { title_en: string; title_fr: string; file: string }> = {
  privacy: {
    title_en: "Privacy Policy",
    title_fr: "Politique de confidentialité",
    file: "privacy_policy.md",
  },
  terms: {
    title_en: "Terms of Service",
    title_fr: "Conditions d'utilisation",
    file: "terms_of_service.md",
  },
  cookie: {
    title_en: "Cookie & Storage Policy",
    title_fr: "Politique relative aux cookies",
    file: "cookie_policy.md",
  },
  disclaimer: {
    title_en: "Legal Disclaimer",
    title_fr: "Avis juridique",
    file: "disclaimer.md",
  },
  code_of_conduct: {
    title_en: "Code of Conduct",
    title_fr: "Code de conduite",
    file: "acceptable_use.md",
  },
  data_processing: {
    title_en: "Data Retention & Processing Policy",
    title_fr: "Politique de conservation des données",
    file: "data_retention.md",
  },
};

export function useLegalDocuments() {
  const queryClient = useQueryClient();

  const { data: policies = [], isLoading, error, refetch } = useQuery<LegalPolicy[]>({
    queryKey: ["legal-policies"],
    queryFn: async () => {
      try {
        const { data, error: apiErr } = await (apiClient as any).GET("/api/v1/legal/policies", {});
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
          content_en: "",
          content_fr: "",
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
      const { data, error } = await apiClient.POST("/api/v1/legal/policies" as any, {
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
      const { data, error } = await apiClient.PUT("/api/v1/legal/policies/{policy_id}" as any, {
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
