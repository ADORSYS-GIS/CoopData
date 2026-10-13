import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
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
import { keepRestoringSession } from "@/services/shared/sessionRestore";
import {
  flushSyncQueue,
  getFailedItems,
  getPendingCount,
} from "@/services/shared/syncQueueService";
import { isAppOffline } from "@/services/shared/networkGuard";
import { useSessionDeadline } from "@/hooks/shared/useSessionDeadline";
import { LogoutConfirmDialog, type LogoutPrompt } from "@/components/shared/LogoutConfirmDialog";
import { apiClient } from "@/openapi-client";
import { mergeServerNames, type ServerProfileNames } from "@/services/shared/profileNames";
import { seedOfflineCache } from "@/services/shared/offlineSeeder";
import { offlineDb } from "@/services/shared/offlineDb";
import type { AuthContextValue, UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { ROLE_NAV, ROLE_NAV_ITEMS, type NavGroupId } from "@/constants/roles";

const AuthContext = createContext<AuthContextValue | null>(null);

/** Changes still on this device; 0 if storage can't be read (never blocks logout). */
async function countUnsentChanges(): Promise<number> {
  try {
    return (await getPendingCount()) + (await getFailedItems()).length;
  } catch {
    return 0;
  }
}

/** Tables that survive logout: queued changes and per-user drafts. */
const KEPT_ON_LOGOUT = new Set(["syncQueue", "drafts"]);

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isOfflineAuthenticated, setIsOfflineAuthenticated] = useState(false);
  const [logoutPrompt, setLogoutPrompt] = useState<LogoutPrompt | null>(null);
  const { t } = useTranslation();

  // Ref to store logout function for use in inactivity timeout
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  // Track online/offline status and flush sync queue / trigger seeder when back online
  useEffect(() => {
    let cancelRestore: (() => void) | undefined;

    const goOnline = () => {
      setIsOffline(false);
      void seedOfflineCache();
    };

    const handleOnline = () => {
      if (!isOfflineModeActive()) {
        goOnline();
        return;
      }
      // Started offline: finish the skipped Keycloak start-up before anything
      // talks to the server, otherwise the outbox stays blocked until a reload.
      // Keycloak is often unreachable for a moment after the network returns,
      // so this retries until it answers.
      cancelRestore?.();
      cancelRestore = keepRestoringSession((result) => {
        if (result === "restored") {
          setIsOfflineAuthenticated(false);
          void getAccessToken().then(setAccessToken);
          window.dispatchEvent(new CustomEvent("coopdata-session-restored"));
          void flushSyncQueue();
          goOnline();
        } else if (result === "ended") {
          // Keycloak no longer accepts the saved login: sign in again (work is kept).
          void logoutRef.current();
        } else {
          toast.info(t("offline.reconnectNeedsReload"), {
            duration: Infinity,
            action: { label: t("offline.reload"), onClick: () => window.location.reload() },
          });
        }
      });
    };
    const handleOffline = () => {
      cancelRestore?.();
      setIsOffline(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelRestore?.();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [t]);

  // T3: Inactivity timeout — logout after 10 minutes of no user activity
  // Uses requestAnimationFrame debouncing for performance (Option B)
  useEffect(() => {
    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    let timeoutId: ReturnType<typeof setTimeout>;
    let rafId: number | null = null;
    let lastActivity = Date.now();

    // The actual timer that logs out after 10 min of no activity
    // Guard: Only run for authenticated users to avoid clearing offline data for anonymous visitors
    const checkInactivity = () => {
      if (!isAuthenticated) return;
      const idleTime = Date.now() - lastActivity;
      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        console.log("[auth-context] Inactivity timeout — logging out");
        logoutRef.current();
      }
    };

    // Reset the timer and update last activity time
    const resetTimer = () => {
      clearTimeout(timeoutId);
      lastActivity = Date.now();
      timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
    };

    // Debounced activity handler using requestAnimationFrame
    // This batches rapid events (mouse moves, scrolls) into single resets
    const handleActivity = () => {
      if (rafId) return; // Already scheduled for next frame
      rafId = requestAnimationFrame(() => {
        rafId = null;
        resetTimer();
      });
    };

    // Track these user activities
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    // Add listeners with passive: true for better scroll performance
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    // Start the timer immediately
    resetTimer();

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [isAuthenticated]); // Include isAuthenticated since we guard on it

  const refreshNamesFromServer = async (profile: UserProfile) => {
    try {
      const { data } = await apiClient.GET("/api/v1/me");
      if (!data) return;
      const merged = mergeServerNames(profile, data as ServerProfileNames);
      setUser(merged);
      localStorage.setItem("coopdata_user_profile", JSON.stringify(merged));
    } catch (e) {
      console.warn("[auth-context] Could not refresh organization names:", e);
    }
  };

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
            if (profile && navigator.onLine && !isOfflineModeActive()) {
              void refreshNamesFromServer(profile);
            }
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

  const performLogout = useCallback(async () => {
    console.log("[auth-context] logout() called — redirecting");
    try {
      // Cached copies are cleared, but the outbox and the user's drafts are kept:
      // an automatic idle logout must not lose work. Both are tied to this user and
      // resume when they sign in again.
      await Promise.all(
        offlineDb.tables.filter((t) => !KEPT_ON_LOGOUT.has(t.name)).map((t) => t.clear()),
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

  /** User-initiated logout: asks first if it would lock them out offline or leave changes unsent. */
  const logout = useCallback(async () => {
    const offline = isAppOffline();
    if (!offline) await flushSyncQueue().catch(() => undefined);
    const unsentCount = await countUnsentChanges();
    if (offline || unsentCount > 0) {
      setLogoutPrompt({ offline, unsentCount });
      return;
    }
    await performLogout();
  }, [performLogout]);

  // The idle timeout logs out without asking: nobody is there to answer.
  useEffect(() => {
    logoutRef.current = performLogout;
  }, [performLogout]);

  // Keycloak ends the saved login at a fixed deadline. Offline nobody else
  // enforces it, so the app logs out itself (drafts and the outbox are kept).
  useSessionDeadline(
    useCallback(() => {
      console.log("[auth-context] Saved login reached its deadline — logging out");
      void logoutRef.current();
    }, []),
  );

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

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LogoutConfirmDialog
        prompt={logoutPrompt}
        onStay={() => setLogoutPrompt(null)}
        onLogout={() => {
          setLogoutPrompt(null);
          void performLogout();
        }}
      />
    </AuthContext.Provider>
  );
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
