import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

export interface BenchmarkResponse {
  reporting_year: number | null;
  /** The calling cooperative's own row; null when it has no approved/submitted
   *  data for the year (a legitimate empty state, not an error). */
  cooperative: CoopKpiRow | null;
  national_average: Record<string, number> | null;
  regional_average: Record<string, number> | null;
  sector_average: Record<string, number> | null;
  sector_regional_average: Record<string, number> | null;
  insufficient_data: {
    national: boolean;
    regional: boolean;
    sector: boolean;
    sector_regional: boolean;
  };
}

export interface BenchmarkParams {
  reportingYear?: number;
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load benchmark data.";
};

/**
 * Fetches the privacy-safe benchmark comparison for the calling cooperative.
 * The backend returns only the caller's own KPI row plus server-computed
 * national/regional averages — never other cooperatives' raw data.
 */
export const useBenchmark = (params: BenchmarkParams = {}, enabled = true) =>
  useQuery<BenchmarkResponse>({
    queryKey: ["benchmark", params],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/benchmark", {
        params: {
          query: {
            reporting_year: params.reportingYear,
          } as Record<string, unknown>,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Benchmark response was empty.");
      return data as BenchmarkResponse;
    },
    staleTime: 60 * 1000,
  });
