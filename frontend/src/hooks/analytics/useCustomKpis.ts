import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import i18n from "@/i18n";

export function useCustomKpis() {
  const queryClient = useQueryClient();

  const kpisQuery = useQuery({
    queryKey: ["custom-kpis", i18n.language?.split("-")[0] || "en"],
    queryFn: async () => {
      const lang = i18n.language?.split("-")[0] || "en";
      const { data, error } = await apiClient.GET("/api/v1/ministry/custom-kpis", {
        params: { query: { lang } },
      });
      if (error) throw new Error("Failed to fetch Custom KPIs");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      formula: string;
      translations?: Record<string, unknown>;
    }) => {
      const { data, error } = await apiClient.POST("/api/v1/ministry/custom-kpis", {
        body: payload,
      });
      if (error)
        throw new Error((error as { message?: string })?.message || "Failed to create Custom KPI");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-kpis"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/ministry/custom-kpis/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete Custom KPI");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-kpis"] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async (formula: string) => {
      const { data, error } = await apiClient.POST("/api/v1/ministry/custom-kpis/evaluate", {
        body: { formula },
      });
      if (error) throw new Error("Failed to evaluate formula");
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name: string;
        description?: string;
        formula: string;
        translations?: Record<string, unknown>;
      };
    }) => {
      const { data, error } = await apiClient.PUT("/api/v1/ministry/custom-kpis/{id}", {
        params: { path: { id } },
        body: payload,
      });
      if (error)
        throw new Error((error as { message?: string })?.message || "Failed to update Custom KPI");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-kpis"] });
    },
  });

  return {
    kpis: kpisQuery.data ?? [],
    isLoading: kpisQuery.isLoading,
    createKpi: createMutation.mutateAsync,
    updateKpi: updateMutation.mutateAsync,
    deleteKpi: deleteMutation.mutateAsync,
    evaluateFormula: evaluateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
