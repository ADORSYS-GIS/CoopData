import { get, set, del } from "idb-keyval";
import { keycloak } from "./keycloakConfig";
import type { UserProfile, CustomKeycloakToken } from "@/types/auth";
import type { Role } from "@/constants/roles";
import { mapKeycloakRolesToRole } from "@/constants/roles";

const TOKEN_CACHE_KEY = "coopdata_tokens";
const REFRESH_THRESHOLD_SECONDS = 30;
// 30-day offline token validity window
const OFFLINE_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let keycloakInitialized = false;
let isLoggingOut = false;
let keycloakInitPromise: Promise<boolean> | null = null;
let keycloakReadyResolvers: ((value: boolean) => void)[] = [];
// Set to true when authenticated via cached offline token (no network)
let offlineModeActive = false;

export function isOfflineModeActive(): boolean {
  return offlineModeActive;
}

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

  // Dedupe concurrent calls (e.g. React 18 StrictMode double-mount in dev):
  // the second caller must await the same in-flight keycloak.init() promise.
  if (keycloakInitPromise) {
    console.log("[auth] Init already in progress, awaiting existing promise");
    return keycloakInitPromise;
  }

  keycloakInitPromise = doInitKeycloak();
  try {
    return await keycloakInitPromise;
  } finally {
    keycloakInitPromise = null;
  }
}

async function doInitKeycloak(): Promise<boolean> {
  console.log("[auth] Initializing Keycloak...");
  const cachedTokens = await loadCachedTokens();
  console.log("[auth] Cached tokens:", cachedTokens ? "found" : "none");

  try {
    const authenticated = await keycloak.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      enableLogging: import.meta.env.DEV,
      checkLoginIframe: false,
      silentCheckSsoRedirectUri:
        typeof window !== "undefined" && window.location.search.includes("no-silent-sso")
          ? undefined
          : `${window.location.origin}/silent-check-sso.html`,
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

    // The Keycloak JS SDK throws "A 'Keycloak' instance can only be initialized
    // once." even though internally it has already initialised (and processed
    // the redirect-back code/fragment). Treat that case as already-initialized
    // rather than a fatal failure that triggers a login loop.
    const alreadyInited =
      error instanceof Error &&
      /can only be initialized once/i.test(error.message) &&
      keycloak.authenticated === true;

    if (alreadyInited) {
      console.log("[auth] Recovering from double-init — authenticated via existing instance");
      await persistTokens();
      return true;
    }

    // ── OFFLINE RECOVERY ──────────────────────────────────────────────────────
    // If the browser is offline (or Keycloak is simply unreachable) and we have
    // a valid offline token stored in IDB, activate offline mode so the app can
    // render with cached data instead of bouncing the user to /login.
    if (!navigator.onLine && cachedTokens && isOfflineTokenValid(cachedTokens)) {
      console.log("[auth] Offline recovery — activating offline mode with cached token");
      offlineModeActive = true;
      return true;
    }

    if (cachedTokens?.token) {
      console.log("[auth] Falling back to cached token");
      return true;
    }
    return false;
  }
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function login(): Promise<void> {
  console.log("[auth] login() called — redirecting to Keycloak");
  const currentLang = localStorage.getItem("i18nextLng") || "en";
  await keycloak.login({
    redirectUri: window.location.origin + "/app/dashboard",
    // offline_access scope gives us a 30-day refresh token that works without network
    scope: "openid profile email offline_access",
    locale: currentLang,
  });
}

export async function logout(): Promise<void> {
  console.log("[auth] logout() called");
  isLoggingOut = true;
  offlineModeActive = false;
  await clearCachedTokens();
  keycloakInitialized = false;
  await keycloak.logout({
    redirectUri: window.location.origin + "/",
  });
  isLoggingOut = false;
}

export async function getAccessToken(): Promise<string> {
  if (isLoggingOut) {
    throw new Error("Logging out");
  }

  // Offline mode: return cached token directly — the SW or IDB persister
  // handles data locally so the backend never receives this expired token.
  if (offlineModeActive) {
    const cached = await loadCachedTokens();
    if (cached?.token) {
      console.warn("[auth] Offline mode — returning cached access token");
      return cached.token;
    }
    throw new Error("No cached token available offline.");
  }

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
  // In offline mode, decode the cached token directly (no Keycloak instance needed)
  if (offlineModeActive) {
    const profile = loadCachedProfileSync();
    if (profile) return profile;
    console.warn("[auth] getUserProfile: offline mode but no cached profile");
    return null;
  }

  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    console.log("[auth] getUserProfile: not authenticated or no token");
    return null;
  }

  const token = keycloak.tokenParsed as CustomKeycloakToken;
  const realmRoles = extractRealmRoles(token);
  const role = mapKeycloakRolesToRole(realmRoles);
  console.log("[getUserProfile] Mapped role:", role);

  if (!role) {
    console.warn("[auth] getUserProfile: no recognized role in token. Roles found:", realmRoles);
    return null;
  }

  const firstName = token.given_name ?? token.name?.split(" ")[0] ?? "";
  const lastName = token.family_name ?? token.name?.split(" ").slice(1).join(" ") ?? "";
  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  const orgName = extractOrgName(token.organization);
  const orgId = extractOrgId(token.organization);

  // cooperation is string[] of group paths: ["/apex-group-id/coop-name"]
  // Extract the apex group id (first segment) and cooperative name (last segment)
  const cooperationPaths = Array.isArray(token.cooperation) ? token.cooperation : [];
  const firstCoopPath = cooperationPaths[0] ?? null;
  const pathSegments = firstCoopPath ? firstCoopPath.split("/").filter(Boolean) : [];
  const apexGroupId = pathSegments[0] ?? null;
  const coopSegment = pathSegments[1] ?? pathSegments[0] ?? null;
  // Use the last path segment as the readable coop name (may be UUID — that's OK)
  const coopName = coopSegment;
  const coopId = coopSegment;

  const region =
    role === "ministry"
      ? "National"
      : role === "federation"
        ? (orgName ?? "Unknown")
        : (apexGroupId ?? "Unknown");

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
  const hasAccess = profile ? roles.includes(profile.role) : false;
  console.log("[hasAnyRole] Checking:", { required: roles, userRole: profile?.role, hasAccess });
  return hasAccess;
}

