import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import { getUserProfile } from "@/services/shared/authService";
import { cacheGet, cacheSet } from "@/services/shared/offlineCache";
import type { SubmissionResponse } from "./useSubmissions";
import type { components } from "@/openapi-client/api";

export type FinancialStatementResponse = components["schemas"]["FinancialStatementResponse"] & {
  start_month?: number;
  period_type?: string;
};
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
  useOfflineQuery({
    queryKey: ["financial-statement", id],
    cacheTable: "submissions",
    cacheKey: `financial-statement-${id}`,
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
  useOfflineQuery({
    queryKey: ["line-items", financialStatementId],
    cacheTable: "submissions",
    cacheKey: `line-items-${financialStatementId}`,
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
      return runMutation<LineItemResponse[]>(
        "/api/v1/cooperative/financial-statements/{id}/line-items",
        "PATCH",
        {
          pathParams: { id: financialStatementId },
          body,
          optimisticData: body as unknown as LineItemResponse[],
          online: async () => {
            const { data, error } = await apiClient.PATCH(
              "/api/v1/cooperative/financial-statements/{id}/line-items",
              { params: { path: { id: financialStatementId } }, body },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return (data as LineItemResponse[]) ?? [];
          },
        },
      );
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
      return runMutation<unknown>(
        "/api/v1/cooperative/submissions/{id}/validate-extraction",
        "POST",
        {
          pathParams: { id: submissionId },
          optimisticData: undefined,
          online: async () => {
            const { data, error } = await apiClient.POST(
              "/api/v1/cooperative/submissions/{id}/validate-extraction",
              { params: { path: { id: submissionId } } },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return data;
          },
        },
      );
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
      const userId = getUserProfile()?.id ?? "anon";

      // 1. Update single submission detail cache in IndexedDB
      try {
        const cachedSub = await cacheGet<SubmissionResponse>(
          "submissions",
          `submission-${submissionId}`,
          userId,
          true,
        );
        if (cachedSub) {
          const updatedSub = {
            ...cachedSub,
            status: "submitted" as unknown as SubmissionResponse["status"],
            current_tier: "apex" as unknown as SubmissionResponse["current_tier"],
            updated_at: new Date().toISOString(),
          };
          await cacheSet("submissions", `submission-${submissionId}`, userId, updatedSub);
        }
      } catch (e) {
        console.warn("Failed to update cached submission detail on submit offline", e);
      }

      // 2. Update submission list cache in IndexedDB
      try {
        const cachedList = await cacheGet<SubmissionResponse[]>(
          "submissions",
          "cooperative-list",
          userId,
          true,
        );
        if (cachedList) {
          const updatedList = cachedList.map((s) =>
            s.id === submissionId
              ? {
                  ...s,
                  status: "submitted" as unknown as SubmissionResponse["status"],
                  current_tier: "apex" as unknown as SubmissionResponse["current_tier"],
                  updated_at: new Date().toISOString(),
                }
              : s,
          );
          await cacheSet("submissions", "cooperative-list", userId, updatedList);
        }
      } catch (e) {
        console.warn("Failed to update cached submission list on submit offline", e);
      }

      const userRole = getUserProfile()?.role ?? "cooperative";
      const basePath =
        userRole === "apex"
          ? "/api/v1/apex/submissions/{id}/submit"
          : "/api/v1/cooperative/submissions/{id}/submit";

      return runMutation<unknown>(basePath, "POST", {
        pathParams: { id: submissionId },
        optimisticData: { id: submissionId, status: "submitted", current_tier: "apex" },
        online: async () => {
          const { data, error } = await apiClient.POST(
            basePath as "/api/v1/cooperative/submissions/{id}/submit",
            {
              params: { path: { id: submissionId } },
            },
          );
          if (error) throw new Error(extractErrorMessage(error));
          return data;
        },
      });
    },
    onSuccess: (_data, submissionId) => {
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
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
  useOfflineQuery({
    queryKey: ["chart-of-accounts"],
    cacheTable: "submissions",
    cacheKey: "chart-of-accounts",
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/chart-of-accounts" as never);
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
