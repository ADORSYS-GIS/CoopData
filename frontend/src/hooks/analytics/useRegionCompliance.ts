import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

export interface RegionCompliancePoint {
  name: string;
  score: number;
  coops: number;
}

export interface RegionComplianceResponse {
  regions: RegionCompliancePoint[];
}

export interface RegionComplianceFilters {
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
  return "Unable to load regional compliance analytics.";
};

export const useRegionCompliance = (enabled = true, filters: RegionComplianceFilters = {}) =>
  useQuery<RegionComplianceResponse>({
    queryKey: ["region-compliance", filters],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/region-compliance", {
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
      if (!data) throw new Error("Regional compliance response was empty.");
      return data as RegionComplianceResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
