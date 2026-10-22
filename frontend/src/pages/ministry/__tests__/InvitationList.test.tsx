import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Card: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <section>
      {action}
      {children}
    </section>
  ),
  StatCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={label}>{value}</div>
  ),
}));

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({ t: (key: string) => key }),
}));

vi.mock("@/services/shared/networkGuard", () => ({ isAppOffline: () => false }));

const idleMutation = { mutate: vi.fn(), isPending: false };
const federationInvitations = vi.fn();
vi.mock("@/hooks/federations/useFederations", () => ({
  useFederations: () => ({
    data: [{ id: "f1", name: "Federation One", enabled: true, domains: [] }],
    isLoading: false,
  }),
  useFederationInvitations: () => federationInvitations(),
  useInviteUserToFederation: () => idleMutation,
  useResendInvitation: () => idleMutation,
  useDeleteInvitation: () => idleMutation,
}));

import { InvitationList } from "../InvitationList";

const NOW_SECONDS = Math.floor(Date.now() / 1000);
const DAY = 24 * 60 * 60;

const invitation = (email: string, status: string, createdDaysAgo = 1) => ({
  id: email,
  email,
  email_sent: true,
  status,
  created_at: NOW_SECONDS - createdDaysAgo * DAY,
});

const card = (key: string) => screen.getByTestId(`invitationList.${key}`);

describe("InvitationList stat cards", () => {
  beforeEach(() => {
    federationInvitations.mockReturnValue({
      data: [
        invitation("joined.one@example.com", "ACCEPTED"),
        invitation("joined.two@example.com", "ACCEPTED", 60),
        invitation("waiting@example.com", "PENDING"),
        invitation("verified@example.com", "EMAIL_VERIFIED"),
        invitation("lapsed@example.com", "EXPIRED"),
      ],
      isLoading: false,
      error: null,
    });
  });

  it("shows accepted invitations in place of the old 'sent' count", () => {
    render(<InvitationList />);

    expect(card("accepted")).toHaveTextContent("2");
    expect(screen.queryByTestId("invitationList.sent")).not.toBeInTheDocument();
  });

  it("makes the total the sum of accepted and pending", () => {
    render(<InvitationList />);

    expect(card("pending")).toHaveTextContent("2");
    expect(card("totalInvitations")).toHaveTextContent("4");
  });

  it("counts only invitations created in the last 30 days as recent", () => {
    render(<InvitationList />);

    expect(card("last30Days")).toHaveTextContent("3");
  });

  it("lists only pending invitations in the table", () => {
    render(<InvitationList />);

    expect(screen.getByText("waiting@example.com")).toBeInTheDocument();
    expect(screen.getByText("verified@example.com")).toBeInTheDocument();
    expect(screen.queryByText("joined.one@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("lapsed@example.com")).not.toBeInTheDocument();
  });
});
