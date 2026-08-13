import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function AuthLoginHandler() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      const target = ROLE_DEFAULT_ROUTE[user.role] ?? "/app/dashboard";
      console.log(
        "[auth-login] Already authenticated as",
        user.role,
        "→ redirecting to",
        target,
      );
      window.location.href = target;
      return;
    }

    // Stop infinite redirect loop when offline
    if (!navigator.onLine) {
      console.warn("[auth-login] Offline — waiting for network or manual offline mode entry");
      return;
    }

    console.log("[auth-login] Not authenticated, redirecting to Keycloak login page");
    login();
  }, [isAuthenticated, isLoading, user, login]);

  const handleOfflineContinue = () => {
    const defaultProfile = {
      id: "offline-admin",
      username: "admin@dgrv.coop",
      email: "admin@dgrv.coop",
      firstName: "DGRV",
      lastName: "Administrator",
      name: "DGRV Administrator",
      role: "ministry" as const,
      organizationName: "Ministry of Commerce & Cooperative Development",
    };
    localStorage.setItem("coopdata_offline_user", JSON.stringify(defaultProfile));
    localStorage.setItem("coopdata_offline_authenticated", "true");
    window.location.href = "/app/dashboard";
  };

  if (isOffline && !isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <WifiOff className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">You are currently offline</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Keycloak identity server cannot be reached while disconnected from the network.
          You can continue using stored IndexedDB data in Offline Mode.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button onClick={handleOfflineContinue} size="lg" className="gap-2">
            <ShieldAlert className="size-4" />
            Enter Offline Mode
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" size="lg" className="gap-2">
            <RefreshCw className="size-4" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-accent" />
        <p className="text-sm text-muted-foreground">{t("auth.redirecting")}</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: AuthLoginHandler,
});
