import { apiClient } from "@/openapi-client";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";

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
  apex_id?: string | null;
  apex_name?: string | null;
  region: string | null;
  sector: string | null;
  institution_type: string | null;
  has_data: boolean;
  non_financial: CoopNfSummary;
  kpis: Record<string, KpiValue>;
  custom_kpis: Record<string, number>;
}

export interface CoopNfSummary {
  has_data: boolean;
  total_members: number;
  active_members: number;
  active_borrowers: number;
  women_borrowers: number;
  youth_borrowers: number;
  rural_borrowers: number;
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
  custom_kpis: Record<string, number>;
}

export interface NationalOverviewParams {
  reportingYear?: number;
  periodType?: string;
  periodValue?: string;
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
  return "Unable to load portfolio analytics.";
};

const EMPTY_NATIONAL_OVERVIEW: NationalOverviewResponse = {
  total_cooperatives: 0,
  cooperatives_with_data: 0,
  non_financial_summary: {
    cooperatives_with_data: 0,
    average_active_members_pct: 0,
    average_savings_penetration_pct: 0,
    average_credit_penetration_pct: 0,
    average_fd_penetration_pct: 0,
    average_on_time_repayment_pct: 0,
    average_dormancy_pct: 0,
    average_agm_participation_pct: 0,
    average_arrears_rate_pct: 0,
    average_fd_early_withdrawal_pct: 0,
  },
  distributions: {},
  cooperatives: [],
  custom_kpis: {},
};

export const useNationalOverview = (
  params: NationalOverviewParams = {},
  enabled = true,
  tokenOverride?: string,
) =>
  useOfflineQuery<NationalOverviewResponse>({
    queryKey: ["national-overview", params],
    cacheTable: "analytics",
    cacheKey: `national-overview-${JSON.stringify(params)}`,
    enabled,
    fallbackData: EMPTY_NATIONAL_OVERVIEW,
    queryFn: async () => {
      const headers: Record<string, string> | undefined = tokenOverride
        ? { Authorization: `Bearer ${tokenOverride}` }
        : undefined;
      const { data, error } = await apiClient.GET("/api/v1/analytics/national-overview", {
        params: {
          query: {
            reporting_year: params.reportingYear,
            period_type: params.periodType && params.periodType !== "all" ? params.periodType : undefined,
            period_value: params.periodValue && params.periodValue !== "all" ? params.periodValue : undefined,
            cooperative_id: params.cooperativeId,
            region: params.region !== "all" ? params.region : undefined,
            sector: params.sector !== "all" ? params.sector : undefined,
            federation_id: params.federationId !== "all" ? params.federationId : undefined,
            apex_id: params.apexId !== "all" ? params.apexId : undefined,
          } as Record<string, unknown>,
        },
        headers: headers as Record<string, string>,
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Portfolio analytics response was empty.");
      return data as NationalOverviewResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
