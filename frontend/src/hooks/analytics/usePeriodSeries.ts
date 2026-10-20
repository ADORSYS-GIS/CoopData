import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

type StatementTotals = Omit<
  components["schemas"]["PeriodSeriesPoint"],
  "period_label" | "reporting_year" | "period_type" | "period_value" | "cooperatives_reporting"
>;

/**
 * Like-for-like comparison with the previous point: the totals of the
 * cooperatives present in both periods. Growth is computed from these.
 */
export interface PeriodComparison {
  cooperatives_compared: number;
  current: StatementTotals;
  previous: StatementTotals;
  /** In this period only (new, or the previous period not complete). */
  new_cooperatives: string[];
  /** In the previous period only (this period not complete yet). */
  missing_cooperatives: string[];
}

export type PeriodSeriesPoint = components["schemas"]["PeriodSeriesPoint"] & {
  comparison?: PeriodComparison | null;
};
export type PeriodSeriesResponse = Omit<components["schemas"]["PeriodSeriesResponse"], "points"> & {
  points: PeriodSeriesPoint[];
};

export interface PeriodSeriesQuery {
  reportingYear?: number;
  periodType?: string;
  periodValue?: string;
  cooperativeId?: string;
  region?: string;
  sector?: string;
  federationId?: string;
  apexId?: string;
}

/**
 * The same scope as whole years ending at the chosen year. Indicator cards
 * compare complete years ("this year vs the previous complete year"); only
 * the charts follow a quarterly, half-yearly or monthly frequency.
 */
export const yearSeriesQuery = (query: PeriodSeriesQuery): PeriodSeriesQuery => ({
  ...query,
  periodType: "YEARLY",
  periodValue: undefined,
});

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load the period history.";
};

const unlessAll = (value?: string): string | undefined =>
  value && value !== "all" ? value : undefined;

/**
 * Statement totals per period of the selected frequency, so charts follow the
 * frequency filter: yearly shows years, quarterly shows quarters, and so on.
 */
export const usePeriodSeries = (
  params: PeriodSeriesQuery,
  enabled = true,
  tokenOverride?: string,
) =>
  useOfflineQuery<PeriodSeriesResponse>({
    queryKey: ["period-series", "v1", params],
    cacheTable: "analytics",
    cacheKey: `period-series-v1-${JSON.stringify(params)}`,
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/analytics/period-series", {
        headers,
        params: {
          query: {
            reporting_year: params.reportingYear,
            period_type: unlessAll(params.periodType),
            period_value: unlessAll(params.periodValue),
            cooperative_id: params.cooperativeId,
            region: unlessAll(params.region),
            sector: unlessAll(params.sector),
            federation_id: unlessAll(params.federationId),
            apex_id: unlessAll(params.apexId),
          },
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Period history response was empty.");
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
