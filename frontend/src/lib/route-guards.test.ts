import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { CustomKeycloakToken } from "@/types/auth";
import type { UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";

const mockAuth = vi.hoisted(() => ({
  waitForKeycloakReady: vi.fn().mockResolvedValue(true),
  isAuthenticated: vi.fn().mockReturnValue(false),
  hasAnyRole: vi.fn().mockReturnValue(false),
  getUserProfile: vi.fn().mockReturnValue(null) as Mock<() => UserProfile | null>,
}));

vi.mock("@/services/shared/authService", () => ({
  waitForKeycloakReady: mockAuth.waitForKeycloakReady,
  isAuthenticated: mockAuth.isAuthenticated,
  hasAnyRole: mockAuth.hasAnyRole,
  getUserProfile: mockAuth.getUserProfile,
}));

vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn((opts: { to: string }) => {
    const err = new Error("redirect");
    (err as unknown as { __isRedirect: boolean }).__isRedirect = true;
    (err as unknown as { to: string }).to = opts.to;
    throw err;
  }),
}));

import {
  requireAuth,
  requireRole,
  redirectIfAuthenticated,
  ROUTE_ACCESS,
} from "@/lib/route-guards";
import { redirect } from "@tanstack/react-router";

function makeProfile(role: Role): UserProfile {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    initials: "TU",
    role,
    region: "Test",
    organizationId: null,
    organizationName: null,
    cooperationId: null,
    cooperationName: null,
    assignedDimensions: [],
    realmRoles: [role],
  };
}

describe("route-guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.waitForKeycloakReady.mockResolvedValue(true);
    mockAuth.isAuthenticated.mockReturnValue(false);
    mockAuth.hasAnyRole.mockReturnValue(false);
    mockAuth.getUserProfile.mockReturnValue(null);
  });

  describe("requireAuth", () => {
    it("should allow access when authenticated with valid profile", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("ministry"));
      await expect(requireAuth()).resolves.toBeUndefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("should redirect to login when not authenticated", async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);
      await expect(requireAuth()).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/login" });
    });

    it("should redirect to login when keycloak init times out", async () => {
      mockAuth.waitForKeycloakReady.mockResolvedValue(false);
      await expect(requireAuth()).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/login" });
    });

    it("should redirect to unauthorized when authenticated but no profile", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(null);
      await expect(requireAuth()).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/unauthorized" });
    });
  });

  describe("requireRole", () => {
    it("should allow access when user has required role", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("ministry"));
      mockAuth.hasAnyRole.mockReturnValue(true);
      await expect(requireRole("ministry")).resolves.toBeUndefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("should allow access when user has one of multiple required roles", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("federation"));
      mockAuth.hasAnyRole.mockReturnValue(true);
      await expect(requireRole("ministry", "federation")).resolves.toBeUndefined();
    });

    it("should redirect to login when not authenticated", async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);
      await expect(requireRole("ministry")).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/login" });
    });

    it("should redirect to login when keycloak init times out", async () => {
      mockAuth.waitForKeycloakReady.mockResolvedValue(false);
      await expect(requireRole("ministry")).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/login" });
    });

    it("should redirect to unauthorized when authenticated but no profile", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(null);
      await expect(requireRole("ministry")).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/unauthorized" });
    });

    it("should redirect to unauthorized when user role does not match", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("cooperative"));
      mockAuth.hasAnyRole.mockReturnValue(false);
      await expect(requireRole("ministry")).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/unauthorized" });
    });

    it("should redirect to unauthorized when user has lower role in hierarchy", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("apex"));
      mockAuth.hasAnyRole.mockReturnValue(false);
      await expect(requireRole("ministry", "federation")).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/unauthorized" });
    });
  });

  describe("redirectIfAuthenticated", () => {
    it("should redirect to default route when authenticated with valid profile", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(makeProfile("ministry"));
      await expect(redirectIfAuthenticated()).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/app/dashboard" });
    });

    it("should redirect to unauthorized when authenticated but no profile", async () => {
      mockAuth.isAuthenticated.mockReturnValue(true);
      mockAuth.getUserProfile.mockReturnValue(null);
      await expect(redirectIfAuthenticated()).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({ to: "/unauthorized" });
    });

    it("should not redirect when not authenticated", async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);
      await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("should not redirect when keycloak init times out", async () => {
      mockAuth.waitForKeycloakReady.mockResolvedValue(false);
      await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("ROUTE_ACCESS map", () => {
    it("should define access for all major routes", () => {
      expect(ROUTE_ACCESS["/app/dashboard"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/federations"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/apexes"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/cooperatives"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/submissions"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/users"]).toBeDefined();
      expect(ROUTE_ACCESS["/app/settings"]).toBeDefined();
    });

    it("should allow all roles for dashboard", () => {
      expect(ROUTE_ACCESS["/app/dashboard"]).toEqual(
        expect.arrayContaining(["ministry", "federation", "apex", "cooperative"]),
      );
    });

    it("should restrict federations to ministry only", () => {
      expect(ROUTE_ACCESS["/app/federations"]).toEqual(["ministry"]);
    });

    it("should restrict apexes to federation only", () => {
      expect(ROUTE_ACCESS["/app/apexes"]).toEqual(["federation"]);
    });

    it("should restrict cooperatives to apex only", () => {
      expect(ROUTE_ACCESS["/app/cooperatives"]).toEqual(["apex"]);
    });

    it("should allow all roles access to submissions", () => {
      expect(ROUTE_ACCESS["/app/submissions"]).toEqual(
        expect.arrayContaining(["ministry", "federation", "apex", "cooperative"]),
      );
    });

    it("should allow ministry, federation, apex for users", () => {
      expect(ROUTE_ACCESS["/app/users"]).toEqual(
        expect.arrayContaining(["ministry", "federation", "apex"]),
      );
      expect(ROUTE_ACCESS["/app/users"]).not.toContain("cooperative");
    });

    it("should restrict settings to ministry only", () => {
      expect(ROUTE_ACCESS["/app/settings"]).toEqual(["ministry"]);
    });
  });
});
