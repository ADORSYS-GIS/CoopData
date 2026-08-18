import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type ExtractionJobResponse = components["schemas"]["ExtractionJobResponse"];

const TERMINAL = ["succeeded", "failed", "partial"];

export const useExtractionJob = (jobId: string | null) => {
  const queryClient = useQueryClient();
  return useOfflineQuery({
    queryKey: ["extraction-job", jobId],
    cacheTable: "submissions",
    cacheKey: `extraction-job-${jobId}`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/extraction-jobs/{id}", {
        params: { path: { id: jobId! } },
      });
      if (error) throw new Error(String(error));
      return data as ExtractionJobResponse;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL.includes(status)) return false;
      return 2000;
    },
    // When extraction completes, refresh submission and line items so FS editor appears
    select: (data) => {
      if (data?.status && TERMINAL.includes(data.status)) {
        void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
        void queryClient.invalidateQueries({ queryKey: ["line-items"] });
        void queryClient.invalidateQueries({ queryKey: ["financial-statement"] });
      }
      return data;
    },
  });
};
