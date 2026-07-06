import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CustomKeycloakToken } from "@/types/auth";

const mockKeycloakInstance = vi.hoisted(() => ({
  authenticated: false,
  token: null as string | null,
  tokenParsed: null as Record<string, unknown> | null,
  refreshToken: null as string | null,
  idToken: null as string | null,
  init: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  updateToken: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./keycloakConfig", () => ({
  keycloak: mockKeycloakInstance,
  KEYCLOAK_CONFIG: { url: "http://localhost:8180", realm: "coop-data", clientId: "coopdata-frontend" },
}));

import {
  getUserProfile,
  hasRole,
  hasAnyRole,
  isAuthenticated,
  login,
  logout,
  getAccessToken,
  initKeycloak,
  waitForKeycloakReady,
} from "@/services/shared/authService";

function makeToken(overrides: Partial<CustomKeycloakToken> = {}): CustomKeycloakToken {
  return {
    sub: "user-123",
    email: "test@example.com",
    given_name: "John",
    family_name: "Doe",
    name: "John Doe",
    realm_access: { roles: ["ministry"] },
    ...overrides,
  };
}

function setAuthenticated(token: CustomKeycloakToken | null) {
  mockKeycloakInstance.authenticated = !!token;
  mockKeycloakInstance.tokenParsed = token;
  mockKeycloakInstance.token = token ? "fake-access-token" : null;
  mockKeycloakInstance.refreshToken = token ? "fake-refresh-token" : null;
}

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeycloakInstance.authenticated = false;
    mockKeycloakInstance.tokenParsed = null;
    mockKeycloakInstance.token = null;
    mockKeycloakInstance.refreshToken = null;
    mockKeycloakInstance.idToken = null;
    mockKeycloakInstance.updateToken.mockResolvedValue(false);
  });

  describe("isAuthenticated", () => {
    it("should return false when keycloak is not authenticated", () => {
      mockKeycloakInstance.authenticated = false;
      expect(isAuthenticated()).toBe(false);
    });

    it("should return true when keycloak is authenticated", () => {
      mockKeycloakInstance.authenticated = true;
      expect(isAuthenticated()).toBe(true);
    });

    it("should return false when authenticated is undefined", () => {
      mockKeycloakInstance.authenticated = undefined;
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe("getUserProfile", () => {
    it("should return null when not authenticated", () => {
      setAuthenticated(null);
      expect(getUserProfile()).toBeNull();
    });

    it("should return null when tokenParsed is null", () => {
      mockKeycloakInstance.authenticated = true;
      mockKeycloakInstance.tokenParsed = null;
      expect(getUserProfile()).toBeNull();
    });

    it("should return null when no recognized role in token", () => {
      setAuthenticated(
        makeToken({ realm_access: { roles: ["unknown_role", "offline_access"] } }),
      );
      expect(getUserProfile()).toBeNull();
    });

    it("should return a profile with ministry role", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["ministry"] } }));
      const profile = getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile!.role).toBe("ministry");
      expect(profile!.email).toBe("test@example.com");
      expect(profile!.firstName).toBe("John");
      expect(profile!.lastName).toBe("Doe");
      expect(profile!.name).toBe("John Doe");
      expect(profile!.initials).toBe("JD");
      expect(profile!.id).toBe("user-123");
    });

    it("should return a profile with federation role", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["federation"] },
          organization: { "Test Federation": { id: "org-1" } },
          organization_id: "org-1",
        }),
      );
      const profile = getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile!.role).toBe("federation");
      expect(profile!.organizationName).toBe("Test Federation");
      expect(profile!.organizationId).toBe("org-1");
      expect(profile!.region).toBe("Test Federation");
    });

    it("should return a profile with apex role from regional_officer", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["regional_officer"] },
          cooperation: ["/apex-group-1/coop-subgroup-1"],
        }),
      );
      const profile = getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile!.role).toBe("apex");
      expect(profile!.region).toBe("apex-group-1");
    });

    it("should return a profile with cooperative role from default-roles-coop-data", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["default-roles-coop-data"] },
          cooperation: ["/apex-group-1/coop-subgroup-1"],
          cooperation_id: "coop-1",
        }),
      );
      const profile = getUserProfile();
      expect(profile).not.toBeNull();
      expect(profile!.role).toBe("cooperative");
      expect(profile!.cooperationId).toBe("coop-1");
      expect(profile!.cooperationName).toBe("coop-subgroup-1");
    });

    it("should extract initials from given_name and family_name", () => {
      setAuthenticated(
        makeToken({ given_name: "Alice", family_name: "Smith", name: undefined }),
      );
      const profile = getUserProfile();
      expect(profile!.initials).toBe("AS");
    });

    it("should fallback to name split when given_name/family_name missing", () => {
      setAuthenticated(
        makeToken({ given_name: undefined, family_name: undefined, name: "Bob Lee" }),
      );
      const profile = getUserProfile();
      expect(profile!.firstName).toBe("Bob");
      expect(profile!.lastName).toBe("Lee");
      expect(profile!.initials).toBe("BL");
    });

    it("should use ?? for initials when no name info", () => {
      setAuthenticated(
        makeToken({
          given_name: undefined,
          family_name: undefined,
          name: undefined,
          realm_access: { roles: ["ministry"] },
        }),
      );
      const profile = getUserProfile();
      expect(profile!.initials).toBe("??");
    });

    it("should set region to National for ministry role", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["ministry"] } }));
      const profile = getUserProfile();
      expect(profile!.region).toBe("National");
    });

    it("should set region to orgName for federation role", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["federation"] },
          organization: { "My Federation": { id: "f1" } },
        }),
      );
      const profile = getUserProfile();
      expect(profile!.region).toBe("My Federation");
    });

    it("should set region to Unknown for federation without org", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["federation"] } }));
      const profile = getUserProfile();
      expect(profile!.region).toBe("Unknown");
    });

    it("should include assigned_dimensions in profile", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["ministry"] },
          assigned_dimensions: ["dim1", "dim2"],
        }),
      );
      const profile = getUserProfile();
      expect(profile!.assignedDimensions).toEqual(["dim1", "dim2"]);
    });

    it("should default assignedDimensions to empty array", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["ministry"] } }));
      const profile = getUserProfile();
      expect(profile!.assignedDimensions).toEqual([]);
    });

    it("should include realmRoles in profile", () => {
      setAuthenticated(
        makeToken({ realm_access: { roles: ["ministry", "offline_access"] } }),
      );
      const profile = getUserProfile();
      expect(profile!.realmRoles).toContain("ministry");
      expect(profile!.realmRoles).toContain("offline_access");
    });

    it("should merge is_member_of into realmRoles", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["ministry"] },
          is_member_of: ["group-a"],
        }),
      );
      const profile = getUserProfile();
      expect(profile!.realmRoles).toContain("group-a");
      expect(profile!.realmRoles).toContain("ministry");
    });

    it("should deduplicate roles from realm_access and is_member_of", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["ministry", "dup"] },
          is_member_of: ["dup", "extra"],
        }),
      );
      const profile = getUserProfile();
      const uniqueRoles = [...new Set(profile!.realmRoles)];
      expect(profile!.realmRoles.length).toBe(uniqueRoles.length);
    });

    it("should prioritize ministry over other roles in token", () => {
      setAuthenticated(
        makeToken({
          realm_access: { roles: ["cooperative", "apex", "federation", "ministry"] },
        }),
      );
      const profile = getUserProfile();
      expect(profile!.role).toBe("ministry");
    });
  });

  describe("hasRole", () => {
    it("should return true when user has the specified role", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["ministry"] } }));
      expect(hasRole("ministry")).toBe(true);
    });

    it("should return false when user has a different role", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["federation"] } }));
      expect(hasRole("ministry")).toBe(false);
    });

    it("should return false when not authenticated", () => {
      setAuthenticated(null);
      expect(hasRole("ministry")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true when user has one of the specified roles", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["federation"] } }));
      expect(hasAnyRole(["ministry", "federation"])).toBe(true);
    });

    it("should return false when user has none of the specified roles", () => {
      setAuthenticated(makeToken({ realm_access: { roles: ["cooperative"] } }));
      expect(hasAnyRole(["ministry", "federation"])).toBe(false);
    });

    it("should return false when not authenticated", () => {
      setAuthenticated(null);
      expect(hasAnyRole(["ministry"])).toBe(false);
    });

    it("should return false when profile is null (no recognized role)", () => {
      setAuthenticated(
        makeToken({ realm_access: { roles: ["unknown_role"] } }),
      );
      expect(hasAnyRole(["ministry"])).toBe(false);
    });
  });

  describe("login", () => {
    it("should call keycloak.login with correct redirect URI and scope", async () => {
      mockKeycloakInstance.login.mockResolvedValue(undefined);
      await login();
      expect(mockKeycloakInstance.login).toHaveBeenCalledWith({
        redirectUri: expect.stringContaining("/app/dashboard"),
        scope: "openid profile email",
      });
    });
  });

  describe("logout", () => {
    it("should call keycloak.logout and clear tokens", async () => {
      mockKeycloakInstance.logout.mockResolvedValue(undefined);
      await logout();
      expect(mockKeycloakInstance.logout).toHaveBeenCalledWith({
        redirectUri: expect.stringContaining("/"),
      });
    });
  });

  describe("getAccessToken", () => {
    it("should throw when not authenticated", async () => {
      mockKeycloakInstance.authenticated = false;
      await expect(getAccessToken()).rejects.toThrow("Not authenticated");
    });

    it("should return token when authenticated", async () => {
      mockKeycloakInstance.authenticated = true;
      mockKeycloakInstance.token = "my-token";
      mockKeycloakInstance.updateToken.mockResolvedValue(false);
      const token = await getAccessToken();
      expect(token).toBe("my-token");
    });

    it("should throw session expired when refresh fails and no cached token", async () => {
      mockKeycloakInstance.authenticated = true;
      mockKeycloakInstance.token = "expired";
      mockKeycloakInstance.updateToken.mockRejectedValue(new Error("refresh failed"));
      await expect(getAccessToken()).rejects.toThrow("Session expired");
    });
  });

  describe("initKeycloak", () => {
    it("should initialize keycloak and return authenticated status", async () => {
      mockKeycloakInstance.init.mockResolvedValue(true);
      mockKeycloakInstance.authenticated = true;
      mockKeycloakInstance.token = "token";
      mockKeycloakInstance.refreshToken = "refresh";
      mockKeycloakInstance.tokenParsed = makeToken({ realm_access: { roles: ["ministry"] } });
      mockKeycloakInstance.updateToken.mockResolvedValue(false);

      const result = await initKeycloak();
      expect(result).toBe(true);
      expect(mockKeycloakInstance.init).toHaveBeenCalledWith(
        expect.objectContaining({
          onLoad: "check-sso",
          pkceMethod: "S256",
        }),
      );
    });

    it("should return false when init throws and no cached token", async () => {
      mockKeycloakInstance.init.mockRejectedValue(new Error("init failed"));
      const result = await initKeycloak();
      expect(result).toBe(false);
    });
  });

  describe("waitForKeycloakReady", () => {
    it("should resolve true when already initialized", async () => {
      mockKeycloakInstance.init.mockResolvedValue(true);
      mockKeycloakInstance.authenticated = true;
      mockKeycloakInstance.token = "token";
      mockKeycloakInstance.refreshToken = "refresh";
      mockKeycloakInstance.tokenParsed = makeToken({ realm_access: { roles: ["ministry"] } });
      mockKeycloakInstance.updateToken.mockResolvedValue(false);

      await initKeycloak();
      const result = await waitForKeycloakReady();
      expect(result).toBe(true);
    });
  });
});