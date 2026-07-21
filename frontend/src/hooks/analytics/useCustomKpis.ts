import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

export function useCustomKpis() {
  const queryClient = useQueryClient();

  const kpisQuery = useQuery({
    queryKey: ["custom-kpis"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/custom-kpis");
      if (error) throw new Error("Failed to fetch Custom KPIs");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; formula: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/analytics/custom-kpis", {
        body: payload,
      });
      if (error) throw new Error((error as any)?.message || "Failed to create Custom KPI");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-kpis"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/analytics/custom-kpis/{id}", {
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
      const { data, error } = await apiClient.POST("/api/v1/analytics/custom-kpis/evaluate", {
        body: { formula },
      });
      if (error) throw new Error("Failed to evaluate formula");
      return data;
    },
  });

  return {
    kpis: kpisQuery.data ?? [],
    isLoading: kpisQuery.isLoading,
    createKpi: createMutation.mutateAsync,
    deleteKpi: deleteMutation.mutateAsync,
    evaluateFormula: evaluateMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
