import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

const SECURITY_KEY = "me-security-settings";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"];
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

export type SecuritySettings = components["schemas"]["SecuritySettingsResponse"];

export const useSecuritySettings = () =>
  useQuery({
    queryKey: [SECURITY_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/me/security");
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
  });

export const useUpdateMfa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const body: components["schemas"]["UpdateMfaRequest"] = { enabled };
      const { data, error } = await apiClient.PUT("/api/v1/me/security/mfa", { body });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([SECURITY_KEY], data);
    },
  });
};
