import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";
import { useEffect } from "react";

function AuthLoginHandler() {
  const { isAuthenticated, isLoading, user, login } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      console.log("[auth-login] Already authenticated as", user.role, "→ redirecting to", ROLE_DEFAULT_ROUTE[user.role]);
      window.location.href = ROLE_DEFAULT_ROUTE[user.role];
      return;
    }

    console.log("[auth-login] Not authenticated, redirecting to Keycloak login page");
    login();
  }, [isAuthenticated, isLoading, user, login]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-accent" />
        <p className="text-sm text-muted-foreground">Redirecting to login…</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/login")({
  component: AuthLoginHandler,
});