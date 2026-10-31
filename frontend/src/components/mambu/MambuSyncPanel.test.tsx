import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MambuSyncPanel } from "./MambuSyncPanel";
import { apiClient } from "@/openapi-client";

vi.mock("@/openapi-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@/components/app-shell", () => ({
  Card: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; minutes?: number }) =>
      (opts?.defaultValue ?? _key).replace("{{minutes}}", String(opts?.minutes ?? "")),
  }),
}));

const mockGet = (status: object) =>
  vi.mocked(apiClient.GET).mockImplementation((async (path: string) => {
    if (path === "/api/v1/cooperative/mambu/status") return { data: status };
    if (path === "/api/v1/cooperative/mambu/syncs") return { data: [] };
    return { error: { message: "unexpected " + path } };
  }) as never);

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MambuSyncPanel scope="cooperative" />
    </QueryClientProvider>,
  );

describe("MambuSyncPanel for a cooperative", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tells a SACCO without a link to ask its apex and blocks the button", async () => {
    mockGet({
      configured: true,
      linked: false,
      mambu_branch_id: null,
      running: false,
      cooldown_seconds_left: 0,
    });
    renderPanel();
    expect(await screen.findByText(/not linked to a mambu branch/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeDisabled();
  });

  it("blocks the button during the cooldown", async () => {
    mockGet({
      configured: true,
      linked: true,
      mambu_branch_id: "ES0006",
      running: false,
      cooldown_seconds_left: 120,
    });
    renderPanel();
    expect(await screen.findByText(/can sync again in 2 minute/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeDisabled();
  });

  it("allows the sync when linked and idle, and never calls the Ministry endpoints", async () => {
    mockGet({
      configured: true,
      linked: true,
      mambu_branch_id: "ES0006",
      running: false,
      cooldown_seconds_left: 0,
    });
    renderPanel();
    await screen.findByText(/no sync has been run yet/i);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeEnabled(),
    );
    const paths = vi.mocked(apiClient.GET).mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.includes("/ministry/"))).toBe(false);
  });
});

describe("MambuSyncPanel for an apex", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the apex status endpoint and enables the sync when Mambu is configured", async () => {
    vi.mocked(apiClient.GET).mockImplementation((async (path: string) => {
      if (path === "/api/v1/apex/mambu/status") return { data: { configured: true } };
      if (path === "/api/v1/apex/mambu/syncs") return { data: [] };
      return { error: { message: "unexpected " + path } };
    }) as never);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MambuSyncPanel scope="apex" />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sync with mambu/i })).toBeEnabled(),
    );
    expect(screen.queryByText(/not configured/i)).not.toBeInTheDocument();
    const paths = vi.mocked(apiClient.GET).mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.includes("/ministry/"))).toBe(false);
  });
});
