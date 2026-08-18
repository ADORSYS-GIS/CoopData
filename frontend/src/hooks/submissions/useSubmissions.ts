import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";
import { getAccessToken, getUserProfile } from "@/services/shared/authService";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { runMutation } from "@/services/shared/syncQueueService";
import { cacheGet, cacheSet, cacheDelete } from "@/services/shared/offlineCache";

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
  useOfflineQuery<SubmissionResponse[]>({
    queryKey: [SUBMISSIONS_KEY],
    cacheTable: "submissions",
    cacheKey: "cooperative-list",
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Apex: submissions of all cooperatives under this apex ─────────────────────

export const useApexSubmissions = (enabled = true) =>
  useOfflineQuery<SubmissionResponse[]>({
    queryKey: ["apex-submissions"],
    cacheTable: "submissions",
    cacheKey: "apex-list",
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// ── Federation: submissions forwarded to federation tier ──────────────────────

export const useFederationSubmissions = (
  options: { all?: boolean; enabled?: boolean } | boolean = true,
) => {
  const all = typeof options === "object" ? options.all : undefined;
  const enabled = typeof options === "object" ? (options.enabled ?? true) : options;
  return useOfflineQuery<SubmissionResponse[]>({
    queryKey: ["federation-submissions", { all, enabled }],
    cacheTable: "submissions",
    cacheKey: `federation-list-${all ?? "default"}`,
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/submissions", {
        params: {
          query: { all },
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });
};

// ── Ministry: all submissions ────────────────────────────────────────────────

export const useMinistrySubmissions = (
  options: { all?: boolean; enabled?: boolean } | boolean = true,
) => {
  const all = typeof options === "object" ? options.all : undefined;
  const enabled = typeof options === "object" ? (options.enabled ?? true) : options;
  return useOfflineQuery<SubmissionResponse[]>({
    queryKey: ["ministry-submissions", { all, enabled }],
    cacheTable: "submissions",
    cacheKey: `ministry-list-${all ?? "default"}`,
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/submissions", {
        params: {
          query: { all },
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });
};

// ── Single submission — role-aware ────────────────────────────────────────────

export const useSubmission = (id: string, role?: string, tokenOverride?: string) =>
  useOfflineQuery<SubmissionResponse>({
    queryKey: [SUBMISSIONS_KEY, id],
    cacheTable: "submissions",
    cacheKey: `submission-${id}`,
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;

      if (role === "apex") {
        const { data, error } = await apiClient.GET("/api/v1/apex/submissions/{id}", {
          params: { path: { id } },
          headers,
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
      if (role === "federation") {
        const { data, error } = await apiClient.GET("/api/v1/federation/submissions/{id}", {
          params: { path: { id } },
          headers,
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
      if (role === "ministry") {
        const { data, error } = await apiClient.GET("/api/v1/ministry/submissions/{id}", {
          params: { path: { id } },
          headers,
        });
        if (error) throw new Error(extractErrorMessage(error));
        return data as SubmissionResponse;
      }
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions/{id}", {
        params: { path: { id } },
        headers,
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
      const localId = crypto.randomUUID();
      const optimistic: SubmissionResponse = {
        id: localId,
        reporting_year: body.reporting_year,
        cooperative_id: "self",
        status: "draft" as unknown as SubmissionResponse["status"],
        submission_method: (body.submission_method ??
          "") as unknown as SubmissionResponse["submission_method"],
        current_tier: "cooperative" as unknown as SubmissionResponse["current_tier"],
        priority: body.priority ?? "Routine",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sections: [],
      };

      const payload = {
        ...body,
        id: localId,
      };

      const userId = getUserProfile()?.id ?? "anon";

      // 1. Write the new optimistic submission to IndexedDB cached lists immediately
      try {
        const cachedCoopList = await cacheGet<SubmissionResponse[]>(
          "submissions",
          "cooperative-list",
          userId,
          true,
        );
        if (cachedCoopList) {
          if (!cachedCoopList.some((s) => s.id === localId)) {
            const updated = [optimistic, ...cachedCoopList];
            await cacheSet("submissions", "cooperative-list", userId, updated);
          }
        } else {
          await cacheSet("submissions", "cooperative-list", userId, [optimistic]);
        }
      } catch (e) {
        console.warn("Failed to update cached cooperative submissions list on create", e);
      }

      // 2. Also cache the submission detail record so details view can open it offline
      try {
        await cacheSet("submissions", `submission-${localId}`, userId, optimistic);
      } catch (e) {
        // ignore
      }

      // 3. Cache empty reviews array for this new submission so no stale review history leaks
      try {
        await cacheSet("submissions", `reviews-${localId}`, userId, []);
      } catch (e) {
        // ignore
      }

      // 4. Cache initial pending section models for this new submission
      const initialSections = [
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "financial",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "members",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "savings",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "loans",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "fixed_deposits",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          submission_id: localId,
          section: "farm_coop",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      try {
        await cacheSet("submissions", `sections-${localId}`, userId, initialSections);
      } catch (e) {
        // ignore
      }

      return runMutation<SubmissionResponse>("/api/v1/cooperative/submissions", "POST", {
        body: payload,
        optimisticData: optimistic,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/cooperative/submissions", {
            body: payload as unknown as CreateSubmissionRequest,
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
};

export const useUpdateSubmissionMethod = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      submissionMethod,
    }: {
      id: string;
      submissionMethod: "upload" | "manual" | "questionnaire";
    }) => {
      const userId = getUserProfile()?.id ?? "anon";

      // 1. Update single submission detail cache in IndexedDB with chosen method
      try {
        const cachedSub = await cacheGet<SubmissionResponse>(
          "submissions",
          `submission-${id}`,
          userId,
          true,
        );
        if (cachedSub) {
          const updatedSub = {
            ...cachedSub,
            submission_method:
              submissionMethod as unknown as SubmissionResponse["submission_method"],
            updated_at: new Date().toISOString(),
          };
          await cacheSet("submissions", `submission-${id}`, userId, updatedSub);
        }
      } catch (e) {
        console.warn("Failed to update submission method in detail cache offline", e);
      }

      // 2. Update submission list cache in IndexedDB with chosen method
      try {
        const cachedList = await cacheGet<SubmissionResponse[]>(
          "submissions",
          "cooperative-list",
          userId,
          true,
        );
        if (cachedList) {
          const updatedList = cachedList.map((s) =>
            s.id === id
              ? {
                  ...s,
                  submission_method:
                    submissionMethod as unknown as SubmissionResponse["submission_method"],
                  updated_at: new Date().toISOString(),
                }
              : s,
          );
          await cacheSet("submissions", "cooperative-list", userId, updatedList);
        }
      } catch (e) {
        console.warn("Failed to update submission method in list cache offline", e);
      }

      return runMutation<SubmissionResponse>(
        "/api/v1/cooperative/submissions/{id}/method",
        "PATCH",
        {
          pathParams: { id },
          body: { submission_method: submissionMethod },
          optimisticData: {
            id,
            submission_method: submissionMethod,
          } as unknown as SubmissionResponse,
          online: async () => {
            const { data, error } = await apiClient.PATCH(
              "/api/v1/cooperative/submissions/{id}/method",
              {
                params: { path: { id } },
                body: { submission_method: submissionMethod },
              },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return data as SubmissionResponse;
          },
        },
      );
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submission-sections", id] });
    },
  });
};

export const useDeleteSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = getUserProfile()?.id ?? "anon";

      // Update cached lists offline
      const listsToUpdate = [
        "cooperative-list",
        "ministry-list-default",
        "ministry-list-all",
        "federation-list-default",
        "federation-list-all",
        "apex-list",
      ];
      for (const listKey of listsToUpdate) {
        try {
          const cachedList = await cacheGet<SubmissionResponse[]>(
            "submissions",
            listKey,
            userId,
            true,
          );
          if (cachedList) {
            const updated = cachedList.filter((s) => s.id !== id);
            await cacheSet("submissions", listKey, userId, updated);
          }
        } catch {
          // ignore
        }
      }

      // Delete cached details offline
      try {
        await cacheDelete("submissions", `submission-${id}`);
      } catch {
        // ignore
      }

      return runMutation<void>("/api/v1/cooperative/submissions/{id}", "DELETE", {
        pathParams: { id },
        optimisticData: undefined,
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/cooperative/submissions/{id}", {
            params: { path: { id } },
          });
          if (error) throw new Error(extractErrorMessage(error));
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
};

export const useDeleteFinancialStatement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { getAccessToken } = await import("@/services/shared/authService");
      const token = await getAccessToken();
      const base = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(
        `${base}/api/v1/cooperative/submissions/${submissionId}/financial-statement`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
    },
    onSuccess: (_data, submissionId) => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY, submissionId] });
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["financial-statement"] });
      queryClient.invalidateQueries({ queryKey: ["extraction-job"] });
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
  useOfflineQuery<SubmissionReviewResponse[]>({
    queryKey: ["submission-reviews", submissionId],
    cacheTable: "submissions",
    cacheKey: `reviews-${submissionId}`,
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
  useOfflineQuery<{
    total_cooperatives: number;
    pending_submissions: number;
    approved_submissions: number;
    rejected_submissions: number;
  }>({
    queryKey: ["apex-stats"],
    cacheTable: "submissions",
    cacheKey: "apex-stats",
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
  useOfflineQuery<{
    total_submissions: number;
    draft_submissions: number;
    pending_submissions: number;
    approved_submissions: number;
    rejected_submissions: number;
  }>({
    queryKey: ["cooperative-stats"],
    cacheTable: "submissions",
    cacheKey: "cooperative-stats",
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
