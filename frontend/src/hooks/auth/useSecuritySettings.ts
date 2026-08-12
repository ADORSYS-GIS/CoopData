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
export type MfaSetup = components["schemas"]["MfaSetupResponse"];

export const useSecuritySettings = () =>
  useQuery({
    queryKey: [SECURITY_KEY],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/me/security");
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
  });

/** Generate a fresh TOTP secret + otpauth URI for the setup dialog. */
export const useMfaSetup = () =>
  useMutation({
    mutationFn: async (): Promise<MfaSetup> => {
      const { data, error } = await apiClient.POST("/api/v1/me/security/mfa/setup");
      if (error) throw new Error(extractErrorMessage(error));
      return data as MfaSetup;
    },
  });

/** Verify the 6-digit code and register the OTP credential in Keycloak. */
export const useMfaVerify = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ secret, code }: { secret: string; code: string }) => {
      const body: components["schemas"]["MfaVerifyRequest"] = { secret, code };
      const { data, error } = await apiClient.POST("/api/v1/me/security/mfa/verify", { body });
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([SECURITY_KEY], data);
    },
  });
};

/** Disable MFA (deletes the OTP credential immediately). */
export const useDisableMfa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SecuritySettings> => {
      const { data, error } = await apiClient.DELETE("/api/v1/me/security/mfa");
      if (error) throw new Error(extractErrorMessage(error));
      return data as SecuritySettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([SECURITY_KEY], data);
    },
  });
};
