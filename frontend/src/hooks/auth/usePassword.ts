import { useState, useCallback } from "react";
import { apiClient } from "@/openapi-client";

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
        const { data, error, response } = await apiClient.POST("/api/v1/me/password", {
          body: { ...args, logout_sessions: false },
        });

        if (error) {
          const errBody = error as { message?: string; error?: string };
          return {
            ok: false,
            message: errBody.message ?? errBody.error ?? `Error ${response.status}`,
          };
        }

        const body = data as { message?: string };
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
