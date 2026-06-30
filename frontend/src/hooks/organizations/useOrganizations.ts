/**
 * React Query hooks for organization-related API endpoints.
 *
 * Ministry role required for organization CRUD.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const ORGANIZATIONS_KEY = "organizations";

/** List all organizations (ministry only, paginated) */
export const useOrganizations = () =>
  useQuery({
    queryKey: [ORGANIZATIONS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/organizations");
      if (error) throw error;
      return data;
    },
  });

/** Get a single organization by ID */
export const useOrganization = (id: string) =>
  useQuery({
    queryKey: [ORGANIZATIONS_KEY, id],
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
      const { data, error } = await apiClient.POST("/api/v1/organizations", {
        body: body as any,
      });
      if (error) throw error;
      return data;
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
    mutationFn: async ({ id, ...body }: {
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
      const { data, error } = await apiClient.PATCH("/api/v1/organizations/{id}", {
        params: { path: { id } },
        body: body as any,
      });
      if (error) throw error;
      return data;
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
      const { error } = await apiClient.DELETE("/api/v1/organizations/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORGANIZATIONS_KEY] });
    },
  });
};