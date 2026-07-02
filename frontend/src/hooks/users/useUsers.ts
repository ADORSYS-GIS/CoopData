/**
 * React Query hooks for user-related API endpoints.
 *
 * Ministry, federation, and apex roles can access user endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const USERS_KEY = "users";

/** List all users (paginated) */
export const useUsers = () =>
  useQuery({
    queryKey: [USERS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users");
      if (error) throw error;
      return data;
    },
  });

/** Get a single user by ID */
export const useUser = (id: string) =>
  useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
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
      const { data, error } = await apiClient.POST("/api/v1/users", {
        body: body as never,
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await apiClient.PATCH("/api/v1/users/{id}", {
        params: { path: { id } },
        body: body as never,
      });
      if (error) throw error;
      return data;
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
      const { error } = await apiClient.DELETE("/api/v1/users/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
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
      const { data, error } = await apiClient.POST("/api/v1/users/{id}/assign-role", {
        params: { path: { id } },
        body: { role } as never,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, variables.id] });
    },
  });
};
