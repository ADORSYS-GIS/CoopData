/**
 * React Query hooks for federation-related API endpoints.
 *
 * All API calls go through the openapi-fetch client with auth interceptor.
 * Ministry role required for all federation endpoints.
 */

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";

const FEDERATIONS_KEY = "federations";

/** List all federations (ministry only) */
export const useFederations = (enabled = true) =>
  useOfflineQuery({
    queryKey: [FEDERATIONS_KEY],
    cacheTable: "federations",
    cacheKey: "federations-list",
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations");
      if (error) throw error;
      return data;
    },
  });

/** Get a single federation by ID */
export const useFederation = (id: string, tokenOverride?: string) =>
  useOfflineQuery({
    queryKey: [FEDERATIONS_KEY, id],
    cacheTable: "federations",
    cacheKey: `federation-${id}`,
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}", {
        params: { path: { id } },
        headers: headers as Record<string, string>,
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
      const payload = {
        name: body.name,
        domains: [{ name: body.domain }],
        contact_email: body.contact_email,
      };
      return runMutation<unknown>("/api/v1/ministry/federations", "POST", {
        body: payload,
        optimisticData: payload as unknown,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/ministry/federations", {
            body: payload as never,
          });
          if (error) throw error;
          return data;
        },
      });
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
      const payload = {
        name,
        description,
        contact_email,
        // Only send domains array when the user has provided a domain
        ...(domain ? { domains: [{ name: domain }] } : {}),
      };
      return runMutation<unknown>("/api/v1/ministry/federations/{id}", "PATCH", {
        pathParams: { id },
        body: payload,
        optimisticData: payload as unknown,
        online: async () => {
          const { data, error } = await apiClient.PATCH("/api/v1/ministry/federations/{id}", {
            params: { path: { id } },
            body: payload as never,
          });
          if (error) throw error;
          return data;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY, variables.id] });
    },
  });
};

/** Delete a federation (requires verification token) */
export const useDeleteFederation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, verificationToken }: { id: string; verificationToken: string }) => {
      return runMutation<void>("/api/v1/ministry/federations/{id}", "DELETE", {
        pathParams: { id },
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/ministry/federations/{id}", {
            params: {
              path: { id },
              header: { "x-verification-token": verificationToken } as never,
            },
          });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
    },
  });
};

/** Get cascade delete preview for a federation */
export const useFederationDeletePreview = (id: string) =>
  useOfflineQuery({
    queryKey: [FEDERATIONS_KEY, id, "delete-preview"],
    cacheTable: "federations",
    cacheKey: `federation-${id}-delete-preview`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/ministry/federations/{id}/delete-preview",
        {
          params: { path: { id } },
        },
      );
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

/** List members of a federation */
export const useFederationMembers = (federationId: string) =>
  useOfflineQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "members"],
    cacheTable: "federations",
    cacheKey: `federation-${federationId}-members`,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}/members", {
        params: { path: { id: federationId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!federationId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    gcTime: 5 * 60_000,
  });

/** List invitations for a federation */
export const useFederationInvitations = (federationId: string) =>
  useOfflineQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "invitations"],
    cacheTable: "federations",
    cacheKey: `federation-${federationId}-invitations`,
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
      return runMutation<unknown>("/api/v1/ministry/federations/{id}/invitations", "POST", {
        pathParams: { id: federationId },
        body,
        optimisticData: body as unknown,
        online: async () => {
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
      });
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
      return runMutation<unknown>(
        "/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend",
        "POST",
        {
          pathParams: { id: federationId, invitation_id: invitationId },
          optimisticData: undefined,
          online: async () => {
            const { data, error } = await apiClient.POST(
              "/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend",
              {
                params: { path: { id: federationId, invitation_id: invitationId } },
              },
            );
            if (error) throw error;
            return data;
          },
        },
      );
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
      return runMutation<void>("/api/v1/ministry/federations/{id}/members/{user_id}", "DELETE", {
        pathParams: { id: federationId, user_id: userId },
        online: async () => {
          const { error } = await apiClient.DELETE(
            "/api/v1/ministry/federations/{id}/members/{user_id}",
            {
              params: { path: { id: federationId, user_id: userId } },
            },
          );
          if (error) throw error;
        },
      });
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
      return runMutation<void>(
        "/api/v1/ministry/federations/{id}/invitations/{invitation_id}",
        "DELETE",
        {
          pathParams: { id: federationId, invitation_id: invitationId },
          online: async () => {
            const { error } = await apiClient.DELETE(
              "/api/v1/ministry/federations/{id}/invitations/{invitation_id}",
              {
                params: { path: { id: federationId, invitation_id: invitationId } },
              },
            );
            if (error) throw error;
          },
        },
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "invitations"],
      });
    },
  });
};
