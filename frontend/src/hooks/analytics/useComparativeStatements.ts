import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

export interface CooperativeLineItem {
  account_code?: number | null;
  account_name: string;
  value: number;
  month: number;
}

export interface CooperativeStatementGrid {
  cooperative_id: string;
  cooperative_name: string;
  line_items: CooperativeLineItem[];
}

export interface ComparativeStatementsResponse {
  year: number;
  grids: CooperativeStatementGrid[];
}

export interface ComparativeStatementsParams {
  reportingYear?: number;
  cooperativeIds?: string; // Comma-separated cooperative IDs
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load comparative statements.";
};

export const useComparativeStatements = (
  params: ComparativeStatementsParams = {},
  enabled = true,
) =>
  useOfflineQuery<ComparativeStatementsResponse>({
    queryKey: ["comparative-statements", params],
    cacheTable: "analytics",
    cacheKey: `comparative-statements-${JSON.stringify(params)}`,
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET(
        "/api/v1/analytics/comparative-statements",
        {
          params: {
            query: {
              reporting_year: params.reportingYear,
              cooperative_ids: params.cooperativeIds,
            } as Record<string, unknown>,
          },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Comparative statements response was empty.");
      return data as ComparativeStatementsResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
