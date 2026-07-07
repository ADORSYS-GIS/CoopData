import { useState, useCallback } from "react";
import { apiClient } from "@/openapi-client";

export interface VerifyIdentityResult {
  ok: boolean;
  verification_token?: string;
  requires_otp?: boolean;
  message?: string;
}

export interface UseVerifyIdentityReturn {
  isPending: boolean;
  verifyIdentity: (args: { password: string; otp?: string }) => Promise<VerifyIdentityResult>;
}

export const useVerifyIdentity = (): UseVerifyIdentityReturn => {
  const [isPending, setIsPending] = useState(false);

  const verifyIdentity = useCallback(async (args: { password: string; otp?: string }) => {
    setIsPending(true);
    try {
      const { data, error, response } = await apiClient.POST("/api/v1/me/verify-identity", {
        body: args,
      });

      if (error) {
        const errBody = error as { message?: string; error?: string };
        return {
          ok: false,
          message: errBody.message ?? errBody.error ?? `Error ${response.status}`,
        };
      }

      const body = data as { verification_token?: string; requires_otp?: boolean };

      if (body.requires_otp && !body.verification_token) {
        return { ok: false, requires_otp: true };
      }

      return {
        ok: true,
        verification_token: body.verification_token,
        requires_otp: body.requires_otp,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Unexpected error.",
      };
    } finally {
      setIsPending(false);
    }
  }, []);

  return { isPending, verifyIdentity };
};
