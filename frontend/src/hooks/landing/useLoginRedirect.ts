import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";
import { useAuth } from "@/context/AuthContext";
import { isOfflineModeActive } from "@/services/shared/authService";

export const useLoginRedirect = () => {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  return useCallback(async () => {
    if (isLoading) return;
    if (isAuthenticated && user) {
      navigate({ to: ROLE_DEFAULT_ROUTE[user.role] ?? "/app/dashboard" });
      return;
    }
    // Keycloak is unreachable offline, so go straight to the cached dashboard.
    if (!navigator.onLine || isOfflineModeActive()) {
      window.location.href = "/app/dashboard";
      return;
    }
    await login();
  }, [login, isAuthenticated, isLoading, user, navigate]);
};
