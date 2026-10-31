/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MambuRunForm } from "./MambuRunForm";
import { apiClient } from "@/openapi-client";
import { previousMonth } from "./mambuFormat";

vi.mock("@/openapi-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; period?: string }) =>
      (opts?.defaultValue ?? _key).replace("{{period}}", opts?.period ?? ""),
  }),
}));

const renderForm = (props: Partial<React.ComponentProps<typeof MambuRunForm>> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onStarted = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MambuRunForm configured running={false} onStarted={onStarted} {...props} />
    </QueryClientProvider>,
  );
  return { onStarted };
};

describe("MambuRunForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables the button when Mambu is not configured", () => {
    renderForm({ configured: false });
    expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeDisabled();
  });

  it("disables the button while a sync is running", () => {
    renderForm({ running: true });
    expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeDisabled();
  });

  it("asks for confirmation, then starts the sync for the previous month", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { id: "run-9", status: "running" },
      error: undefined,
    } as any);
    const { onStarted } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sync with mambu/i }));
    expect(await screen.findByText(/waiting for your review/i)).toBeInTheDocument();
    expect(apiClient.POST).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole("button", { name: /sync with mambu/i });
    await user.click(buttons[buttons.length - 1]);

    const expected = previousMonth(new Date());
    await waitFor(() =>
      expect(apiClient.POST).toHaveBeenCalledWith("/api/v1/ministry/mambu/syncs", {
        body: { year: expected.year, month: expected.month },
      }),
    );
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith("run-9"));
  });
});
