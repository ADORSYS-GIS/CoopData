/**
 * React Query hooks for user-related API endpoints.
 *
 * Ministry, federation, and apex roles can access user endpoints.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";

const USERS_KEY = "users";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

/** List all users (paginated) */
export const useUsers = () =>
  useOfflineQuery({
    queryKey: [USERS_KEY],
    cacheTable: "users",
    cacheKey: "users-list",
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users");
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
  });

/** Get a single user by ID */
export const useUser = (id: string) =>
  useOfflineQuery({
    queryKey: [USERS_KEY, id],
    cacheTable: "users",
    cacheKey: `user-${id}`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    enabled: !!id,
  });

/** Create a new user */
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      email: string;
      full_name?: string;
      role: string;
      organization_id?: string;
      group_id?: string;
      region?: string;
    }) => {
      return runMutation<unknown>("/api/v1/users", "POST", {
        body,
        optimisticData: body,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/users", {
            body: body as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
};

/** Update a user */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      full_name?: string;
      role?: string;
      organization_id?: string;
      region?: string;
      is_active?: boolean;
    }) => {
      return runMutation<unknown>("/api/v1/users/{id}", "PATCH", {
        pathParams: { id },
        body,
        optimisticData: body,
        online: async () => {
          const { data, error } = await apiClient.PATCH("/api/v1/users/{id}", {
            params: { path: { id } },
            body: body as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, variables.id] });
    },
  });
};

/** Delete a user */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return runMutation<void>("/api/v1/users/{id}", "DELETE", {
        pathParams: { id },
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/users/{id}", {
            params: { path: { id } },
          });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
};

/** Assign a role to a user */
export const useAssignRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return runMutation<unknown>("/api/v1/users/{id}/assign-role", "POST", {
        pathParams: { id },
        body: { role },
        optimisticData: { role },
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/users/{id}/assign-role", {
            params: { path: { id } },
            body: { role } as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, variables.id] });
    },
  });
};
