import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import {
  initKeycloak,
  login as keycloakLogin,
  logout as keycloakLogout,
  getAccessToken,
  getUserProfile,
} from "@/services/shared/authService";
import type { AuthContextValue, UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { ROLE_NAV, ROLE_NAV_ITEMS, type NavGroupId } from "@/constants/roles";

const AuthContext = createContext<AuthContextValue | null>(null);

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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

          // Welcome toast — fires once per session on first load
          if (profile) {
            const ctx =
              profile.role === "ministry"
                ? "National"
                : profile.role === "federation"
                  ? (profile.organizationName ?? profile.region ?? "your federation")
                  : (profile.cooperationName ?? profile.region ?? "your organization");

            // Delay slightly so the Toaster has time to mount
            setTimeout(() => {
              toast.success(`Welcome back, ${profile.firstName || profile.name}!`, {
                description: `Signed in to ${ctx}`,
                duration: 5000,
              });
            }, 800);
          }
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
