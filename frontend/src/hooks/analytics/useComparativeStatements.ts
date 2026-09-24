import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import type { RateUsed } from "@/lib/currency";
import { apiClient } from "@/openapi-client";

export interface CooperativeLineItem {
  account_code?: number | null;
  account_name: string;
  /** Amount in the statement's native currency, as printed in the source document. */
  value: number;
  /** Amount converted to USD server-side at the submission's frozen (or current) rate. */
  value_usd: number;
  month: number;
  is_derived?: boolean;
}

export interface CooperativeStatementGrid {
  cooperative_id: string;
  cooperative_name: string;
  line_items: CooperativeLineItem[];
  currency?: string;
  is_validated?: boolean;
  has_unmapped_items?: boolean;
  rate_used?: RateUsed | null;
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
    queryKey: ["comparative-statements", "v2", params],
    cacheTable: "analytics",
    cacheKey: `comparative-statements-v2-${JSON.stringify(params)}`,
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
