import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

export interface MinistryStatsResponse {
  total_cooperatives: number;
  total_submissions: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
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
export const useMinistryStats = (enabled = true) =>
  useQuery<MinistryStatsResponse>({
    queryKey: ["ministry-stats"],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/ministry/stats");
      if (error) throw new Error(extractErrorMessage(error));
      return data as MinistryStatsResponse;
    },
    staleTime: 2 * 60 * 1000,
  });
