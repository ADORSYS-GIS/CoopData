import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/openapi-client";

export interface NfTrendPoint {
  reporting_year: number;
  cooperative_count: number;
  total_members: number;
  youth_members: number;
  women_members: number;
  active_members_pct: number;
  savings_penetration_pct: number;
  credit_penetration_pct: number;
  fd_penetration_pct: number;
  on_time_repayment_pct: number;
}

export interface NfTrendResponse {
  points: NfTrendPoint[];
}

interface NfTrendParams {
  reportingYear?: number;
  cooperativeId?: string;
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
  return "Unable to load non-financial history.";
};

export const useNfTrend = (params: NfTrendParams = {}, enabled = true) =>
  useQuery<NfTrendResponse>({
    queryKey: ["nf-trend", params],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/nf-trend", {
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
      if (!data) throw new Error("Non-financial history response was empty.");
      return data as NfTrendResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
