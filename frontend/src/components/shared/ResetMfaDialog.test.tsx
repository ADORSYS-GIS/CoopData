import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResetMfaDialog } from "@/components/shared/ResetMfaDialog";

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader" />,
  RefreshCcw: () => <span data-testid="refresh" />,
  Eye: () => <span data-testid="eye" />,
  EyeOff: () => <span data-testid="eye-off" />,
  Smartphone: () => <span data-testid="smartphone" />,
  AlertTriangle: () => <span data-testid="alert-triangle" />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-desc">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

const resetMfaMock = vi.fn();
vi.mock("@/hooks/auth/useSecuritySettings", () => ({
  useResetMfa: () => ({
    mutateAsync: resetMfaMock,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const keycloakLoginMock = vi.fn();
vi.mock("@/services/shared/authService", () => ({
  keycloak: { login: (...args: unknown[]) => keycloakLoginMock(...args) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

function renderDialog(open = true) {
  return render(<ResetMfaDialog open={open} onOpenChange={vi.fn()} />);
}

function typePassword(value: string) {
  const inputs = screen.getAllByPlaceholderText("••••••••");
  fireEvent.change(inputs[0], { target: { value } });
}

function typeOtp(value: string) {
  const otp = screen.getByPlaceholderText("123456");
  fireEvent.change(otp, { target: { value } });
}

function clickReset() {
  fireEvent.click(screen.getByText("Reset & Get New Code"));
}

describe("ResetMfaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMfaMock.mockResolvedValue({ mfa_enabled: true, mfa_configured: false });
    keycloakLoginMock.mockResolvedValue(undefined);
  });

  it("should render the dialog when open", () => {
    renderDialog();
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("Change Authenticator Device")).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("should call resetMfa with password and OTP on success", async () => {
    renderDialog();
    typePassword("mysecret");
    typeOtp("123456");
    clickReset();

    await waitFor(() => {
      expect(resetMfaMock).toHaveBeenCalledWith({ password: "mysecret", otp: "123456" });
    });
  });

  it("should disable the reset button until password and 6-digit OTP are provided", () => {
    renderDialog();
    const button = screen.getByText("Reset & Get New Code") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    typePassword("mysecret");
    expect(button.disabled).toBe(true);

    typeOtp("1234");
    expect(button.disabled).toBe(true);

    typeOtp("123456");
    expect(button.disabled).toBe(false);
  });

  it("should call resetMfa without OTP in lost-device mode", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("I lost my phone"));

    // Lost-device mode shows the bypass panel and hides the OTP input.
    expect(screen.getByText("Lost Device Mode Active")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("123456")).not.toBeInTheDocument();

    typePassword("mysecret");
    clickReset();

    await waitFor(() => {
      expect(resetMfaMock).toHaveBeenCalledWith({ password: "mysecret", otp: undefined });
    });
  });

  it("should allow returning to the standard method from lost-device mode", () => {
    renderDialog();
    fireEvent.click(screen.getByText("I lost my phone"));
    expect(screen.getByText("Lost Device Mode Active")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Use Authenticator App"));
    expect(screen.queryByText("Lost Device Mode Active")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("123456")).toBeInTheDocument();
  });

  it("should redirect through Keycloak to scan a new QR after a successful reset", async () => {
    renderDialog();
    typePassword("mysecret");
    typeOtp("123456");
    clickReset();

    await waitFor(() => {
      expect(keycloakLoginMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CONFIGURE_TOTP" }),
      );
    });
  });
});
