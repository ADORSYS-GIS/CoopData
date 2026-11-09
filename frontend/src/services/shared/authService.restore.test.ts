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
vi.mock("./keycloakConfig", () => ({
  keycloak,
  KEYCLOAK_CONFIG: { url: "http://keycloak.test", realm: "coop-data", clientId: "app" },
}));

const fetchMock = vi.fn();

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
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
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

    expect(restored).toBe("restored");
    expect(auth.isOfflineModeActive()).toBe(false);
    expect(keycloak.init).toHaveBeenCalledWith(
      expect.objectContaining({ token: "cached-access", refreshToken: "cached-refresh" }),
    );
  });

  it("stays offline while the network is still down", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();

    expect(await auth.restoreOnlineSession()).toBe("unreachable");
    expect(auth.isOfflineModeActive()).toBe(true);
    expect(keycloak.init).not.toHaveBeenCalled();
  });

  it("keeps its one-time Keycloak start-up while Keycloak doesn't answer yet", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();

    setOnline(true);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await auth.restoreOnlineSession()).toBe("unreachable");
    expect(keycloak.init).not.toHaveBeenCalled();
    expect(auth.isOfflineModeActive()).toBe(true);
  });

  it("reports an ended session when Keycloak refuses the saved login", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    await auth.initKeycloak();

    setOnline(true);
    keycloak.init.mockRejectedValue({ error: "invalid_grant" });

    expect(await auth.restoreOnlineSession()).toBe("ended");
    expect(auth.isOfflineModeActive()).toBe(true);
  });

  it("does not initialise Keycloak twice when start-up already ran", async () => {
    setOnline(true);
    keycloak.init.mockRejectedValue(new TypeError("Failed to fetch"));
    const auth = await freshAuthService();
    await auth.initKeycloak(); // Keycloak unreachable → offline mode on cached token
    expect(auth.isOfflineModeActive()).toBe(true);
    keycloak.init.mockClear();

    expect(await auth.restoreOnlineSession()).toBe("reload");
    expect(keycloak.init).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.get.mockResolvedValue(CACHED_TOKENS);
    idb.del.mockResolvedValue(undefined);
    keycloak.logout.mockResolvedValue(undefined);
    // The online logout path calls Keycloak only with a live session —
    // simulate one, as an authenticated user would have.
    keycloak.authenticated = true;
  });

  it("logs out of Keycloak online and removes the saved login and profile", async () => {
    setOnline(true);
    const auth = await freshAuthService();
    localStorage.setItem("coopdata_user_profile", JSON.stringify({ id: "u" }));

    void auth.logout();

    await vi.waitFor(() =>
      expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: expect.stringContaining("/") }),
    );
    expect(idb.del).toHaveBeenCalled();
    expect(localStorage.getItem("coopdata_user_profile")).toBeNull();
  });

  it("never resolves, so callers can't redirect inside the app while it leaves", async () => {
    setOnline(true);
    const auth = await freshAuthService();
    let settled = false;

    void auth.logout().then(() => (settled = true));
    await vi.waitFor(() => expect(keycloak.logout).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(settled).toBe(false);
  });

  it("does not try to reach Keycloak while offline", async () => {
    setOnline(false);
    const auth = await freshAuthService();
    const replace = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...realLocation, origin: realLocation.origin, replace },
    });

    void auth.logout();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(`${realLocation.origin}/`));
    expect(keycloak.logout).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  });
});
