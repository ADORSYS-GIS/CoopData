import { useState, useCallback } from "react";
import { getAccessToken } from "@/services/shared/authService";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
      let token: string;
      try {
        token = await getAccessToken();
      } catch {
        return { ok: false, message: "Not authenticated. Please log in again." };
      }

      const res = await fetch(`${API_BASE}/api/v1/me/verify-identity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(args),
      });

      const json = await res.json().catch(() => ({}));
      const body = json as {
        verification_token?: string;
        requires_otp?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          message: body.message ?? body.error ?? `Error ${res.status}`,
        };
      }

      if (body.requires_otp && !body.verification_token) {
        return {
          ok: false,
          requires_otp: true,
        };
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
