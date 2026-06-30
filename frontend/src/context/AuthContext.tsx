import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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
        const authenticated = await initKeycloak();
        if (!mounted) return;

        setIsAuthenticated(authenticated);

        if (authenticated) {
          const profile = getUserProfile();
          setUser(profile);
          try {
            const token = await getAccessToken();
            setAccessToken(token);
          } catch {
            // Token unavailable — will retry on next API call
          }
        }
      } catch (error) {
        console.error("Keycloak initialization failed:", error);
        if (mounted) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async () => {
    await keycloakLogin();
  }, []);

  const logout = useCallback(async () => {
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
    role: user?.role ?? "ministry",
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

export function useCanAccess(path: string): boolean {
  const { user } = useAuth();
  if (!user) return false;

  const groups = ROLE_NAV[user.role];
  for (const groupId of groups) {
    const items = ROLE_NAV_ITEMS[user.role][groupId];
    if (items?.includes(path)) return true;
  }
  return false;
}
