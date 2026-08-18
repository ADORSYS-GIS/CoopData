import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";

vi.mock("@/services/shared/authService", () => ({
  initKeycloak: vi.fn().mockResolvedValue(false),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockResolvedValue("fake-token"),
  getUserProfile: vi.fn().mockReturnValue(null),
  isOfflineModeActive: vi.fn().mockReturnValue(false),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  initKeycloak,
  login,
  logout,
  getAccessToken,
  getUserProfile,
} from "@/services/shared/authService";
import {
  KeycloakAuthProvider,
  useAuth,
  useRole,
  useUserRole,
  useCanAccess,
} from "@/context/AuthContext";

const mockedInitKeycloak = vi.mocked(initKeycloak);
const mockedLogin = vi.mocked(login);
const mockedLogout = vi.mocked(logout);
const mockedGetAccessToken = vi.mocked(getAccessToken);
const mockedGetUserProfile = vi.mocked(getUserProfile);

function makeProfile(role: Role, overrides: Partial<UserProfile> = {}): UserProfile {
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
    ...overrides,
  };
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <KeycloakAuthProvider>{children}</KeycloakAuthProvider>;
  };
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInitKeycloak.mockResolvedValue(false);
    mockedGetUserProfile.mockReturnValue(null);
    mockedGetAccessToken.mockResolvedValue("fake-token");
    mockedLogin.mockResolvedValue(undefined);
    mockedLogout.mockResolvedValue(undefined);
  });

  describe("useAuth", () => {
    it("should throw when used outside provider", () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        "useAuth must be used within a KeycloakAuthProvider",
      );
    });

    it("should provide initial loading state", () => {
      mockedInitKeycloak.mockImplementation(() => new Promise(() => {}));
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("should set authenticated and user profile when init succeeds", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.role).toBe("ministry");
      expect(result.current.role).toBe("ministry");
      expect(result.current.accessToken).toBe("fake-token");
    });

    it("should set unauthenticated when init returns false", async () => {
      mockedInitKeycloak.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.role).toBeNull();
    });

    it("should handle init error gracefully", async () => {
      mockedInitKeycloak.mockRejectedValue(new Error("init failed"));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("should expose login function that calls keycloakLogin", async () => {
      mockedInitKeycloak.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login();
      });

      expect(mockedLogin).toHaveBeenCalled();
    });

    it("should expose logout function that clears state", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
    });
  });

  describe("hasRole / hasAnyRole from context", () => {
    it("should return true for matching role", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("federation"));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole("federation")).toBe(true);
      expect(result.current.hasRole("ministry")).toBe(false);
      expect(result.current.hasAnyRole(["ministry", "federation"])).toBe(true);
      expect(result.current.hasAnyRole(["ministry", "apex"])).toBe(false);
    });

    it("should return false when not authenticated", async () => {
      mockedInitKeycloak.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole("ministry")).toBe(false);
      expect(result.current.hasAnyRole(["ministry"])).toBe(false);
    });
  });

  describe("useRole", () => {
    it("should return the user role when authenticated", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("apex"));

      const { result } = renderHook(() => useRole(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).toBe("apex"));
    });

    it("should return null when not authenticated", async () => {
      mockedInitKeycloak.mockResolvedValue(false);

      const { result } = renderHook(() => useRole(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).toBeNull());
    });
  });

  describe("useUserRole", () => {
    it("should return null while loading", () => {
      mockedInitKeycloak.mockImplementation(() => new Promise(() => {}));
      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      expect(result.current).toBeNull();
    });

    it("should return role when loaded", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).toBe("cooperative"));
    });
  });

  describe("useCanAccess", () => {
    it("should return true for accessible route", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

      const { result } = renderHook(() => useCanAccess("/app/federations"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it("should return false for inaccessible route", async () => {
      mockedInitKeycloak.mockResolvedValue(true);
      mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

      const { result } = renderHook(() => useCanAccess("/app/federations"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(false));
    });

    it("should return false when not authenticated", async () => {
      mockedInitKeycloak.mockResolvedValue(false);

      const { result } = renderHook(() => useCanAccess("/app/dashboard"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(false));
    });
  });
});
