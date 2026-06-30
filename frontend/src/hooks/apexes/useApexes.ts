/**
 * React Query hooks for apex-related API endpoints.
 *
 * Federation role required for apex endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const APEXES_KEY = "apexes";

/** List all apexes (federation only) */
export const useApexes = () =>
  useQuery({
    queryKey: [APEXES_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/federation/apexes");
      if (error) throw error;
      return data;
    },
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
    mutationFn: async (body: { name: string; organization_id?: string; region?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/federation/apexes", {
        body: body as never,
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
    mutationFn: async ({ id, ...body }: { id: string; name?: string; region?: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/federation/apexes/{id}", {
        params: { path: { id } },
        body: body as never,
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
    mutationFn: async ({ apexId, ...body }: { apexId: string; user_id: string; role?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/federation/apexes/{id}/members", {
        params: { path: { id: apexId } },
        body: body as never,
      });
      if (error) throw error;
      return data;
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
