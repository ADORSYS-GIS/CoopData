import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { useUserRole } from "@/lib/auth";
import { getAccessToken } from "@/services/shared/authService";
import { runMutation } from "@/services/shared/syncQueueService";
import type { components } from "@/openapi-client/api";

export type SubmissionSectionResponse = components["schemas"]["SubmissionSectionResponse"];
export type UpdateSectionStatusRequest = components["schemas"]["UpdateSectionStatusRequest"];

const SUBMISSIONS_KEY = "cooperative-submissions";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"];
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

function sectionPath(submissionId: string, section: string, role: string | null): string {
  const base = role === "apex" ? "/api/v1/apex" : "/api/v1/cooperative";
  return `${base}/submissions/${submissionId}/sections/${section}`;
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
  const role = useUserRole();
  return useMutation({
    mutationFn: async ({ section, status }: { section: string; status: string }) => {
      const body: UpdateSectionStatusRequest = { status };
      const endpoint = `/api/v1/${role === "apex" ? "apex" : "cooperative"}/submissions/{id}/sections/{section}`;
      return runMutation<SubmissionSectionResponse>(endpoint, "PATCH", {
        pathParams: { id: submissionId, section },
        body,
        optimisticData: body as unknown as SubmissionSectionResponse,
        online: async () => {
          const path = sectionPath(submissionId, section, role);
          const token = await getAccessToken();
          const res = await fetch(`${API_BASE}${path}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(extractErrorMessage(json));
          return json as SubmissionSectionResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [SUBMISSIONS_KEY, submissionId, "sections"],
      });
      queryClient.invalidateQueries({
        queryKey: [SUBMISSIONS_KEY, submissionId],
      });
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
    },
  });
};
