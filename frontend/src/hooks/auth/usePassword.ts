import { useState, useCallback } from "react";
import { getAccessToken } from "@/services/shared/authService";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface PasswordChangeResult {
  ok: boolean;
  message: string;
}

export interface UseChangePasswordReturn {
  isPending: boolean;
  changePassword: (args: {
    current_password: string;
    new_password: string;
  }) => Promise<PasswordChangeResult>;
}

export const useChangePassword = (): UseChangePasswordReturn => {
  const [isPending, setIsPending] = useState(false);

  const changePassword = useCallback(
    async (args: { current_password: string; new_password: string }) => {
      setIsPending(true);
      try {
        let token: string;
        try {
          token = await getAccessToken();
        } catch {
          return { ok: false, message: "Not authenticated. Please log in again." };
        }

        const res = await fetch(`${API_BASE}/api/v1/me/password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...args, logout_sessions: false }),
        });

        const json = await res.json().catch(() => ({}));
        const body = json as { message?: string; error?: string };

        if (!res.ok) {
          return {
            ok: false,
            message: body.message ?? body.error ?? `Error ${res.status}`,
          };
        }

        return { ok: true, message: body.message ?? "Password updated successfully!" };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Unexpected error.",
        };
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { isPending, changePassword };
};
