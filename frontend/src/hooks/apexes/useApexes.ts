/**
 * React Query hooks for apex-related API endpoints.
 *
 * Federation role required for all apex CRUD and member management endpoints.
 * All API calls go through apiClient (openapi-fetch) with automatic Bearer token injection.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import type { components } from "@/openapi-client/api";

const APEXES_KEY = "apexes";

type ApexResponse = components["schemas"]["ApexResponse"];
type MemberResponse = components["schemas"]["MemberResponse"];

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

const normalizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "data" in value) {
    const d = (value as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
};

// ─── Apex CRUD ───────────────────────────────────────────────────────────────

export const useApexes = (enabled = true) =>
  useOfflineQuery({
    queryKey: [APEXES_KEY],
    cacheTable: "apexes",
    cacheKey: "apexes-list",
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes");
      if (error) throw new Error(extractErrorMessage(error));
      return normalizeArray<ApexResponse>(data);
    },
    retry: false,
  });

export const useMinistryApexes = (federationId?: string, enabled = true) =>
  useOfflineQuery({
    queryKey: [APEXES_KEY, "ministry", federationId],
    cacheTable: "apexes",
    cacheKey: `apexes-ministry-${federationId ?? "all"}`,
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/apexes", {
        params: {
          query: federationId ? { federation_id: federationId } : undefined,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return normalizeArray<ApexResponse>(data);
    },
    retry: false,
  });

export const useApex = (id: string, tokenOverride?: string) =>
  useOfflineQuery({
    queryKey: [APEXES_KEY, id],
    cacheTable: "apexes",
    cacheKey: `apex-${id}`,
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
        headers: headers as Record<string, string>,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as ApexResponse;
    },
    enabled: !!id,
  });

export const useCreateApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      return runMutation<ApexResponse>("/api/v1/federation/apexes", "POST", {
        body,
        optimisticData: body as unknown as ApexResponse,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/federation/apexes", { body });
          if (error) throw new Error(extractErrorMessage(error));
          return data as unknown as ApexResponse;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
    },
  });
};

export const useUpdateApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; description?: string }) => {
      return runMutation<ApexResponse>("/api/v1/federation/apexes/{id}", "PATCH", {
        pathParams: { id },
        body,
        optimisticData: body as unknown as ApexResponse,
        online: async () => {
          const { data, error } = await apiClient.PATCH("/api/v1/federation/apexes/{id}", {
            params: { path: { id } },
            body,
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as unknown as ApexResponse;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.id] });
    },
  });
};

/** Delete an apex (requires verification token) */
export const useDeleteApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, verificationToken }: { id: string; verificationToken: string }) => {
      return runMutation<void>("/api/v1/federation/apexes/{id}", "DELETE", {
        pathParams: { id },
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/federation/apexes/{id}", {
            params: {
              path: { id },
              header: { "x-verification-token": verificationToken } as never,
            },
          });
          if (error) throw new Error(extractErrorMessage(error));
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
    },
  });
};

/** Get cascade delete preview for an apex */
export const useApexDeletePreview = (id: string) =>
  useOfflineQuery({
    queryKey: [APEXES_KEY, id, "delete-preview"],
    cacheTable: "apexes",
    cacheKey: `apex-${id}-delete-preview`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}/delete-preview", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    enabled: !!id,
  });

// ─── Apex Members ─────────────────────────────────────────────────────────────

export const useApexMembers = (apexId: string) =>
  useOfflineQuery({
    queryKey: [APEXES_KEY, apexId, "members"],
    cacheTable: "apexes",
    cacheKey: `apex-${apexId}-members`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}/members", {
        params: { path: { id: apexId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return normalizeArray<MemberResponse>(data);
    },
    enabled: !!apexId,
  });

export const useAddApexMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apexId,
      ...body
    }: {
      apexId: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      assigned_dimensions?: string[];
    }) => {
      return runMutation<MemberResponse>("/api/v1/federation/apexes/{id}/members", "POST", {
        pathParams: { id: apexId },
        body,
        optimisticData: body as unknown as MemberResponse,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/federation/apexes/{id}/members", {
            params: { path: { id: apexId } },
            body,
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as unknown as MemberResponse;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

export const useUpdateApexMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apexId,
      userId,
      first_name,
      last_name,
    }: {
      apexId: string;
      userId: string;
      first_name?: string;
      last_name?: string;
    }) => {
      return runMutation<MemberResponse>(
        "/api/v1/federation/apexes/{group_id}/members/{user_id}",
        "PATCH",
        {
          pathParams: { group_id: apexId, user_id: userId },
          body: { first_name, last_name },
          optimisticData: { first_name, last_name } as unknown as MemberResponse,
          online: async () => {
            const { data, error } = await apiClient.PATCH(
              "/api/v1/federation/apexes/{group_id}/members/{user_id}",
              {
                params: { path: { group_id: apexId, user_id: userId } },
                body: { first_name, last_name } as never,
              },
            );
            if (error) throw new Error(extractErrorMessage(error));
            return data as unknown as MemberResponse;
          },
        },
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

export const useRemoveApexMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ apexId, userId }: { apexId: string; userId: string }) => {
      return runMutation<void>("/api/v1/federation/apexes/{group_id}/members/{user_id}", "DELETE", {
        pathParams: { group_id: apexId, user_id: userId },
        online: async () => {
          const { error } = await apiClient.DELETE(
            "/api/v1/federation/apexes/{group_id}/members/{user_id}",
            {
              params: { path: { group_id: apexId, user_id: userId } },
            },
          );
          if (error) throw new Error(extractErrorMessage(error));
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

export const useResendVerification = () =>
  useMutation({
    mutationFn: async ({ apexId, userId }: { apexId: string; userId: string }) => {
      return runMutation<void>(
        "/api/v1/federation/apexes/{group_id}/members/{user_id}/resend-verification",
        "POST",
        {
          pathParams: { group_id: apexId, user_id: userId },
          online: async () => {
            const { error } = await apiClient.POST(
              "/api/v1/federation/apexes/{group_id}/members/{user_id}/resend-verification",
              {
                params: { path: { group_id: apexId, user_id: userId } },
              },
            );
            if (error) throw new Error(extractErrorMessage(error));
          },
        },
      );
    },
  });
