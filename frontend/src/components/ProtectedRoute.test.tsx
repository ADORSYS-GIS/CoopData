import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { UserProfile } from "@/types/auth";
import type { Role } from "@/constants/roles";

vi.mock("@/services/shared/authService", () => ({
  initKeycloak: vi.fn().mockResolvedValue(false),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockResolvedValue("fake-token"),
  getUserProfile: vi.fn().mockReturnValue(null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({ pathname: "/app/test" }),
}));

vi.mock("@/components/UnauthorizedPage", () => ({
  UnauthorizedPage: () => <div data-testid="unauthorized">Access Denied</div>,
}));

import { initKeycloak, getUserProfile } from "@/services/shared/authService";
import { ProtectedRoute, RoleRedirect } from "@/components/ProtectedRoute";
import { KeycloakAuthProvider } from "@/context/AuthContext";

const mockedInitKeycloak = vi.mocked(initKeycloak);
const mockedGetUserProfile = vi.mocked(getUserProfile);

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

function renderWithProvider(ui: ReactNode) {
  return render(<KeycloakAuthProvider>{ui}</KeycloakAuthProvider>);
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInitKeycloak.mockResolvedValue(false);
    mockedGetUserProfile.mockReturnValue(null);
  });

  it("should show loading spinner while isLoading is true", () => {
    mockedInitKeycloak.mockImplementation(() => new Promise(() => {}));
    renderWithProvider(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Verifying credentials…")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should redirect to login when not authenticated", async () => {
    mockedInitKeycloak.mockResolvedValue(false);

    renderWithProvider(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/auth/login");
    });
  });

  it("should show unauthorized page when authenticated but no user profile", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(null);

    renderWithProvider(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should render children when authenticated with valid user and no role restriction", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

    renderWithProvider(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("should render children when user has allowed role", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

    renderWithProvider(
      <ProtectedRoute allowedRoles={["ministry"]}>
        <div>Ministry Only Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Ministry Only Content")).toBeInTheDocument();
    });
  });

  it("should show unauthorized page when user role is not in allowedRoles", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

    renderWithProvider(
      <ProtectedRoute allowedRoles={["ministry"]}>
        <div>Ministry Only Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
    });
    expect(screen.queryByText("Ministry Only Content")).not.toBeInTheDocument();
  });

  it("should render children when allowedRoles is empty array (no restriction)", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

    renderWithProvider(
      <ProtectedRoute allowedRoles={[]}>
        <div>Open Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Open Content")).toBeInTheDocument();
    });
  });

  it("should render children for federation user with allowedRoles including federation", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("federation"));

    renderWithProvider(
      <ProtectedRoute allowedRoles={["ministry", "federation", "apex"]}>
        <div>Multi Role Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Multi Role Content")).toBeInTheDocument();
    });
  });

  it("should show unauthorized for cooperative user with ministry-only allowedRoles", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

    renderWithProvider(
      <ProtectedRoute allowedRoles={["ministry"]}>
        <div>Ministry Only</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
    });
  });
});

describe("RoleRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInitKeycloak.mockResolvedValue(false);
    mockedGetUserProfile.mockReturnValue(null);
  });

  it("should show unauthorized when no user", async () => {
    mockedInitKeycloak.mockResolvedValue(false);

    renderWithProvider(<RoleRedirect />);

    await waitFor(() => {
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
    });
  });

  it("should redirect to dashboard for ministry user", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("ministry"));

    renderWithProvider(<RoleRedirect />);

    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/app/dashboard");
    });
  });

  it("should redirect to dashboard for cooperative user", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("cooperative"));

    renderWithProvider(<RoleRedirect />);

    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/app/dashboard");
    });
  });

  it("should redirect to dashboard for federation user", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("federation"));

    renderWithProvider(<RoleRedirect />);

    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/app/dashboard");
    });
  });

  it("should redirect to dashboard for apex user", async () => {
    mockedInitKeycloak.mockResolvedValue(true);
    mockedGetUserProfile.mockReturnValue(makeProfile("apex"));

    renderWithProvider(<RoleRedirect />);

    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/app/dashboard");
    });
  });
});
