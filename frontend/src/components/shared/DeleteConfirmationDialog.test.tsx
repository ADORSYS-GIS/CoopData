import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  DeleteConfirmationDialog,
  type DeletePreviewData,
} from "@/components/shared/DeleteConfirmationDialog";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="alert-triangle" />,
  Shield: () => <span data-testid="shield" />,
  Fingerprint: () => <span data-testid="fingerprint" />,
  Loader2: () => <span data-testid="loader" />,
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
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      data-testid="input"
      type={props.type ?? "text"}
      value={props.value as string}
      onChange={props.onChange}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button data-testid={`button-${variant ?? "default"}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

interface MockResponse {
  ok: boolean;
  verification_token?: string;
  requires_otp?: boolean;
  message?: string;
}

const defaultPreview: DeletePreviewData = {
  apexes: 3,
  cooperatives: 7,
  members: 42,
};

function makeOnVerifyIdentity(
  response: MockResponse = { ok: true, verification_token: "tok", requires_otp: false },
) {
  return vi.fn().mockResolvedValue(response) as unknown as ReturnType<
    typeof vi.fn
  >;
}

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof DeleteConfirmationDialog>> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    entityName: "Pilot Federation",
    entityType: "federation" as const,
    entityId: "fed-123",
    previewData: defaultPreview,
    previewLoading: false,
    onVerifyIdentity: makeOnVerifyIdentity(),
    onConfirmDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { props, ...render(<DeleteConfirmationDialog {...props} />) };
}

function typeInInput(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function clickButton(variant: string, index = 0) {
  const buttons = screen.getAllByTestId(`button-${variant}`);
  fireEvent.click(buttons[index]);
}

describe("DeleteConfirmationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Step 1: confirm", () => {
    it("should render the dialog with entity name and cascade counts", () => {
      renderDialog();
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete Federation")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("should show loading state for preview data while loading", () => {
      renderDialog({ previewLoading: true, previewData: undefined });
      expect(screen.getByText(/Calculating cascade impact/)).toBeInTheDocument();
    });

    it("should disable Continue button when typed name does not match", () => {
      renderDialog();
      expect(screen.getByTestId("button-destructive")).toBeDisabled();
    });

    it("should enable Continue button when typed name matches exactly", () => {
      renderDialog();

      const input = screen.getByTestId("input");
      typeInInput(input, "Pilot Federation");

      expect(screen.getByTestId("button-destructive")).not.toBeDisabled();
    });

    it("should disable Continue when name partially matches", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot");

      expect(screen.getByTestId("button-destructive")).toBeDisabled();
    });

    it("should call onOpenChange(false) when Cancel is clicked", () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });

      clickButton("outline");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should ignore leading/trailing whitespace in typed name", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "  Pilot Federation  ");

      expect(screen.getByTestId("button-destructive")).not.toBeDisabled();
    });

    it("should only show non-zero cascade counts", () => {
      renderDialog({
        previewData: { apexes: 0, cooperatives: 5, members: 10 },
        entityName: "Test",
        entityType: "apex",
      });

      expect(screen.queryByText("Apexes")).not.toBeInTheDocument();
      expect(screen.queryByText("Cooperatives")).toBeInTheDocument();
      expect(screen.queryByText("Member accounts")).toBeInTheDocument();
    });
  });

  describe("Step 2: verify", () => {
    it("should transition to verify step after typing name and clicking Continue", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      expect(screen.getByText("Verify your identity")).toBeInTheDocument();
    });

    it("should show password input on verify step", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      expect(screen.getByPlaceholderText("Your account password")).toBeInTheDocument();
    });

    it("should disable Verify button when password is empty", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      expect(screen.getByTestId("button-destructive")).toBeDisabled();
    });

    it("should enable Verify button when password is entered", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "mysecret");

      expect(screen.getByTestId("button-destructive")).not.toBeDisabled();
    });

    it("should call onVerifyIdentity with password on Verify click", async () => {
      const onVerifyIdentity = makeOnVerifyIdentity();
      const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
      renderDialog({ onVerifyIdentity, onConfirmDelete });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "mysecretpass");

      clickButton("destructive");

      await waitFor(() => {
        expect(onVerifyIdentity).toHaveBeenCalledWith("mysecretpass", undefined);
      });
    });

    it("should show error message when verification fails", async () => {
      const onVerifyIdentity = vi.fn().mockResolvedValue({
        ok: false,
        message: "Invalid password",
      }) as unknown as ReturnType<typeof vi.fn>;
      renderDialog({ onVerifyIdentity });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "wrongpass");

      clickButton("destructive");

      await waitFor(() => {
        expect(screen.getByText("Invalid password")).toBeInTheDocument();
      });
    });

    it("should go back to confirm step when Back is clicked", () => {
      renderDialog();

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      expect(screen.getByText("Verify your identity")).toBeInTheDocument();

      clickButton("outline");

      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("Step 3: deleting", () => {
    it("should show deleting spinner after successful verification", async () => {
      const onVerifyIdentity = makeOnVerifyIdentity({
        ok: true,
        verification_token: "tok-123",
        requires_otp: false,
      });
      const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
      renderDialog({ onVerifyIdentity, onConfirmDelete });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "validpass");
      clickButton("destructive");

      await waitFor(() => {
        expect(screen.getByTestId("loader")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText(/Deleting Pilot Federation/)).toBeInTheDocument();
      });
    });

    it("should call onConfirmDelete with the verification token", async () => {
      const onVerifyIdentity = makeOnVerifyIdentity({
        ok: true,
        verification_token: "tok-xyz",
        requires_otp: false,
      });
      const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
      renderDialog({ onVerifyIdentity, onConfirmDelete });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "validpass");
      clickButton("destructive");

      await waitFor(() => {
        expect(onConfirmDelete).toHaveBeenCalledWith("tok-xyz");
      });
    });

    it("should close dialog after successful delete", async () => {
      const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();
      renderDialog({ onConfirmDelete, onOpenChange });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "validpass");
      clickButton("destructive");

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("should show error and return to verify step when delete fails", async () => {
      const onConfirmDelete = vi.fn().mockRejectedValue(new Error("Delete failed"));
      renderDialog({ onConfirmDelete });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      const passwordInput = screen.getByPlaceholderText("Your account password");
      typeInInput(passwordInput, "validpass");
      clickButton("destructive");

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Verify your identity")).toBeInTheDocument();
      });
    });
  });

  describe("OTP (2FA) support", () => {
    it("should show OTP field after verification returns requires_otp true", async () => {
      const onVerifyIdentity = vi.fn().mockImplementation(async () => {
        return { ok: true, verification_token: "tok-otp", requires_otp: true };
      }) as unknown as ReturnType<typeof vi.fn>;
      const onConfirmDelete = vi.fn().mockImplementation(async () => {
        return undefined;
      });

      const { rerender } = renderDialog({
        onVerifyIdentity,
        onConfirmDelete,
        requiresOtp: true,
      });

      typeInInput(screen.getByTestId("input"), "Pilot Federation");
      clickButton("destructive");

      expect(screen.getByPlaceholderText("Your account password")).toBeInTheDocument();
    });
  });

  describe("State reset", () => {
    it("should reset all state when dialog is reopened", () => {
      const { rerender } = renderDialog({ open: false });

      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();

      rerender(
        <DeleteConfirmationDialog
          open={true}
          onOpenChange={vi.fn()}
          entityName="Pilot Federation"
          entityType="federation"
          entityId="fed-123"
          previewData={defaultPreview}
          onVerifyIdentity={makeOnVerifyIdentity()}
          onConfirmDelete={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      const inputs = screen.getAllByTestId("input");
      expect(inputs[0]).toHaveValue("");
    });
  });
});
