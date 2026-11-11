import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelSyncButton } from "./CancelSyncButton";

const cancel = vi.fn();

vi.mock("@/hooks/mambu/useMambu", () => ({
  useCancelMambuSync: () => ({ mutate: cancel, isPending: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("CancelSyncButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for a confirmation before it cancels", async () => {
    render(<CancelSyncButton runId="run-1" />);

    await userEvent.click(screen.getByRole("button", { name: /cancel sync/i }));

    expect(screen.getByText(/cancel this sync/i)).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels the run once it is confirmed", async () => {
    render(<CancelSyncButton runId="run-1" />);

    await userEvent.click(screen.getByRole("button", { name: /cancel sync/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel the sync/i }));

    expect(cancel).toHaveBeenCalledWith("run-1", expect.any(Object));
  });

  it("does not cancel when the dialog is dismissed", async () => {
    render(<CancelSyncButton runId="run-1" />);

    await userEvent.click(screen.getByRole("button", { name: /cancel sync/i }));
    await userEvent.click(screen.getByRole("button", { name: /keep running/i }));

    expect(cancel).not.toHaveBeenCalled();
  });
});
