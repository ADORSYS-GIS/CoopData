import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

export interface KpiValue {
  name: string;
  value: number;
  formatted: string;
  unit: string;
  status: string | null;
  benchmark: number | null;
  description: string;
}

export interface TrafficLightDistribution {
  green_pct: number;
  amber_pct: number;
  red_pct: number;
  no_data_pct: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  no_data_count: number;
}

export interface CoopKpiRow {
  cooperative_id: string;
  submission_id: string | null;
  name: string;
  region: string | null;
  sector: string | null;
  institution_type: string | null;
  has_data: boolean;
  non_financial: CoopNfSummary;
  kpis: Record<string, KpiValue>;
}

export interface CoopNfSummary {
  has_data: boolean;
  total_members: number;
  active_members_pct: number;
  savings_penetration_pct: number;
  credit_penetration_pct: number;
  fd_penetration_pct: number;
  on_time_repayment_pct: number;
  dormancy_pct: number;
  agm_participation_pct: number;
  arrears_rate_pct: number;
  fd_early_withdrawal_pct: number;
}

export interface NfPortfolioSummary {
  cooperatives_with_data: number;
  average_active_members_pct: number;
  average_savings_penetration_pct: number;
  average_credit_penetration_pct: number;
  average_fd_penetration_pct: number;
  average_on_time_repayment_pct: number;
  average_dormancy_pct: number;
  average_agm_participation_pct: number;
  average_arrears_rate_pct: number;
  average_fd_early_withdrawal_pct: number;
}

export interface NationalOverviewResponse {
  total_cooperatives: number;
  cooperatives_with_data: number;
  non_financial_summary: NfPortfolioSummary;
  distributions: Record<string, TrafficLightDistribution>;
  cooperatives: CoopKpiRow[];
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load portfolio analytics.";
};

export const useNationalOverview = (enabled = true) =>
  useQuery<NationalOverviewResponse>({
    queryKey: ["national-overview"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/national-overview");
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Portfolio analytics response was empty.");
      return data as NationalOverviewResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
