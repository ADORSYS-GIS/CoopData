import Keycloak from "keycloak-js";
import { get, set, del } from "idb-keyval";
import { keycloak } from "./keycloakConfig";
import type { UserProfile, CustomKeycloakToken } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { mapKeycloakRolesToRole } from "@/constants/roles";

const TOKEN_CACHE_KEY = "coopdata_tokens";
const REFRESH_THRESHOLD_SECONDS = 30;

let keycloakInitialized = false;
let keycloakReadyResolvers: ((value: boolean) => void)[] = [];

function resolveKeycloakReady() {
  keycloakInitialized = true;
  const resolvers = keycloakReadyResolvers;
  keycloakReadyResolvers = [];
  for (const resolve of resolvers) {
    resolve(true);
  }
}

export function waitForKeycloakReady(timeoutMs = 8000): Promise<boolean> {
  if (keycloakInitialized) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn("[auth] waitForKeycloakReady timed out");
        resolve(false);
      }
    }, timeoutMs);
    keycloakReadyResolvers.push((value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    });
  });
}

export async function initKeycloak(): Promise<boolean> {
  if (keycloakInitialized) {
    console.log("[auth] Already initialized, authenticated:", keycloak.authenticated);
    return keycloak.authenticated ?? false;
  }

  console.log("[auth] Initializing Keycloak...");
  const cachedTokens = await loadCachedTokens();
  console.log("[auth] Cached tokens:", cachedTokens ? "found" : "none");

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

    resolveKeycloakReady();
    console.log("[auth] Keycloak init complete, authenticated:", authenticated);

    if (authenticated) {
      await persistTokens();
      try {
        await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);
        await persistTokens();
        console.log("[auth] Token refreshed successfully");
      } catch (e) {
        console.warn("[auth] Token refresh failed, clearing cache:", e);
        await clearCachedTokens();
        return false;
      }

      const profile = getUserProfile();
      console.log(
        "[auth] User profile:",
        profile ? { email: profile.email, role: profile.role, name: profile.name } : null,
      );
    }

    return authenticated;
  } catch (error) {
    console.error("[auth] Keycloak init failed:", error);
    resolveKeycloakReady();

    if (cachedTokens?.token) {
      console.log("[auth] Falling back to cached token");
      return true;
    }
    return false;
  }
}

export async function login(): Promise<void> {
  console.log("[auth] login() called — redirecting to Keycloak");
  await keycloak.login({
    redirectUri: window.location.origin + "/app/dashboard",
    scope: "openid profile email",
  });
}

export async function logout(): Promise<void> {
  console.log("[auth] logout() called");
  await clearCachedTokens();
  keycloakInitialized = false;
  await keycloak.logout({
    redirectUri: window.location.origin + "/",
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
    const cached = await loadCachedTokens();
    if (cached?.token) {
      return cached.token;
    }
    throw new Error("Session expired. Please log in again.");
  }

  return keycloak.token!;
}

function extractRealmRoles(token: CustomKeycloakToken): string[] {
  const roles: string[] = [];

  if (token.realm_access?.roles) {
    roles.push(...token.realm_access.roles);
  }

  if (token.is_member_of && Array.isArray(token.is_member_of)) {
    for (const member of token.is_member_of) {
      if (typeof member === "string" && !roles.includes(member)) {
        roles.push(member);
      }
    }
  }

  return [...new Set(roles)];
}

function extractOrgName(
  org: Record<string, { id: string }> | string | string[] | undefined,
): string | null {
  if (!org) return null;
  if (typeof org === "string") return org;
  if (Array.isArray(org)) return org[0] ?? null;
  if (typeof org === "object") return Object.keys(org)[0] ?? null;
  return null;
}

function extractOrgId(
  org: Record<string, { id: string }> | string | string[] | undefined,
): string | null {
  if (!org) return null;
  if (typeof org === "string") return org;
  if (Array.isArray(org)) return org[0] ?? null;
  if (typeof org === "object") {
    const firstKey = Object.keys(org)[0];
    return firstKey ? (org[firstKey]?.id ?? firstKey) : null;
  }
  return null;
}

export function getUserProfile(): UserProfile | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    console.log("[auth] getUserProfile: not authenticated or no token");
    return null;
  }

  const token = keycloak.tokenParsed as CustomKeycloakToken;
  const realmRoles = extractRealmRoles(token);
  const role = mapKeycloakRolesToRole(realmRoles);

  if (!role) {
    console.warn("[auth] getUserProfile: no recognized role in token. Roles found:", realmRoles);
    return null;
  }

  const firstName = token.given_name ?? token.name?.split(" ")[0] ?? "";
  const lastName = token.family_name ?? token.name?.split(" ").slice(1).join(" ") ?? "";
  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  const orgName = extractOrgName(token.organization);
  const orgId = extractOrgId(token.organization);
  const coopName = extractOrgName(token.cooperation);
  const coopId = extractOrgId(token.cooperation);

  const region =
    role === "ministry"
      ? "National"
      : role === "federation"
        ? (orgName ?? "Unknown")
        : role === "apex"
          ? (coopName ?? "Unknown")
          : (coopName ?? "Unknown");

  return {
    id: token.sub,
    email: token.email ?? "",
    name: token.name ?? `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    initials: initials.toUpperCase() || "??",
    role,
    region,
    organizationId: token.organization_id ?? orgId ?? null,
    organizationName: orgName,
    cooperationId: token.cooperation_id ?? coopId ?? null,
    cooperationName: coopName,
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
    console.warn("[auth] Failed to persist tokens to IndexedDB");
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
