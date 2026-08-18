import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

export interface MembershipStats {
  total: number;
  active: number;
  dormant: number;
  exited: number;
  male: number;
  female: number;
  other: number;
  under_18: number;
  age_18_35: number;
  age_36_50: number;
  over_50: number;
  urban: number;
  rural: number;
  agm_attendance: number;
  leadership_count: number;
  voting_count: number;
  active_pct: number;
  dormancy_pct: number;
  exit_pct: number;
  male_pct: number;
  female_pct: number;
  other_pct: number;
  youth_pct: number;
  adult_pct: number;
  urban_pct: number;
  rural_pct: number;
  agm_participation_pct: number;
  women_in_governance_pct: number;
  youth_in_governance_pct: number;
}

export interface SavingsStats {
  total_accounts: number;
  active_accounts: number;
  dormant_accounts: number;
  /** Backend field: zero_balance_count (number of accounts with zero balance) */
  zero_balance_count: number;
  /** Alias kept for backwards-compat in case some callers still use the old name */
  zero_balance_accounts?: number;
  increasing_trend: number;
  stable_trend: number;
  declining_trend: number;
  high_withdrawal_count: number;
  emergency_withdrawal_count: number;
  total_balance: number;
  average_balance: number;
  savings_penetration_pct: number;
  active_savers_pct: number;
  dormant_savings_pct: number;
  zero_balance_pct: number;
  increasing_trend_pct: number;
  regular_savers_pct: number;
}

export interface LoanStats {
  total_loans: number;
  active_loans: number;
  performing: number;
  arrears: number;
  restructured: number;
  written_off: number;
  members_with_loans: number;
  youth_borrowers: number;
  women_borrowers: number;
  rural_borrowers: number;
  multiple_loan_count: number;
  large_borrower_count: number;
  total_balance: number;
  total_loan_amount: number;
  average_loan_size: number;
  on_time_repayment_pct: number;
  arrears_rate_pct: number;
  restructured_pct: number;
  credit_penetration_pct: number;
  youth_borrower_pct: number;
  women_borrower_pct: number;
  rural_borrower_pct: number;
}

export interface FixedDepositStats {
  total_fds: number;
  active_fds: number;
  matured_fds: number;
  withdrawn_fds: number;
  rolled_over_fds: number;
  members_with_fds: number;
  early_withdrawal_count: number;
  single_depositor_count: number;
  total_balance: number;
  average_balance: number;
  fd_penetration_pct: number;
  early_withdrawal_pct: number;
  rollover_rate_pct: number;
  concentration_risk_pct: number;
}

export interface FarmCoopStats {
  total_coops: number;
  active_producers: number;
  using_planning: number;
  using_shared_inputs: number;
  with_offtake_agreement: number;
  with_storage: number;
  with_processing: number;
  with_irrigation: number;
  with_climate_mitigation: number;
  active_producer_pct: number;
  planning_adoption_pct: number;
  shared_services_pct: number;
  formal_offtake_pct: number;
  storage_coverage_pct: number;
  processing_access_pct: number;
  irrigation_coverage_pct: number;
  climate_mitigation_pct: number;
}

