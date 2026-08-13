/**
 * React Query hooks for organization-related API endpoints.
 *
 * Ministry role required for organization CRUD.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";

const ORGANIZATIONS_KEY = "organizations";

/** List all organizations (ministry only, paginated) */
export const useOrganizations = (enabled = true) =>
  useOfflineQuery({
    queryKey: [ORGANIZATIONS_KEY],
    cacheTable: "cooperatives",
    cacheKey: "organizations-list",
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/organizations");
      if (error) throw error;
      return data;
    },
    enabled,
  });

/** Get a single organization by ID */
export const useOrganization = (id: string) =>
  useOfflineQuery({
    queryKey: [ORGANIZATIONS_KEY, id],
    cacheTable: "cooperatives",
    cacheKey: `organization-${id}`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/organizations/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

/** Create a new organization */
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      organization_type?: string;
      registration_number?: string;
      sector?: string;
      region?: string;
      contact_email?: string;
      contact_phone?: string;
      address?: string;
      federation_id?: string;
    }) => {
      return runMutation<unknown>("/api/v1/organizations", "POST", {
        body,
        optimisticData: body,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/organizations", {
            body: body as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORGANIZATIONS_KEY] });
    },
  });
};

/** Update an organization */
export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      organization_type?: string;
      registration_number?: string;
      sector?: string;
      region?: string;
      contact_email?: string;
      contact_phone?: string;
      address?: string;
      federation_id?: string;
      is_active?: boolean;
    }) => {
      return runMutation<unknown>("/api/v1/organizations/{id}", "PATCH", {
        pathParams: { id },
        body,
        optimisticData: body,
        online: async () => {
          const { data, error } = await apiClient.PATCH("/api/v1/organizations/{id}", {
            params: { path: { id } },
            body: body as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ORGANIZATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ORGANIZATIONS_KEY, variables.id] });
    },
  });
};

/** Delete an organization */
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return runMutation<void>("/api/v1/organizations/{id}", "DELETE", {
        pathParams: { id },
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/organizations/{id}", {
            params: { path: { id } },
          });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORGANIZATIONS_KEY] });
    },
  });
};
