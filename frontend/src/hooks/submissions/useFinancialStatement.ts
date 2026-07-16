import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type FinancialStatementResponse = components["schemas"]["FinancialStatementResponse"];
export type LineItemResponse = components["schemas"]["LineItemResponse"];
export type LineItemBulkUpdateRequest = components["schemas"]["LineItemBulkUpdateRequest"];

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"];
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

/** Fetch a financial statement by its own ID */
export const useFinancialStatement = (id: string | null | undefined) =>
  useQuery({
    queryKey: ["financial-statement", id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/financial-statements/{id}", {
        params: { path: { id: id! } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as FinancialStatementResponse;
    },
    enabled: !!id,
  });

export const useLineItems = (financialStatementId: string | null) =>
  useQuery({
    queryKey: ["line-items", financialStatementId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/financial-statements/{id}/line-items",
        { params: { path: { id: financialStatementId! } } },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return (data as LineItemResponse[]) ?? [];
    },
    enabled: !!financialStatementId,
  });

export const useUpdateLineItems = (financialStatementId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LineItemBulkUpdateRequest) => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/cooperative/financial-statements/{id}/line-items",
        { params: { path: { id: financialStatementId } }, body },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return (data as LineItemResponse[]) ?? [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["line-items", financialStatementId],
      });
    },
  });
};

export const useValidateExtraction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/cooperative/submissions/{id}/validate-extraction",
        { params: { path: { id: submissionId } } },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statement"] });
      queryClient.invalidateQueries({ queryKey: ["line-items"] });
    },
  });
};

export const useSubmitSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/cooperative/submissions/{id}/submit", {
        params: { path: { id: submissionId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
    },
  });
};

// ── Chart of Accounts — reference data, cached forever ───────────────────────

export interface ChartOfAccountResponse {
  account_code: number;
  account_name: string;
  account_category: string;
  account_subcategory: string | null;
  is_total: boolean;
  is_section_header: boolean;
  formula: string | null;
  display_order: number;
}

export const useChartOfAccounts = () =>
  useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/chart-of-accounts" as never,
      );
      if (error) throw new Error(extractErrorMessage(error));
      return (data as ChartOfAccountResponse[]) ?? [];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

/** Leaf-only CoA entries (no section headers, no total roll-ups) — for dropdowns */
export const useChartOfAccountsLeafs = () => {
  const query = useChartOfAccounts();
  return {
    ...query,
    data: query.data?.filter((c) => !c.is_total && !c.is_section_header) ?? [],
  };
};