export interface NfStatisticsResponse {
  membership: MembershipStats;
  savings: SavingsStats;
  loans: LoanStats;
  fixed_deposits: FixedDepositStats;
  farm_coop: FarmCoopStats;
  computed_at: string;
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export interface NfStatisticsParams {
  reportingYear?: number;
  cooperativeId?: string;
  region?: string;
  sector?: string;
  federationId?: string;
  apexId?: string;
}

const emptyMembership: MembershipStats = {
  total: 0,
  active: 0,
  dormant: 0,
  exited: 0,
  male: 0,
  female: 0,
  other: 0,
  under_18: 0,
  age_18_35: 0,
  age_36_50: 0,
  over_50: 0,
  urban: 0,
  rural: 0,
  agm_attendance: 0,
  leadership_count: 0,
  voting_count: 0,
  active_pct: 0,
  dormancy_pct: 0,
  exit_pct: 0,
  male_pct: 0,
  female_pct: 0,
  other_pct: 0,
  youth_pct: 0,
  adult_pct: 0,
  urban_pct: 0,
  rural_pct: 0,
  agm_participation_pct: 0,
  women_in_governance_pct: 0,
  youth_in_governance_pct: 0,
};

const emptySavings: SavingsStats = {
  total_accounts: 0,
  active_accounts: 0,
  dormant_accounts: 0,
  zero_balance_count: 0,
  increasing_trend: 0,
  stable_trend: 0,
  declining_trend: 0,
  high_withdrawal_count: 0,
  emergency_withdrawal_count: 0,
  total_balance: 0,
  average_balance: 0,
  savings_penetration_pct: 0,
  active_savers_pct: 0,
  dormant_savings_pct: 0,
  zero_balance_pct: 0,
  increasing_trend_pct: 0,
  regular_savers_pct: 0,
};

const emptyLoans: LoanStats = {
  total_loans: 0,
  active_loans: 0,
  performing: 0,
  arrears: 0,
  restructured: 0,
  written_off: 0,
  members_with_loans: 0,
  youth_borrowers: 0,
  women_borrowers: 0,
  rural_borrowers: 0,
  multiple_loan_count: 0,
  large_borrower_count: 0,
  total_balance: 0,
  total_loan_amount: 0,
  average_loan_size: 0,
  on_time_repayment_pct: 0,
  arrears_rate_pct: 0,
  restructured_pct: 0,
  credit_penetration_pct: 0,
  youth_borrower_pct: 0,
  women_borrower_pct: 0,
  rural_borrower_pct: 0,
};

const emptyFixedDeposit: FixedDepositStats = {
  total_fds: 0,
  active_fds: 0,
  matured_fds: 0,
  withdrawn_fds: 0,
  rolled_over_fds: 0,
  members_with_fds: 0,
  early_withdrawal_count: 0,
  single_depositor_count: 0,
  total_balance: 0,
  average_balance: 0,
  fd_penetration_pct: 0,
  early_withdrawal_pct: 0,
  rollover_rate_pct: 0,
  concentration_risk_pct: 0,
};

const emptyFarmCoop: FarmCoopStats = {
  total_coops: 0,
  active_producers: 0,
  using_planning: 0,
  using_shared_inputs: 0,
  with_offtake_agreement: 0,
  with_storage: 0,
  with_processing: 0,
  with_irrigation: 0,
  with_climate_mitigation: 0,
  active_producer_pct: 0,
  planning_adoption_pct: 0,
  shared_services_pct: 0,
  formal_offtake_pct: 0,
  storage_coverage_pct: 0,
  processing_access_pct: 0,
  irrigation_coverage_pct: 0,
  climate_mitigation_pct: 0,
};

const defaultNfStatsFallback: NfStatisticsResponse = {
  membership: emptyMembership,
  savings: emptySavings,
  loans: emptyLoans,
  fixed_deposits: emptyFixedDeposit,
  farm_coop: emptyFarmCoop,
  computed_at: new Date().toISOString(),
};

export const useNfStatistics = (
  isCooperative: boolean,
  params: NfStatisticsParams = {},
  enabled = true,
) =>
  useOfflineQuery<NfStatisticsResponse>({
    queryKey: ["nf-statistics", isCooperative, params],
    cacheTable: "analytics",
    cacheKey: `nf-statistics-${isCooperative}-${JSON.stringify(params)}`,
    enabled,
    fallbackData: defaultNfStatsFallback,
    queryFn: async () => {
      if (isCooperative) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (apiClient as any).GET("/api/v1/cooperative/nf-statistics", {
          params: {
            query: {
              reporting_year: params.reportingYear,
            } as Record<string, unknown>,
          },
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as NfStatisticsResponse;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (apiClient as any).GET(
          "/api/v1/analytics/consolidated-nf-statistics",
          {
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
          },
        );
        if (error) throw new Error(extractErrorMessage(error));
        return data as NfStatisticsResponse;
      }
    },
    staleTime: 2 * 60 * 1000,
  });
