/**
 * React Query hooks for cooperative-related API endpoints.
 *
 * Apex role required for cooperative endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const COOPERATIVES_KEY = "cooperatives";

/** List all cooperatives (apex only) */
export const useCooperatives = () =>
  useQuery({
    queryKey: [COOPERATIVES_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives");
      if (error) throw error;
      return data;
    },
  });

/** Get a single cooperative by ID */
export const useCooperative = (id: string) =>
  useQuery({
    queryKey: [COOPERATIVES_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

/** Create a new cooperative */
export const useCreateCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; region?: string; contact_email?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/cooperatives", {
        body: body as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
    },
  });
};

/** Update a cooperative */
export const useUpdateCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; region?: string; contact_email?: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
        body: body as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY, variables.id] });
    },
  });
};

/** Delete a cooperative */
export const useDeleteCooperative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/apex/cooperatives/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY] });
    },
  });
};

/** List members of a cooperative */
export const useCooperativeMembers = (cooperativeId: string) =>
  useQuery({
    queryKey: [COOPERATIVES_KEY, cooperativeId, "members"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives/{id}/members", {
        params: { path: { id: cooperativeId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!cooperativeId,
  });

/** Add a member to a cooperative */
export const useAddCooperativeMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cooperativeId, ...body }: { cooperativeId: string; user_id: string; role?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/cooperatives/{id}/members", {
        params: { path: { id: cooperativeId } },
        body: body as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY, variables.cooperativeId, "members"] });
    },
  });
};

/** Remove a member from a cooperative */
export const useRemoveCooperativeMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cooperativeId, userId }: { cooperativeId: string; userId: string }) => {
      const { error } = await apiClient.DELETE("/api/v1/apex/cooperatives/{group_id}/members/{user_id}", {
        params: { path: { group_id: cooperativeId, user_id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COOPERATIVES_KEY, variables.cooperativeId, "members"] });
    },
  });
};