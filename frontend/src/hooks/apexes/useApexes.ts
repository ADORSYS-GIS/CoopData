/**
 * React Query hooks for apex-related API endpoints.
 *
 * Federation role required for all apex CRUD and member management endpoints.
 * All API calls go through apiClient (openapi-fetch) with automatic Bearer token injection.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
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

export const useApexes = () =>
  useQuery({
    queryKey: [APEXES_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes");
      if (error) throw new Error(extractErrorMessage(error));
      return normalizeArray<ApexResponse>(data);
    },
    retry: false,
  });

export const useApex = (id: string) =>
  useQuery({
    queryKey: [APEXES_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
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
      const { data, error } = await apiClient.POST("/api/v1/federation/apexes", { body });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as ApexResponse;
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
      const { data, error } = await apiClient.PATCH("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as ApexResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.id] });
    },
  });
};

export const useDeleteApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
    },
  });
};

// ─── Apex Members ─────────────────────────────────────────────────────────────

export const useApexMembers = (apexId: string) =>
  useQuery({
    queryKey: [APEXES_KEY, apexId, "members"],
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
      const { data, error } = await apiClient.POST("/api/v1/federation/apexes/{id}/members", {
        params: { path: { id: apexId } },
        body,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as MemberResponse;
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

export const useRemoveApexMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ apexId, userId }: { apexId: string; userId: string }) => {
      const { error } = await apiClient.DELETE(
        "/api/v1/federation/apexes/{group_id}/members/{user_id}",
        {
          params: { path: { group_id: apexId, user_id: userId } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

export const useResendVerification = () =>
  useMutation({
    mutationFn: async ({ apexId, userId }: { apexId: string; userId: string }) => {
      const { error } = await apiClient.POST(
        "/api/v1/federation/apexes/{group_id}/members/{user_id}/resend-verification",
        {
          params: { path: { group_id: apexId, user_id: userId } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
    },
  });
