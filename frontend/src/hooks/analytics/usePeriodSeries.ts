import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type PeriodSeriesResponse = components["schemas"]["PeriodSeriesResponse"];
export type PeriodSeriesPoint = components["schemas"]["PeriodSeriesPoint"];

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
export const usePeriodSeries = (params: PeriodSeriesQuery, enabled = true) =>
  useOfflineQuery<PeriodSeriesResponse>({
    queryKey: ["period-series", "v1", params],
    cacheTable: "analytics",
    cacheKey: `period-series-v1-${JSON.stringify(params)}`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/period-series", {
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
