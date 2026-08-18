import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  initKeycloak,
  login as keycloakLogin,
  logout as keycloakLogout,
  getAccessToken,
  getUserProfile,
  isOfflineModeActive,
} from "@/services/shared/authService";
import { seedOfflineCache } from "@/services/shared/offlineSeeder";
import { offlineDb } from "@/services/shared/offlineDb";
import type { AuthContextValue, UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { ROLE_NAV, ROLE_NAV_ITEMS, type NavGroupId } from "@/constants/roles";

const AuthContext = createContext<AuthContextValue | null>(null);

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isOfflineAuthenticated, setIsOfflineAuthenticated] = useState(false);
  const { t } = useTranslation();

  // Track online/offline status and flush sync queue / trigger seeder when back online
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void seedOfflineCache();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log("[auth-context] Starting Keycloak init...");
        const authenticated = await initKeycloak();
        if (!mounted) return;

        console.log("[auth-context] Keycloak init result, authenticated:", authenticated);
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const profile = getUserProfile();
          console.log(
            "[auth-context] User profile:",
            profile ? { email: profile.email, role: profile.role } : null,
          );
          setUser(profile);
          try {
            const token = await getAccessToken();
            setAccessToken(token);
          } catch (e) {
            console.warn("[auth-context] Failed to get access token:", e);
          }

          // Pre-cache all application data into IndexedDB in the background when online
          if (navigator.onLine && !isOfflineModeActive()) {
            void seedOfflineCache();
          }

          // Welcome toast — fires once per session on first load
          if (profile) {
            const ctx =
              profile.role === "ministry"
                ? t("auth.welcomeContextNational")
                : profile.role === "federation"
                  ? (profile.organizationName ??
                    profile.region ??
                    t("auth.welcomeContextFederation"))
                  : (profile.cooperationName ??
                    profile.region ??
                    t("auth.welcomeContextOrganization"));

            // Delay slightly so the Toaster has time to mount
            setTimeout(() => {
              toast.success(t("auth.welcomeBack", { name: profile.firstName || profile.name }), {
                description: t("auth.signedInTo", { ctx }),
                duration: 5000,
              });
            }, 800);
          }
        }
        // Record whether this was an offline-token recovery
        const offlineActive = isOfflineModeActive();
        setIsOfflineAuthenticated(offlineActive);
        if (offlineActive) {
          setIsOffline(true);
        }
      } catch (error) {
        console.error("[auth-context] Keycloak initialization failed:", error);
        if (mounted) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          console.log("[auth-context] Loading complete");
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async () => {
    console.log("[auth-context] login() called");
    await keycloakLogin();
  }, []);

  const logout = useCallback(async () => {
    console.log("[auth-context] logout() called — redirecting");
    try {
      await Promise.all(
        offlineDb.tables
          .filter((t) => t.name !== "syncQueue")
          .map((t) => t.clear())
      );
      console.log("[auth-context] Offline database cache cleared on logout");
    } catch (e) {
      console.warn("[auth-context] Failed to clear offline database on logout:", e);
    }
    await keycloakLogout();
    setIsAuthenticated(false);
    setUser(null);
    setAccessToken(null);
  }, []);

  const hasRoleFn = useCallback(
    (role: Role) => {
      if (!isAuthenticated || !user) return false;
      return user.role === role;
    },
    [isAuthenticated, user],
  );

  const hasAnyRoleFn = useCallback(
    (roles: Role[]) => {
      if (!isAuthenticated || !user) return false;
      return roles.includes(user.role);
    },
    [isAuthenticated, user],
  );

  const getAccessTokenFn = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    setAccessToken(token);
    return token;
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    role: user?.role ?? null,
    accessToken,
    login,
    logout,
    hasRole: hasRoleFn,
    hasAnyRole: hasAnyRoleFn,
    getAccessToken: getAccessTokenFn,
    isOffline,
    isOfflineAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within a KeycloakAuthProvider");
  }
  return ctx;
}

export function useRole(): Role | null {
  const { user } = useAuth();
  return user?.role ?? null;
}

export function useUserRole(): Role | null {
  const { isLoading, user } = useAuth();
  if (isLoading) return null;
  return user?.role ?? null;
}

export function useCanAccess(path: string): boolean {
  const { user } = useAuth();
  if (!user) return false;

  const navGroups = ROLE_NAV[user.role];
  if (!navGroups) return false;
  for (const groupId of navGroups) {
    const items = ROLE_NAV_ITEMS[user.role]?.[groupId];
    if (items?.includes(path)) return true;
  }
  return false;
}
