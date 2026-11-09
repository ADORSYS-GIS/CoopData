import { apiClient } from "@/openapi-client";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { offlineCacheKeys } from "@/services/shared/offlineCacheKeys";

export interface MinistryStatsResponse {
  total_cooperatives: number;
  total_submissions: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
}

export interface MinistryStatsParams {
  reportingYear?: number;
  cooperativeId?: string;
  region?: string;
  sector?: string;
  federationId?: string;
  apexId?: string;
  /** Count only cooperatives of this type: `sacco` or `multipurpose`. */
  institutionType?: "sacco" | "multipurpose";
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

/**
 * Ministry-level aggregate dashboard statistics.
 * Counts cooperatives and submission statuses across the entire platform.
 */
export const useMinistryStats = (params: MinistryStatsParams = {}, enabled = true) =>
  useOfflineQuery<MinistryStatsResponse>({
    queryKey: ["ministry-stats", params],
    ...offlineCacheKeys.ministryStats(params),
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/ministry/stats", {
        params: {
          query: {
            reporting_year: params.reportingYear,
            cooperative_id: params.cooperativeId,
            region: params.region,
            sector: params.sector,
            federation_id: params.federationId,
            apex_id: params.apexId,
            institution_type: params.institutionType,
          },
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as MinistryStatsResponse;
    },
    staleTime: 2 * 60 * 1000,
  });
