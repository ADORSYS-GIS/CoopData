import { describe, it, expect, beforeEach, vi } from "vitest";

// authService keeps module-level session state, so every test loads a fresh copy.
const keycloak = vi.hoisted(() => ({
  authenticated: false,
  token: null as string | null,
  tokenParsed: null as Record<string, unknown> | null,
  refreshToken: null as string | null,
  idToken: null as string | null,
  init: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
const idb = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));

vi.mock("idb-keyval", () => idb);
vi.mock("./keycloakConfig", () => ({ keycloak }));

const DAY = 24 * 60 * 60 * 1000;

function cachedTokens(overrides: { timestamp: number; refreshTokenExpiry: number }) {
  return {
    token: "cached-access",
    refreshToken: "cached-refresh",
    idToken: "cached-id",
    tokenExpiry: 0,
    userProfile: null,
    offlineToken: true,
    ...overrides,
  };
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

async function startOffline(tokens: ReturnType<typeof cachedTokens>) {
  idb.get.mockResolvedValue(tokens);
  setOnline(false);
  vi.resetModules();
  const auth = await import("./authService");
  const signedIn = await auth.initKeycloak();
  return { auth, signedIn };
}

describe("offline sign-in deadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.set.mockResolvedValue(undefined);
    idb.del.mockResolvedValue(undefined);
    keycloak.init.mockRejectedValue(new TypeError("Failed to fetch"));
  });

  it("follows Keycloak's deadline, not the time of the last refresh", async () => {
    // Refreshed a minute ago, but Keycloak's offline session (fixed at the
    // password sign-in) already ended.
    const { auth, signedIn } = await startOffline(
      cachedTokens({ timestamp: Date.now() - 60_000, refreshTokenExpiry: Date.now() - 1_000 }),
    );

    expect(signedIn).toBe(false);
    expect(auth.isOfflineModeActive()).toBe(false);
    expect(idb.del).toHaveBeenCalledWith("coopdata_tokens");
  });

  it("allows offline use until Keycloak's deadline, even when the last refresh is old", async () => {
    const { auth, signedIn } = await startOffline(
      cachedTokens({ timestamp: Date.now() - 29 * DAY, refreshTokenExpiry: Date.now() + DAY }),
    );

    expect(signedIn).toBe(true);
    expect(auth.isOfflineModeActive()).toBe(true);
    expect(auth.getOfflineSessionExpiry()).toBeGreaterThan(Date.now());
  });

  it("falls back to 30 days after the last refresh when the deadline is unknown", async () => {
    const recent = await startOffline(
      cachedTokens({ timestamp: Date.now() - DAY, refreshTokenExpiry: 0 }),
    );
    expect(recent.signedIn).toBe(true);

    const old = await startOffline(
      cachedTokens({ timestamp: Date.now() - 31 * DAY, refreshTokenExpiry: 0 }),
    );
    expect(old.signedIn).toBe(false);
  });
});
