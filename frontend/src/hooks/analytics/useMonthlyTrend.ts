import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

export interface MonthlyTrendPoint {
  month: number;
  month_label: string;
  savings: number;
  loans: number;
  assets: number;
}

export interface MonthlyTrendResponse {
  year: number;
  months: MonthlyTrendPoint[];
}

export interface MonthlyTrendParams {
  reportingYear?: number;
  cooperativeId?: string;
  // Server-side filter params
  region?: string;
  sector?: string;
  federationId?: string;
  apexId?: string;
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load monthly financial history.";
};

export const useMonthlyTrend = (params: MonthlyTrendParams = {}, enabled = true) => {
  return useOfflineQuery<MonthlyTrendResponse>({
    queryKey: ["monthly-trend", params],
    cacheTable: "analytics",
    cacheKey: `monthly-trend-${JSON.stringify(params)}`,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/monthly-trend", {
        params: {
          query: {
            reporting_year: params.reportingYear,
            cooperative_id: params.cooperativeId,
            region: params.region !== "all" ? params.region : undefined,
            sector: params.sector !== "all" ? params.sector : undefined,
            federation_id: params.federationId !== "all" ? params.federationId : undefined,
            apex_id: params.apexId !== "all" ? params.apexId : undefined,
          } as Record<string, unknown>,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Monthly financial history response was empty.");
      return data as MonthlyTrendResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};
