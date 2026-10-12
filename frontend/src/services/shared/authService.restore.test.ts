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

const CACHED_TOKENS = {
  token: "cached-access",
  refreshToken: "cached-refresh",
  idToken: "cached-id",
  timestamp: Date.now(),
  tokenExpiry: 0,
  refreshTokenExpiry: 0,
  userProfile: null,
  offlineToken: true,
};

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

async function freshAuthService() {
  vi.resetModules();
  return import("./authService");
}

describe("restoreOnlineSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(keycloak, { authenticated: false, token: null, tokenParsed: null });
    idb.get.mockResolvedValue(CACHED_TOKENS);
    idb.set.mockResolvedValue(undefined);
  });

  it("completes the skipped Keycloak start-up after the app started offline", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();
    expect(auth.isOfflineModeActive()).toBe(true);
    expect(keycloak.init).not.toHaveBeenCalled();

    setOnline(true);
    keycloak.init.mockImplementation(async () => {
      keycloak.authenticated = true;
      keycloak.token = "fresh-access";
      keycloak.refreshToken = "fresh-refresh";
      return true;
    });
    const restored = await auth.restoreOnlineSession();

    expect(restored).toBe(true);
    expect(auth.isOfflineModeActive()).toBe(false);
    expect(keycloak.init).toHaveBeenCalledWith(
      expect.objectContaining({ token: "cached-access", refreshToken: "cached-refresh" }),
    );
  });

  it("stays offline while the network is still down", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();

    expect(await auth.restoreOnlineSession()).toBe(false);
    expect(auth.isOfflineModeActive()).toBe(true);
    expect(keycloak.init).not.toHaveBeenCalled();
  });

  it("stays offline when the cached session can no longer be refreshed", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();

    setOnline(true);
    keycloak.init.mockResolvedValue(false);

    expect(await auth.restoreOnlineSession()).toBe(false);
    expect(auth.isOfflineModeActive()).toBe(true);
  });

  it("does not initialise Keycloak twice when start-up already ran", async () => {
    setOnline(true);
    keycloak.init.mockRejectedValue(new TypeError("Failed to fetch"));
    const auth = await freshAuthService();
    await auth.initKeycloak(); // Keycloak unreachable → offline mode on cached token
    expect(auth.isOfflineModeActive()).toBe(true);
    keycloak.init.mockClear();

    expect(await auth.restoreOnlineSession()).toBe(false);
    expect(keycloak.init).not.toHaveBeenCalled();
  });
});
