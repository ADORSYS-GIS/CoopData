import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const CONSENT_STATUS_KEY = "consent-status";
const MY_CONSENTS_KEY = "my-consents";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"];
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

export interface UserConsent {
  id: string;
  user_id: string;
  document_type: string;
  document_version: string;
  accepted_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface ConsentStatusResponse {
  terms_accepted: boolean;
  terms_version: string;
  privacy_accepted: boolean;
  privacy_version: string;
  has_accepted_all_required: boolean;
  accepted_consents: UserConsent[];
}

export interface PrivacyRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  details?: string | null;
  created_at: string;
  updated_at: string;
}

export const useConsentStatus = () =>
  useQuery({
    queryKey: [CONSENT_STATUS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/consents/status", {});
      if (error) throw new Error(extractErrorMessage(error));
      return data as ConsentStatusResponse;
    },
    staleTime: 1000 * 60 * 5,
  });

export const useMyConsents = () =>
  useQuery({
    queryKey: [MY_CONSENTS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/consents/me", {});
      if (error) throw new Error(extractErrorMessage(error));
      return data as UserConsent[];
    },
  });

export const useRecordConsent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      document_type,
      document_version,
    }: {
      document_type: string;
      document_version: string;
    }): Promise<UserConsent> => {
      const { data, error } = await apiClient.POST("/api/v1/consents", {
        body: { document_type, document_version },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as UserConsent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENT_STATUS_KEY] });
      queryClient.invalidateQueries({ queryKey: [MY_CONSENTS_KEY] });
    },
  });
};

export const useSubmitPrivacyRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request_type,
      details,
    }: {
      request_type: "EXPORT_DATA" | "CORRECT_DATA" | "DELETE_ACCOUNT";
      details?: string;
    }): Promise<PrivacyRequest> => {
      const { data, error } = await apiClient.POST("/api/v1/privacy/requests", {
        body: { request_type, details },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as PrivacyRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENT_STATUS_KEY] });
      queryClient.invalidateQueries({ queryKey: [MY_PRIVACY_REQUESTS_KEY] });
    },
  });
};

const MY_PRIVACY_REQUESTS_KEY = "my-privacy-requests";

export const useMyPrivacyRequests = () =>
  useQuery({
    queryKey: [MY_PRIVACY_REQUESTS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/privacy/requests/me", {});
      if (error) throw new Error(extractErrorMessage(error));
      return data as PrivacyRequest[];
    },
  });

const ALL_PRIVACY_REQUESTS_KEY = "all-privacy-requests";

export const useAllPrivacyRequests = () =>
  useQuery({
    queryKey: [ALL_PRIVACY_REQUESTS_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/privacy/requests", {});
      if (error) throw new Error(extractErrorMessage(error));
      return data as PrivacyRequest[];
    },
  });

export const useUpdatePrivacyRequestStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request_id,
      status,
    }: {
      request_id: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
    }): Promise<PrivacyRequest> => {
      const { data, error } = await apiClient.PUT("/api/v1/privacy/requests/{request_id}", {
        params: { path: { request_id } },
        body: { status },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as PrivacyRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALL_PRIVACY_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [MY_PRIVACY_REQUESTS_KEY] });
    },
  });
};
