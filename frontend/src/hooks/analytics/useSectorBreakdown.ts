import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

export interface SectorBreakdownPoint {
  name: string;
  value: number;
  count: number;
}

export interface SectorBreakdownResponse {
  sectors: SectorBreakdownPoint[];
}

export interface SectorBreakdownFilters {
  region?: string;
  sector?: string;
  federationId?: string;
  apexId?: string;
  cooperativeId?: string;
  reportingYear?: number;
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load sector analytics.";
};

export const useSectorBreakdown = (enabled = true, filters: SectorBreakdownFilters = {}) =>
  useOfflineQuery<SectorBreakdownResponse>({
    queryKey: ["sector-breakdown", filters],
    cacheTable: "analytics",
    cacheKey: `sector-breakdown-${JSON.stringify(filters)}`,
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/sector-breakdown", {
        params: {
          query: {
            region: filters.region !== "all" ? filters.region : undefined,
            sector: filters.sector !== "all" ? filters.sector : undefined,
            federation_id: filters.federationId !== "all" ? filters.federationId : undefined,
            apex_id: filters.apexId !== "all" ? filters.apexId : undefined,
            cooperative_id: filters.cooperativeId !== "all" ? filters.cooperativeId : undefined,
            reporting_year: filters.reportingYear,
          } as never,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Sector analytics response was empty.");
      return data as SectorBreakdownResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
