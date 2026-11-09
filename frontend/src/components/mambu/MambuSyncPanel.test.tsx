/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MambuSyncPanel } from "./MambuSyncPanel";

const start = vi.fn();
const cooperatives = [
  {
    id: "c1",
    name: "Adorsys SACCO",
    institution_type: "sacco",
    mambu_branch_id: "ES0006",
    link_locked: true,
    auto_sync: true,
    running: false,
    last_synced_at: "2026-11-04T08:00:00Z",
    last_status: "synced",
    last_error: null,
    last_submission_id: "s1",
    last_warning_count: 0,
    last_unmapped_accounts: 0,
  },
  {
    id: "c2",
    name: "Second SACCO",
    institution_type: "sacco",
    mambu_branch_id: "ES0007",
    link_locked: false,
    auto_sync: false,
    running: false,
    last_synced_at: null,
    last_status: null,
    last_error: null,
    last_submission_id: null,
    last_warning_count: 0,
    last_unmapped_accounts: 0,
  },
  {
    id: "c3",
    name: "Unlinked SACCO",
    institution_type: "sacco",
    mambu_branch_id: null,
    link_locked: false,
    auto_sync: false,
    running: false,
    last_synced_at: null,
    last_status: null,
    last_error: null,
    last_submission_id: null,
    last_warning_count: 0,
    last_unmapped_accounts: 0,
  },
];

vi.mock("@/hooks/mambu/useMambu", () => ({
  useMambuStatus: () => ({ data: { configured: true }, isLoading: false }),
  useMambuCooperatives: () => ({ data: cooperatives, isLoading: false }),
  useMambuSyncs: () => ({ data: [], isLoading: false }),
  useSetMambuAutoSync: () => ({ mutate: vi.fn() }),
  useStartMambuSync: () => ({ mutate: start, isPending: false }),
  useMambuSync: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/mambu/useMambuScoped", () => ({
  useSearchMambuBranches: () => ({ mutate: vi.fn(), data: [], isSuccess: false, error: null }),
  useSetMambuLink: () => ({ mutate: vi.fn(), isPending: false }),
  useClearMambuLink: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? ""),
      ),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock("@/components/app-shell", () => ({
  Card: ({ title, action, children }: any) => (
    <section>
      <h2>{title}</h2>
      {action}
      {children}
    </section>
  ),
  StatusPill: ({ children }: any) => <span>{children}</span>,
}));

describe("MambuSyncPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows how many cooperatives are linked and which are not", () => {
    render(<MambuSyncPanel />);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByText("Up to date")).toBeInTheDocument();
  });

  it("selects every linked cooperative at first, and never an unlinked one", () => {
    render(<MambuSyncPanel />);
    expect(screen.getByRole("button", { name: /sync 2 selected/i })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Select Unlinked SACCO" })).toBeDisabled();
  });

  it("syncs only the cooperatives the apex chose", async () => {
    const user = userEvent.setup();
    render(<MambuSyncPanel />);
    await user.click(screen.getByRole("checkbox", { name: "Select Second SACCO" }));
    await user.click(screen.getByRole("button", { name: /sync 1 selected/i }));
    await user.click(screen.getByRole("button", { name: "Sync with Mambu" }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toEqual({
      year: new Date().getFullYear(),
      cooperativeIds: ["c1"],
    });
  });

  it("cannot start without a chosen cooperative", async () => {
    const user = userEvent.setup();
    render(<MambuSyncPanel />);
    await user.click(screen.getByRole("checkbox", { name: /select all linked cooperatives/i }));
    expect(screen.getByRole("button", { name: /sync 0 selected/i })).toBeDisabled();
  });
});
