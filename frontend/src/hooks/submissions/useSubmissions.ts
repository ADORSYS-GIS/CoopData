import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";
import { getAccessToken } from "@/services/shared/authService";

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

// ── Cooperative: own submissions only ────────────────────────────────────────

export const useCooperativeSubmissions = (enabled = true) =>
  useQuery({
    queryKey: [SUBMISSIONS_KEY],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Apex: submissions of all cooperatives under this apex ─────────────────────

export const useApexSubmissions = (enabled = true) =>
  useQuery({
    queryKey: ["apex-submissions"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Federation: submissions forwarded to federation tier ──────────────────────

export const useFederationSubmissions = (enabled = true) =>
  useQuery({
    queryKey: ["federation-submissions"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Ministry: all submissions ────────────────────────────────────────────────

export const useMinistrySubmissions = (enabled = true) =>
  useQuery({
    queryKey: ["ministry-submissions"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Single submission — role-aware ────────────────────────────────────────────

export const useSubmission = (id: string, role?: string) =>
  useQuery({
    queryKey: [SUBMISSIONS_KEY, id],
    queryFn: async () => {
      if (role === "apex") {
        const { data, error } = await apiClient.GET("/api/v1/apex/submissions/{id}", {
          params: { path: { id } },
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
      if (role === "federation") {
        const { data, error } = await apiClient.GET("/api/v1/federation/submissions/{id}", {
          params: { path: { id } },
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
      if (role === "ministry") {
        const { data, error } = await apiClient.GET("/api/v1/ministry/submissions/{id}", {
          params: { path: { id } },
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
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

// ── Submission Reviews (review history / comments) ─────────────────────────────

export interface SubmissionReviewResponse {
  id: string;
  submission_id: string;
  tier: string;
  reviewer_id: string | null;
  action: string;
  comment: string | null;
  created_at: string;
}

export const useSubmissionReviews = (submissionId: string | undefined) =>
  useQuery({
    queryKey: ["submission-reviews", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const token = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(`${baseUrl}/api/v1/cooperative/submissions/${submissionId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch reviews (${res.status})`);
      return (await res.json()) as SubmissionReviewResponse[];
    },
  });

// ── Stats hooks ───────────────────────────────────────────────────────────────

export const useApexStats = (enabled = true) =>
  useQuery({
    queryKey: ["apex-stats"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/stats");
      if (error) throw new Error(extractErrorMessage(error));
      return data as {
        total_cooperatives: number;
        pending_submissions: number;
        approved_submissions: number;
        rejected_submissions: number;
      };
    },
  });

export const useCooperativeStats = (enabled = true) =>
  useQuery({
    queryKey: ["cooperative-stats"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/stats");
      if (error) throw new Error(extractErrorMessage(error));
      return data as {
        total_submissions: number;
        draft_submissions: number;
        pending_submissions: number;
        approved_submissions: number;
        rejected_submissions: number;
      };
    },
  });
