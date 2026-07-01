/**
 * React Query hooks for apex-related API endpoints.
 *
 * Federation role required for apex endpoints.
 * Backend DTOs: CreateApexRequest { name, description? },
 *   UpdateApexRequest { name?, description? },
 *   AddMemberRequest { email, first_name, last_name, role, assigned_dimensions? },
 *   ApexResponse { id, name, path?, description?, sub_groups? },
 *   MemberResponse { id, username?, email?, first_name?, last_name? }
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

const APEXES_KEY = "apexes";

type ApexResponse = components["schemas"]["ApexResponse"];
type PaginatedApexesResponse = {
  data?: ApexResponse[] | null;
};

const isPaginatedApexesResponse = (value: unknown): value is PaginatedApexesResponse => {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    return false;
  }

  return Array.isArray((value as { data?: unknown }).data);
};

const normalizeApexesResponse = (value: unknown): ApexResponse[] => {
  if (Array.isArray(value)) {
    return value as ApexResponse[];
  }

  if (isPaginatedApexesResponse(value)) {
    return value.data ?? [];
  }

  return [];
};

/** List all apexes (federation only) */
export const useApexes = () =>
  useQuery({
    queryKey: [APEXES_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes");
      if (error) throw error;
      return normalizeApexesResponse(data);
    },
    retry: false,
  });

/** Get a single apex by ID */
export const useApex = (id: string) =>
  useQuery({
    queryKey: [APEXES_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

/** Create a new apex */
export const useCreateApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/federation/apexes", {
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
    },
  });
};

/** Update an apex */
export const useUpdateApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; description?: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.id] });
    },
  });
};

/** Delete an apex */
export const useDeleteApex = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY] });
    },
  });
};

/** List members of an apex */
export const useApexMembers = (apexId: string) =>
  useQuery({
    queryKey: [APEXES_KEY, apexId, "members"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes/{id}/members", {
        params: { path: { id: apexId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!apexId,
  });

/** Add a member to an apex */
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
      const { error } = await apiClient.POST("/api/v1/federation/apexes/{id}/members", {
        params: { path: { id: apexId } },
        body,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

/** Remove a member from an apex */
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
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};

/** Update a member's name in an apex */
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
      // Use raw fetch — the PATCH endpoint is new and not yet in the generated spec
      const { getAccessToken } = await import("@/services/shared/authService");
      const token = await getAccessToken();
      const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

      const res = await fetch(
        `${API_BASE}/api/v1/federation/apexes/${apexId}/members/${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ first_name, last_name }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = json as { message?: string; error?: string };
        throw new Error(e.message ?? e.error ?? `Failed to update member (${res.status})`);
      }
      return json;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [APEXES_KEY, variables.apexId, "members"] });
    },
  });
};
export const useResendVerification = () =>
  useMutation({
    mutationFn: async ({ apexId, userId }: { apexId: string; userId: string }) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/federation/apexes/{group_id}/members/{user_id}/resend-verification",
        {
          params: { path: { group_id: apexId, user_id: userId } },
        },
      );
      if (error) throw error;
      return data;
    },
  });
