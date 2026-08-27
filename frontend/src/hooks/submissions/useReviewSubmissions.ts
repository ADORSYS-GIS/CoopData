import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import type { components } from "@/openapi-client/api";
import {
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
  type SubmissionReviewResponse,
} from "@/hooks/submissions/useSubmissions";
import { cacheGet, cacheSet } from "@/services/shared/offlineCache";
import { getUserProfile } from "@/services/shared/authService";

export type SubmissionResponse = components["schemas"]["SubmissionResponse"];
export type ReviewActionRequest = components["schemas"]["ReviewActionRequest"];
export type AbnormalityFlagResponse = components["schemas"]["AbnormalityFlagResponse"];

export { useApexSubmissions, useFederationSubmissions, useMinistrySubmissions };

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

async function updateCachedSubmissionStatus(
  id: string,
  newStatus: "draft" | "submitted" | "approved" | "rejected" | "in_review",
  newTier: "cooperative" | "apex" | "federation" | "ministry",
  comment?: string,
  reviewAction?: string,
) {
  const userId = getUserProfile()?.id ?? "anon";

  // 1. Update submission details cache
  try {
    const cachedDetail = await cacheGet<SubmissionResponse>(
      "submissions",
      `submission-${id}`,
      userId,
      true,
    );
    if (cachedDetail) {
      const updated = {
        ...cachedDetail,
        status: newStatus,
        current_tier: newTier,
      };
      await cacheSet("submissions", `submission-${id}`, userId, updated);
    }
  } catch (e) {
    // ignore
  }

  // 2. Update all cached submissions list keys
  const listKeys = [
    "cooperative-list",
    "ministry-list-default",
    "ministry-list-all",
    "federation-list-default",
    "federation-list-all",
    "apex-list",
  ];
  for (const listKey of listKeys) {
    try {
      const cachedList = await cacheGet<SubmissionResponse[]>("submissions", listKey, userId, true);
      if (cachedList) {
        const updated = cachedList.map((s) => {
          if (s.id === id) {
            return {
              ...s,
              status: newStatus,
              current_tier: newTier,
            };
          }
          return s;
        });
        await cacheSet("submissions", listKey, userId, updated);
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Append review entry to reviews-${id} cache list
  if (reviewAction) {
    try {
      const reviews =
        (await cacheGet<SubmissionReviewResponse[]>(
          "submissions",
          `reviews-${id}`,
          userId,
          true,
        )) ?? [];
      const newReview = {
        id: crypto.randomUUID(),
        submission_id: id,
        tier:
          newTier === "cooperative"
            ? "Cooperative"
            : newTier === "apex"
              ? "Apex"
              : newTier === "federation"
                ? "Federation"
                : "Ministry",
        reviewer_id: userId,
        action: reviewAction,
        comment: comment ?? null,
        created_at: new Date().toISOString(),
      };
      await cacheSet("submissions", `reviews-${id}`, userId, [...reviews, newReview]);
    } catch (e) {
      // ignore
    }
  }
}

// ── Apex ──────────────────────────────────────────────────────────────────────

export const useSubmissionFlags = (submissionId: string | null) =>
  useOfflineQuery({
    queryKey: ["submission-flags", submissionId],
    cacheTable: "submissions",
    cacheKey: `submission-flags-${submissionId}`,
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
      await updateCachedSubmissionStatus(id, "in_review", "federation", comment, "approve");
      return runMutation<SubmissionResponse>("/api/v1/apex/submissions/{id}/approve", "POST", {
        pathParams: { id },
        body: { comment },
        optimisticData: { id, status: "in_review" } as unknown as SubmissionResponse,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/apex/submissions/{id}/approve", {
            params: { path: { id } },
            body: { comment },
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
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
      await updateCachedSubmissionStatus(id, "draft", "cooperative", comment, "return");
      return runMutation<SubmissionResponse>("/api/v1/apex/submissions/{id}/return", "POST", {
        pathParams: { id },
        body: { comment },
        optimisticData: { id, status: "draft" } as unknown as SubmissionResponse,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/apex/submissions/{id}/return", {
            params: { path: { id } },
            body: { comment },
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
    },
  });
};

// ── Federation ────────────────────────────────────────────────────────────────

export const useFederationApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      await updateCachedSubmissionStatus(id, "in_review", "ministry", comment, "approve");
      return runMutation<SubmissionResponse>(
        "/api/v1/federation/submissions/{id}/approve",
        "POST",
        {
          pathParams: { id },
          body: { comment },
          optimisticData: { id, status: "in_review" } as unknown as SubmissionResponse,
          online: async () => {
            const { data, error } = await apiClient.POST(
              "/api/v1/federation/submissions/{id}/approve",
              {
                params: { path: { id } },
                body: { comment },
              },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return data as SubmissionResponse;
          },
        },
      );
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
      await updateCachedSubmissionStatus(id, "submitted", "apex", comment, "return");
      return runMutation<SubmissionResponse>("/api/v1/federation/submissions/{id}/return", "POST", {
        pathParams: { id },
        body: { comment },
        optimisticData: { id, status: "submitted" } as unknown as SubmissionResponse,
        online: async () => {
          const { data, error } = await apiClient.POST(
            "/api/v1/federation/submissions/{id}/return",
            {
              params: { path: { id } },
              body: { comment },
            },
          );
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["federation-submissions"] });
    },
  });
};

// ── Ministry ──────────────────────────────────────────────────────────────────

export const useMinistryApprove = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      await updateCachedSubmissionStatus(id, "approved", "ministry", comment, "approve");
      return runMutation<SubmissionResponse>("/api/v1/ministry/submissions/{id}/approve", "POST", {
        pathParams: { id },
        body: { comment },
        optimisticData: { id, status: "approved" } as unknown as SubmissionResponse,
        online: async () => {
          const { data, error } = await apiClient.POST(
            "/api/v1/ministry/submissions/{id}/approve",
            {
              params: { path: { id } },
              body: { comment },
            },
          );
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
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
      await updateCachedSubmissionStatus(id, "rejected", "ministry", comment, "reject");
      return runMutation<SubmissionResponse>("/api/v1/ministry/submissions/{id}/reject", "POST", {
        pathParams: { id },
        body: { comment },
        optimisticData: { id, status: "rejected" } as unknown as SubmissionResponse,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/ministry/submissions/{id}/reject", {
            params: { path: { id } },
            body: { comment },
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as SubmissionResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministry-submissions"] });
    },
  });
};
