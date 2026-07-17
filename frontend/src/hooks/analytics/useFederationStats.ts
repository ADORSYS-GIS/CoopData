import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

export interface FederationStatsResponse {
  cooperative_count: number;
  submission_count: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
  average_par30: number | null;
  average_car: number | null;
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const useFederationStats = (enabled = true) =>
  useQuery<FederationStatsResponse>({
    queryKey: ["federation-stats"],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/federation/stats");
      if (error) throw new Error(extractErrorMessage(error));
      return data as FederationStatsResponse;
    },
    staleTime: 2 * 60 * 1000,
  });
