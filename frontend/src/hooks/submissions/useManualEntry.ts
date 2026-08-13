import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import type {
  ManualFinancialStatementRequest,
  ManualFinancialStatementResponse,
  ManualMembersRequest,
} from "@/types/manual-entry";

// ── Hooks ─────────────────────────────────────────────────────────────────────

export const useSubmitManualFinancialStatement = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: ManualFinancialStatementRequest,
    ): Promise<ManualFinancialStatementResponse> => {
      return runMutation<ManualFinancialStatementResponse>(
        "/api/v1/cooperative/submissions/{id}/manual-financial-statement",
        "POST",
        {
          pathParams: { id: submissionId },
          body,
          optimisticData: body as unknown as ManualFinancialStatementResponse,
          online: async () => {
            const { data, error } = await apiClient.POST(
              "/api/v1/cooperative/submissions/{id}/manual-financial-statement",
              {
                params: { path: { id: submissionId } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                body: body as any,
              },
            );
            if (error) {
              const msg = (error as Record<string, string>)["message"] ?? "Submission failed";
              throw new Error(msg);
            }
            return data as ManualFinancialStatementResponse;
          },
        },
      );
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", submissionId, "sections"],
      });
      void queryClient.invalidateQueries({ queryKey: ["financial-statement", data.id] });
      void queryClient.invalidateQueries({ queryKey: ["line-items", data.id] });
    },
  });
};

export const useSubmitManualMembers = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ManualMembersRequest): Promise<void> => {
      return runMutation<void>("/api/v1/cooperative/submissions/{id}/manual-members", "POST", {
        pathParams: { id: submissionId },
        body,
        optimisticData: undefined,
        online: async () => {
          const { error } = await apiClient.POST(
            "/api/v1/cooperative/submissions/{id}/manual-members",
            {
              params: { path: { id: submissionId } },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              body: body as any,
            },
          );
          if (error) {
            const msg = (error as Record<string, string>)["message"] ?? "Submission failed";
            throw new Error(msg);
          }
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", submissionId, "sections"],
      });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
};

export const useDeleteManualFinancialStatement = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      return runMutation<void>(
        "/api/v1/cooperative/submissions/{id}/financial-statement",
        "DELETE",
        {
          pathParams: { id: submissionId },
          optimisticData: undefined,
          online: async () => {
            const { error } = await apiClient.DELETE(
              "/api/v1/cooperative/submissions/{id}/financial-statement",
              { params: { path: { id: submissionId } } },
            );
            if (error) {
              const msg = (error as Record<string, string>)["message"] ?? "Deletion failed";
              throw new Error(msg);
            }
          },
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", submissionId, "sections"],
      });
    },
  });
};

export const useDeleteManualNonFinancialData = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      return runMutation<void>("/api/v1/cooperative/submissions/{id}/non-financial", "DELETE", {
        pathParams: { id: submissionId },
        optimisticData: undefined,
        online: async () => {
          const { error } = await apiClient.DELETE(
            "/api/v1/cooperative/submissions/{id}/non-financial",
            { params: { path: { id: submissionId } } },
          );
          if (error) {
            const msg = (error as Record<string, string>)["message"] ?? "Deletion failed";
            throw new Error(msg);
          }
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", submissionId, "sections"],
      });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
};
