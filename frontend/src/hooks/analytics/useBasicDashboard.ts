import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import type { BasicDashboardParams, BasicDashboardResponse } from "@/types/basic-dashboard";

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load the basic analytics dashboard.";
};

export const buildBasicDashboardQuery = (
  params: BasicDashboardParams,
): Record<string, string | number> => {
  const query: Record<string, string | number> = {};
  if (params.reportingYear !== undefined) query.reporting_year = params.reportingYear;
  if (params.periodType) query.period_type = params.periodType;
  if (params.periodValue) query.period_value = params.periodValue;
  if (params.region) query.region = params.region;
  if (params.sector) query.sector = params.sector;
  if (params.cooperativeId) query.cooperative_id = params.cooperativeId;
  if (params.currency) query.currency = params.currency;
  return query;
};

/**
 * Single source for the Basic Analytics dashboard: KPIs, trend series, market
 * share and demographics are all computed server-side from the questionnaire
 * answers, so the page never re-derives ratios in the browser.
 */
export const useBasicDashboard = (params: BasicDashboardParams, enabled = true) =>
  useOfflineQuery<BasicDashboardResponse>({
    queryKey: ["basic-dashboard", "v1", params],
    cacheTable: "analytics",
    cacheKey: `basic-dashboard-v1-${JSON.stringify(params)}`,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/basic-dashboard", {
        params: { query: buildBasicDashboardQuery(params) },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Basic dashboard response was empty.");
      return data as BasicDashboardResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
