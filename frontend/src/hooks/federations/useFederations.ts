/**
 * React Query hooks for federation-related API endpoints.
 *
 * All API calls go through the openapi-fetch client with auth interceptor.
 * Ministry role required for all federation endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const FEDERATIONS_KEY = "federations";

/** List all federations (ministry only) */
export const useFederations = () =>
  useQuery({
    queryKey: [FEDERATIONS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations");
      if (error) throw error;
      return data;
    },
  });

/** Get a single federation by ID */
export const useFederation = (id: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

/** Create a new federation */
export const useCreateFederation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; domain: string; contact_email?: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/ministry/federations", {
        body: {
          name: body.name,
          domains: [{ name: body.domain }],
          contact_email: body.contact_email,
        } as never,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
    },
  });
};

/** Update a federation */
export const useUpdateFederation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      domain,
      contact_email,
      description,
    }: {
      id: string;
      name?: string;
      domain?: string;
      contact_email?: string;
      description?: string;
    }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/ministry/federations/{id}", {
        params: { path: { id } },
        body: {
          name,
          description,
          contact_email,
          // Only send domains array when the user has provided a domain
          ...(domain ? { domains: [{ name: domain }] } : {}),
        } as never,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY, variables.id] });
    },
  });
};

/** Delete a federation */
export const useDeleteFederation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/ministry/federations/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
    },
  });
};

/** List members of a federation */
export const useFederationMembers = (federationId: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "members"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}/members", {
        params: { path: { id: federationId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!federationId,
  });

/** List invitations for a federation */
export const useFederationInvitations = (federationId: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "invitations"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}/invitations", {
        params: { path: { id: federationId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!federationId,
  });

/** Invite a user to a federation */
export const useInviteUserToFederation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      federationId,
      ...body
    }: {
      federationId: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      redirect_url?: string;
    }) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/ministry/federations/{id}/invitations",
        {
          params: { path: { id: federationId } },
          body: body as never,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "invitations"],
      });
    },
  });
};

/** Resend an invitation */
export const useResendInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      federationId,
      invitationId,
    }: {
      federationId: string;
      invitationId: string;
    }) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend",
        {
          params: { path: { id: federationId, invitation_id: invitationId } },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "invitations"],
      });
    },
  });
};

/** Remove a member from a federation */
export const useRemoveFederationMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ federationId, userId }: { federationId: string; userId: string }) => {
      const { error } = await apiClient.DELETE(
        "/api/v1/ministry/federations/{id}/members/{user_id}",
        {
          params: { path: { id: federationId, user_id: userId } },
        },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "members"],
      });
    },
  });
};

/** Delete an invitation */
export const useDeleteInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      federationId,
      invitationId,
    }: {
      federationId: string;
      invitationId: string;
    }) => {
      const { error } = await apiClient.DELETE(
        "/api/v1/ministry/federations/{id}/invitations/{invitation_id}",
        {
          params: { path: { id: federationId, invitation_id: invitationId } },
        },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "invitations"],
      });
    },
  });
};
