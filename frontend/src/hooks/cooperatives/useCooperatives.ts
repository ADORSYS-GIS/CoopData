/**
 * React Query hooks for cooperative-related API endpoints.
 *
 * Apex admin: full CRUD on cooperatives and member management.
 * Cooperative users: read-only profile, members, dimensions via self-service routes.
 *
 * All API calls go through apiClient (openapi-fetch) which has the auth interceptor
 * injecting the Bearer token automatically. Never use raw fetch here.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";
import { getAccessToken } from "@/services/shared/authService";

const COOPERATIVES_KEY = "cooperatives";
const COOPERATIVE_SELF_KEY = "cooperative-self";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type CooperativeResponse = components["schemas"]["CooperativeResponse"];
type MemberResponse = components["schemas"]["MemberResponse"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a human-readable error message from an unknown thrown value. */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

// ─── Apex admin: Cooperative CRUD ────────────────────────────────────────────

export const useCooperatives = () =>
  useQuery({
    queryKey: [COOPERATIVES_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as unknown as CooperativeResponse[]) ?? [];
    },
    retry: false,
  });

export const useCooperative = (id: string) =>
  useQuery({
    queryKey: [COOPERATIVES_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as CooperativeResponse;
    },
    enabled: !!id,
  });

export const useCreateCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/cooperatives", {
        body: body as never,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as CooperativeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
    },
  });
};

export const useUpdateCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; description?: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
        body: body as never,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as CooperativeResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY, variables.id] });
    },
  });
};

export const useDeleteCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
    },
  });
};

// ─── Apex admin: Member management ──────────────────────────────────────────

export const useCooperativeMembers = (cooperativeId: string) =>
  useQuery({
    queryKey: [COOPERATIVES_KEY, cooperativeId, "members"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives/{id}/members", {
        params: { path: { id: cooperativeId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as unknown as MemberResponse[]) ?? [];
    },
    enabled: !!cooperativeId,
  });

export const useAddCooperativeMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cooperativeId,
      ...body
    }: {
      cooperativeId: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      assigned_dimensions?: string[];
    }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/cooperatives/{id}/members", {
        params: { path: { id: cooperativeId } },
        body: body as never,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as MemberResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COOPERATIVES_KEY, variables.cooperativeId, "members"],
      });
    },
  });
};

export const useUpdateCooperativeMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cooperativeId,
      userId,
      first_name,
      last_name,
    }: {
      cooperativeId: string;
      userId: string;
      first_name?: string;
      last_name?: string;
    }) => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/apex/cooperatives/{group_id}/members/{user_id}",
        {
          params: { path: { group_id: cooperativeId, user_id: userId } },
          body: { first_name, last_name } as never,
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as MemberResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COOPERATIVES_KEY, variables.cooperativeId, "members"],
      });
    },
  });
};

export const useRemoveCooperativeMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cooperativeId, userId }: { cooperativeId: string; userId: string }) => {
      const { error } = await apiClient.DELETE(
        "/api/v1/apex/cooperatives/{group_id}/members/{user_id}",
        {
          params: { path: { group_id: cooperativeId, user_id: userId } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COOPERATIVES_KEY, variables.cooperativeId, "members"],
      });
    },
  });
};

export const useResendCooperativeMemberVerification = () =>
  useMutation({
    mutationFn: async ({ cooperativeId, userId }: { cooperativeId: string; userId: string }) => {
      const { error } = await apiClient.POST(
        "/api/v1/apex/cooperatives/{group_id}/members/{user_id}/resend-verification",
        {
          params: { path: { group_id: cooperativeId, user_id: userId } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
    },
  });

// ─── Cooperative self-service (cooperative role, read-only) ──────────────────
// These use raw fetch because they are not (yet) in the generated OpenAPI spec.
// They go through getAccessToken() which reads the Keycloak token the same way
// the apiClient interceptor does.

export const useMyCooperativeProfile = () =>
  useQuery({
    queryKey: [COOPERATIVE_SELF_KEY, "profile"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as CooperativeResponse;
    },
  });

export const useMyCooperativeMembers = () =>
  useQuery({
    queryKey: [COOPERATIVE_SELF_KEY, "members"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as MemberResponse[];
    },
  });

export const useMyAssignedDimensions = () =>
  useQuery({
    queryKey: [COOPERATIVE_SELF_KEY, "dimensions"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/dimensions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as { cooperative_id?: string; assigned_dimensions: string[]; user_id: string };
    },
  });
