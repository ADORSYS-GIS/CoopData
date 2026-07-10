import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type ExtractionJobResponse = components["schemas"]["ExtractionJobResponse"];

const TERMINAL = ["succeeded", "failed", "partial"];

export const useExtractionJob = (jobId: string | null) =>
  useQuery({
    queryKey: ["extraction-job", jobId],
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
  });
