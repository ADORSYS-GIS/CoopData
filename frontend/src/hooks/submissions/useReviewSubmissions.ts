import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type SubmissionResponse = components["schemas"]["SubmissionResponse"];
export type ReviewActionRequest = components["schemas"]["ReviewActionRequest"];
export type AbnormalityFlagResponse = components["schemas"]["AbnormalityFlagResponse"];

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

// ── Apex ──────────────────────────────────────────────────────────────────────

export const useApexSubmissions = () =>
  useQuery({
    queryKey: ["apex-submissions"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

export const useSubmissionFlags = (submissionId: string | null) =>
  useQuery({
    queryKey: ["submission-flags", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/submissions/{id}/flags", {
        params: { path: { id: submissionId! } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as AbnormalityFlagResponse[]) ?? [];
    },
    enabled: !!submissionId,
  });

export const useApexApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/submissions/{id}/approve", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
    },
  });
};

export const useApexReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/submissions/{id}/return", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
    },
  });
};

// ── Federation ────────────────────────────────────────────────────────────────

export const useFederationSubmissions = () =>
  useQuery({
    queryKey: ["federation-submissions"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

export const useFederationApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/federation/submissions/{id}/approve", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["federation-submissions"] });
    },
  });
};

export const useFederationReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/federation/submissions/{id}/return", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["federation-submissions"] });
    },
  });
};

// ── Ministry ──────────────────────────────────────────────────────────────────

export const useMinistrySubmissions = () =>
  useQuery({
    queryKey: ["ministry-submissions"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

export const useMinistryApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/ministry/submissions/{id}/approve", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministry-submissions"] });
    },
  });
};

export const useMinistryReject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/ministry/submissions/{id}/reject", {
        params: { path: { id } },
        body: { comment },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SubmissionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministry-submissions"] });
    },
  });
};
