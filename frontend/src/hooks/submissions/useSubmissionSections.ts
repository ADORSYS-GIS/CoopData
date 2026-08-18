import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import type { components } from "@/openapi-client/api";

export type SubmissionSectionResponse = components["schemas"]["SubmissionSectionResponse"];
export type UpdateSectionStatusRequest = components["schemas"]["UpdateSectionStatusRequest"];

const SUBMISSIONS_KEY = "cooperative-submissions";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"];
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

export const useSubmissionSections = (submissionId: string | null | undefined) =>
  useOfflineQuery({
    queryKey: [SUBMISSIONS_KEY, submissionId, "sections"],
    cacheTable: "submissions",
    cacheKey: `sections-${submissionId}`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions/{id}/sections", {
        params: { path: { id: submissionId! } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionSectionResponse[]) ?? [];
    },
    enabled: !!submissionId,
  });

export const useUpdateSubmissionSection = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ section, status }: { section: string; status: string }) => {
      const body: UpdateSectionStatusRequest = { status };
      return runMutation<SubmissionSectionResponse>(
        "/api/v1/cooperative/submissions/{id}/sections/{section}",
        "PATCH",
        {
          pathParams: { id: submissionId, section },
          body,
          optimisticData: body as unknown as SubmissionSectionResponse,
          online: async () => {
            const { data, error } = await apiClient.PATCH(
              "/api/v1/cooperative/submissions/{id}/sections/{section}",
              {
                params: { path: { id: submissionId, section } },
                body,
              },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return data as SubmissionSectionResponse;
          },
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [SUBMISSIONS_KEY, submissionId, "sections"],
      });
      queryClient.invalidateQueries({
        queryKey: [SUBMISSIONS_KEY, submissionId],
      });
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
};
