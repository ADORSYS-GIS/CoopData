import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";

export interface ReconciliationRow {
  key: string;
  label: string;
  sub_ledger_name: string;
  coa_code: number;
  sub_ledger_total: number;
  sub_ledger_count: number;
  financial_total: number | null;
  currency: string;
  variance: number | null;
  status: "match" | "variance" | "pending_subledger" | "pending_financial";
}

export interface ReconciliationAuditResponse {
  submission_id: string;
  rows: ReconciliationRow[];
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load the reconciliation audit.";
};

/**
 * Backend-computed reconciliation between the non-financial sub-ledgers
 * (savings/loans/fixed deposits/shares) and the financial statement's
 * balance sheet line items — replaces client-side summation of paginated
 * non-financial list endpoints, which silently truncated at 200 rows per
 * sub-ledger and produced wrong totals for any cooperative with more
 * records than that.
 */
export const useReconciliationAudit = (submissionId: string | null | undefined, enabled = true) => {
  return useOfflineQuery<ReconciliationAuditResponse>({
    queryKey: ["reconciliation-audit", submissionId],
    cacheTable: "analytics",
    cacheKey: `reconciliation-audit-${submissionId}`,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/analytics/reconciliation", {
        params: { query: { submission_id: submissionId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Reconciliation audit response was empty.");
      return data as ReconciliationAuditResponse;
    },
    enabled: enabled && !!submissionId,
    staleTime: 5 * 60 * 1000,
  });
};
