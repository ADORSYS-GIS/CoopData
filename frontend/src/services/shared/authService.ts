import { get, set, del } from "idb-keyval";
import { keycloak } from "./keycloakConfig";
import type { UserProfile, CustomKeycloakToken } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { mapKeycloakRolesToRole } from "@/constants/roles";

const TOKEN_CACHE_KEY = "coopdata_tokens";
const REFRESH_THRESHOLD_SECONDS = 30;

// ─── Module-level singleton init ─────────────────────────────────────────────
//
// Keycloak's JS adapter cannot be initialized more than once per page load.
// We kick off initialization here at module import time so:
//   1. It runs exactly once, even under React StrictMode (double-effect calls).
//   2. `keycloakReady` is available immediately for `beforeLoad` guards to await.
//   3. `KeycloakAuthProvider` just reads the result — it never calls init itself.
//
let _initPromise: Promise<boolean> | null = null;

function getInitPromise(): Promise<boolean> {
  if (_initPromise) return _initPromise;
  _initPromise = _runInit();
  return _initPromise;
}

async function _runInit(): Promise<boolean> {
  const cachedTokens = await loadCachedTokens();

  try {
    const authenticated = await keycloak.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      enableLogging: import.meta.env.DEV,
      checkLoginIframe: false,
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      token: cachedTokens?.token ?? undefined,
      refreshToken: cachedTokens?.refreshToken ?? undefined,
      idToken: cachedTokens?.idToken ?? undefined,
    });

    if (authenticated) {
      await persistTokens();
      try {
        await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);
        await persistTokens();
      } catch {
        // Token refresh failed — session expired
        await clearCachedTokens();
        return false;
      }
    }

    return authenticated;
  } catch (error) {
    console.error("[authService] Keycloak init failed:", error);

    // Offline fallback: if cached tokens exist, treat as authenticated
    if (cachedTokens?.token) {
      return true;
    }
    return false;
  }
}

/**
 * A promise that resolves to `true` (authenticated) or `false` (not authenticated)
 * once Keycloak has finished initializing. Route guards await this before checking
 * auth state, so they never fire before the auth state is known.
 */
export const keycloakReady: Promise<boolean> = getInitPromise();

/**
 * Initialize Keycloak. Safe to call multiple times — returns the same promise.
 * Components (KeycloakAuthProvider) should call this to get the auth result
 * without triggering a second init.
 */
export async function initKeycloak(): Promise<boolean> {
  return getInitPromise();
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function login(): Promise<void> {
  await keycloak.login({
    redirectUri: window.location.origin + "/app/dashboard",
    scope: "openid profile email",
  });
}

export async function logout(): Promise<void> {
  await clearCachedTokens();
  await keycloak.logout({
    redirectUri: window.location.origin + "/auth/login",
  });
}

export async function getAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new Error("Not authenticated");
  }

  try {
    const refreshed = await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);
    if (refreshed) {
      await persistTokens();
    }
  } catch {
    // Refresh failed — try cached token as fallback
    const cached = await loadCachedTokens();
    if (cached?.token) {
      return cached.token;
    }
    throw new Error("Session expired. Please log in again.");
  }

  return keycloak.token!;
}

// ─── Profile & role helpers ──────────────────────────────────────────────────

export function getUserProfile(): UserProfile | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    console.warn("[getUserProfile] Not authenticated or no token");
    return null;
  }

  const token = keycloak.tokenParsed as CustomKeycloakToken;
  const realmRoles = token.realm_access?.roles ?? [];
  console.log("[getUserProfile] Token realm_roles:", realmRoles);

  const role = mapKeycloakRolesToRole(realmRoles);
  console.log("[getUserProfile] Mapped role:", role);

  if (!role) {
    console.warn("[getUserProfile] No recognized role in token:", realmRoles);
    return null;
  }

  const firstName = token.given_name ?? token.name?.split(" ")[0] ?? "";
  const lastName = token.family_name ?? token.name?.split(" ").slice(1).join(" ") ?? "";
  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  const region =
    role === "ministry"
      ? "National"
      : role === "federation"
        ? (token.organization ?? "Unknown")
        : role === "apex"
          ? (token.cooperation ?? "Unknown")
          : (token.cooperation ?? "Unknown");

  return {
    id: token.sub,
    email: token.email ?? "",
    name: token.name ?? `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    initials: initials.toUpperCase() || "??",
    role,
    region,
    organizationId: token.organization_id ?? token.organization ?? null,
    organizationName: token.organization ?? null,
    cooperationId: token.cooperation_id ?? token.cooperation ?? null,
    cooperationName: token.cooperation ?? null,
    assignedDimensions: token.assigned_dimensions ?? [],
    realmRoles,
  };
}

export function hasRole(role: Role): boolean {
  const profile = getUserProfile();
  return profile?.role === role;
}

export function hasAnyRole(roles: Role[]): boolean {
  const profile = getUserProfile();
  const hasAccess = profile ? roles.includes(profile.role) : false;
  console.log("[hasAnyRole] Checking:", { required: roles, userRole: profile?.role, hasAccess });
  return hasAccess;
}

export function isAuthenticated(): boolean {
  return keycloak.authenticated ?? false;
}

/** @deprecated Use `await keycloakReady` instead of polling isKeycloakReady() */
export function isKeycloakReady(): boolean {
  // A promise is "done" synchronously once resolved, but JS has no sync way to
  // check a promise's state. This helper is kept for backward compat only.
  // Route guards should use `await keycloakReady` instead.
  return keycloak.authenticated !== undefined && _initPromise !== null;
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...options, headers });
}

// ─── Token persistence (offline support) ────────────────────────────────────

interface CachedTokens {
  token: string;
  refreshToken: string;
  idToken: string;
  timestamp: number;
}

async function persistTokens(): Promise<void> {
  if (!keycloak.token || !keycloak.refreshToken) return;
  const tokens: CachedTokens = {
    token: keycloak.token,
    refreshToken: keycloak.refreshToken,
    idToken: keycloak.idToken ?? "",
    timestamp: Date.now(),
  };
  try {
    await set(TOKEN_CACHE_KEY, tokens);
  } catch {
    console.warn("[authService] Failed to persist tokens to IndexedDB");
  }
}

async function loadCachedTokens(): Promise<CachedTokens | null> {
  try {
    const tokens = await get<CachedTokens>(TOKEN_CACHE_KEY);
    if (tokens && Date.now() - tokens.timestamp < 24 * 60 * 60 * 1000) {
      return tokens;
    }
    await clearCachedTokens();
    return null;
  } catch {
    return null;
  }
}

async function clearCachedTokens(): Promise<void> {
  try {
    await del(TOKEN_CACHE_KEY);
  } catch {
    // Ignore
  }
}

export { keycloak };
