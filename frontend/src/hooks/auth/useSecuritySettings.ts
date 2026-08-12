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

/**
 * Arm the CONFIGURE_TOTP required action on the Keycloak account. The user then
 * completes TOTP setup on Keycloak's (branded) screen via kc_action=CONFIGURE_TOTP.
 */
export const useMfaSetup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SecuritySettings> => {
      const { data, error } = await apiClient.POST("/api/v1/me/security/mfa/setup");
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([SECURITY_KEY], data);
    },
  });
};

/** Disable MFA (deletes the OTP credential immediately). Requires password and OTP for verification. */
export const useDisableMfa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      password,
      otp,
    }: {
      password: string;
      otp: string;
    }): Promise<SecuritySettings> => {
      const { data, error } = await apiClient.DELETE("/api/v1/me/security/mfa", {
        body: { password, otp },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([SECURITY_KEY], data);
    },
  });
};