export function isAuthenticated(): boolean {
  return keycloak.authenticated ?? false;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...options, headers });
}

interface CachedTokens {
  token: string;
  refreshToken: string;
  idToken: string;
  timestamp: number;
  // Offline extensions
  tokenExpiry: number; // access_token expiry (Unix ms)
  refreshTokenExpiry: number; // refresh_token expiry (Unix ms)
  userProfile: UserProfile | null; // cached decoded profile (available offline)
  offlineToken: boolean; // true when offline_access scope was granted
}

/** Checks whether the stored refresh token is still within the 30-day offline window. */
function isOfflineTokenValid(cached: CachedTokens): boolean {
  return cached.offlineToken && Date.now() - cached.timestamp < OFFLINE_TOKEN_MAX_AGE_MS;
}

/** Synchronously read the user profile from a localStorage mirror (fallback for offline). */
function loadCachedProfileSync(): UserProfile | null {
  try {
    const raw = localStorage.getItem("coopdata_user_profile");
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

async function persistTokens(): Promise<void> {
  if (!keycloak.token || !keycloak.refreshToken) return;

  // Parse expiry from JWT claims
  let tokenExpiry = Date.now() + 5 * 60 * 1000; // default 5 min
  let refreshTokenExpiry = Date.now() + OFFLINE_TOKEN_MAX_AGE_MS;
  try {
    const [, tp] = keycloak.token.split(".");
    const claims = JSON.parse(atob(tp.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      number
    >;
    if (claims.exp) tokenExpiry = claims.exp * 1000;
    const [, rtp] = keycloak.refreshToken.split(".");
    const rclaims = JSON.parse(atob(rtp.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      number
    >;
    if (rclaims.exp) refreshTokenExpiry = rclaims.exp * 1000;
  } catch {
    /* ignore parse errors */
  }

  // Detect if this is an offline token (scope contains offline_access)
  const offlineToken = keycloak.tokenParsed
    ? String((keycloak.tokenParsed as Record<string, unknown>).scope ?? "").includes(
        "offline_access",
      )
    : false;

  const profile = getUserProfile();

  const tokens: CachedTokens = {
    token: keycloak.token,
    refreshToken: keycloak.refreshToken,
    idToken: keycloak.idToken ?? "",
    timestamp: Date.now(),
    tokenExpiry,
    refreshTokenExpiry,
    userProfile: profile,
    offlineToken,
  };

  try {
    await set(TOKEN_CACHE_KEY, tokens);
    // Mirror profile to localStorage for synchronous offline reads
    if (profile) localStorage.setItem("coopdata_user_profile", JSON.stringify(profile));
  } catch {
    console.warn("[auth] Failed to persist tokens to IndexedDB");
  }
}

async function loadCachedTokens(): Promise<CachedTokens | null> {
  try {
    const tokens = await get<CachedTokens>(TOKEN_CACHE_KEY);
    if (!tokens) return null;
    // Accept cached tokens within the 30-day offline window
    if (Date.now() - tokens.timestamp < OFFLINE_TOKEN_MAX_AGE_MS) {
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
