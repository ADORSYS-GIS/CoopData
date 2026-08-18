import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

/** One questionnaire cooperative's row (basic-tier benchmarking). */
export interface BasicBenchmarkRow {
  cooperative_id: string;
  name: string;
  region: string | null;
  sector: string | null;
  has_data: boolean;
  /** questionnaire metric key → value */
  metrics: Record<string, number>;
}

export interface BasicBenchmarkResponse {
  reporting_year: number | null;
  /** Own row for cooperative callers; null for admin callers or no data. */
  cooperative: BasicBenchmarkRow | null;
  /** Full population rows for admin callers; always empty for cooperative callers. */
  rows: BasicBenchmarkRow[];
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

export interface BasicBenchmarkParams {
  reportingYear?: number;
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load basic benchmark data.";
};

/**
 * Fetches the privacy-safe benchmark comparison for questionnaire cooperatives.
 * Cooperative callers receive only their own row plus server-computed averages;
 * admin callers receive the full rows for their scope.
 */
export const useBasicBenchmark = (params: BasicBenchmarkParams = {}, enabled = true) =>
  useOfflineQuery<BasicBenchmarkResponse>({
    queryKey: ["basic-benchmark", params],
    cacheTable: "analytics",
    cacheKey: `basic-benchmark-${JSON.stringify(params)}`,
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/basic-benchmark", {
        params: {
          query: {
            reporting_year: params.reportingYear,
          } as Record<string, unknown>,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Basic benchmark response was empty.");
      return data as BasicBenchmarkResponse;
    },
    staleTime: 60 * 1000,
  });

