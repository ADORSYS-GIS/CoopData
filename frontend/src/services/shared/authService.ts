import Keycloak from "keycloak-js";
import { get, set, del } from "idb-keyval";
import { keycloak } from "./keycloakConfig";
import type { UserProfile, CustomKeycloakToken } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { mapKeycloakRolesToRole, ROLES } from "@/constants/roles";

const TOKEN_CACHE_KEY = "coopdata_tokens";
const REFRESH_THRESHOLD_SECONDS = 30;

let keycloakInitialized = false;

export async function initKeycloak(): Promise<boolean> {
  if (keycloakInitialized) {
    return keycloak.authenticated ?? false;
  }

  // Try to load cached tokens for offline support
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

    keycloakInitialized = true;

    if (authenticated) {
      await persistTokens();
      // Try to refresh the token to ensure it's valid
      try {
        await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);
        await persistTokens();
      } catch {
        // Token refresh failed — clear cache and require re-login
        await clearCachedTokens();
        return false;
      }
    }

    return authenticated;
  } catch (error) {
    console.error("Keycloak init failed:", error);
    keycloakInitialized = true;

    // If we have cached tokens, try offline mode
    if (cachedTokens?.token) {
      return true;
    }
    return false;
  }
}

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

export function getUserProfile(): UserProfile | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null;
  }

  const token = keycloak.tokenParsed as CustomKeycloakToken;
  const realmRoles = token.realm_access?.roles ?? [];
  const role = mapKeycloakRolesToRole(realmRoles);

  if (!role) {
    console.warn("No recognized role in token:", realmRoles);
    return null;
  }

  const firstName = token.given_name ?? token.name?.split(" ")[0] ?? "";
  const lastName = token.family_name ?? token.name?.split(" ").slice(1).join(" ") ?? "";
  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  // Compute region from organization/cooperation based on role
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
  return profile ? roles.includes(profile.role) : false;
}

export function isAuthenticated(): boolean {
  return keycloak.authenticated ?? false;
}

export function isKeycloakReady(): boolean {
  return keycloakInitialized;
}

/** Fetch with auth — attaches Bearer token to API calls */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  return fetch(url, {
    ...options,
    headers,
  });
}

// --- Token persistence for offline support ---

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
    console.warn("Failed to persist tokens to IndexedDB");
  }
}

async function loadCachedTokens(): Promise<CachedTokens | null> {
  try {
    const tokens = await get<CachedTokens>(TOKEN_CACHE_KEY);
    if (tokens && Date.now() - tokens.timestamp < 24 * 60 * 60 * 1000) {
      return tokens;
    }
    // Expired — clear
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
