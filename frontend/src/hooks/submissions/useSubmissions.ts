import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type SubmissionResponse = components["schemas"]["SubmissionResponse"];
export type CreateSubmissionRequest = components["schemas"]["CreateSubmissionRequest"];

const SUBMISSIONS_KEY = "cooperative-submissions";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const useCooperativeSubmissions = () =>
  useQuery({
    queryKey: [SUBMISSIONS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

export const useSubmission = (id: string) =>
  useQuery({
    queryKey: [SUBMISSIONS_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    enabled: !!id,
  });

export const useCreateSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSubmissionRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/cooperative/submissions", { body });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
};

export const useDeleteSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/cooperative/submissions/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
};
