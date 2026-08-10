/**
 * React Query hooks for federation-related API endpoints.
 *
 * All API calls go through the openapi-fetch client with auth interceptor.
 * Ministry role required for all federation endpoints.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const FEDERATIONS_KEY = "federations";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

/** List all federations (ministry only) */
export const useFederations = (enabled = true) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations");
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
  });

/** Get a single federation by ID */
export const useFederation = (id: string, tokenOverride?: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, id],
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}", {
        params: { path: { id } },
        headers: headers as Record<string, string>,
      });
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
      return data;
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
      const { error } = await apiClient.DELETE("/api/v1/ministry/federations/{id}", {
        params: {
          path: { id },
          header: { "x-verification-token": verificationToken } as never,
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FEDERATIONS_KEY] });
    },
  });
};

/** Get cascade delete preview for a federation */
export const useFederationDeletePreview = (id: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, id, "delete-preview"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/ministry/federations/{id}/delete-preview",
        {
          params: { path: { id } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    enabled: !!id,
  });

/** List members of a federation */
export const useFederationMembers = (federationId: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "members"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}/members", {
        params: { path: { id: federationId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data;
    },
    enabled: !!federationId,
    // Keep the previous federation's members on screen while the new
    // federation's data is fetching — eliminates the blank flash that
    // makes the page look frozen during a dropdown switch.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

/** List invitations for a federation */
export const useFederationInvitations = (federationId: string) =>
  useQuery({
    queryKey: [FEDERATIONS_KEY, federationId, "invitations"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/federations/{id}/invitations", {
        params: { path: { id: federationId } },
      });
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
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
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FEDERATIONS_KEY, variables.federationId, "invitations"],
      });
    },
  });
};
