import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { zar } from "@/components/analytics/national/ledgerMetrics";
import { formatNumber } from "@/lib/mock-data";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Card: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <section>
      {action}
      {children}
    </section>
  ),
  StatusPill: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StatCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={label}>{value}</div>
  ),
}));

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/shared/DeleteConfirmationDialog", () => ({
  DeleteConfirmationDialog: () => null,
}));

vi.mock("@/hooks/auth/useVerifyIdentity", () => ({
  useVerifyIdentity: () => ({ verifyIdentity: vi.fn() }),
}));

const idleMutation = { mutate: vi.fn(), isPending: false };
vi.mock("@/hooks/federations/useFederations", () => ({
  useFederations: () => ({
    data: [
      {
        id: "f1",
        name: "Federation One",
        enabled: true,
        domains: [],
        apex_count: 1,
        cooperative_count: 5,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateFederation: () => idleMutation,
  useUpdateFederation: () => idleMutation,
  useDeleteFederation: () => idleMutation,
  useFederationDeletePreview: () => ({ data: undefined, isLoading: false }),
}));

const nfStatistics = vi.fn();
const monthlyTrend = vi.fn();
vi.mock("@/hooks/analytics/useNfStatistics", () => ({
  useNfStatistics: () => nfStatistics(),
}));
vi.mock("@/hooks/analytics/useMonthlyTrend", () => ({
  useMonthlyTrend: () => monthlyTrend(),
}));

import { FederationsPage } from "../FederationsPage";

const month = (n: number, assets: number) => ({
  month: n,
  month_label: `M${n}`,
  savings: 0,
  loans: 0,
  liquid_assets: 0,
  assets,
  liabilities: 0,
  equity: assets,
});

const membersCard = () => screen.getByTestId("federationsPage.totalMembers");
const portfolioCard = () => screen.getByTestId("federationsPage.combinedPortfolio");

describe("FederationsPage stat cards", () => {
  beforeEach(() => {
    nfStatistics.mockReset();
    monthlyTrend.mockReset();
  });

  it("shows the national member total from member records, not a per-federation guess", () => {
    nfStatistics.mockReturnValue({ data: { membership: { total: 82600 } }, isLoading: false });
    monthlyTrend.mockReturnValue({ data: { months: [] }, isLoading: false });

    render(<FederationsPage />);

    expect(membersCard()).toHaveTextContent(formatNumber(82600));
    expect(membersCard()).not.toHaveTextContent(formatNumber(600));
  });

  it("shows total assets from the latest month with approved statements", () => {
    nfStatistics.mockReturnValue({ data: { membership: { total: 0 } }, isLoading: false });
    monthlyTrend.mockReturnValue({
      data: { months: [month(1, 2_900_000_000), month(2, 3_600_000_000), month(3, 0)] },
      isLoading: false,
    });

    render(<FederationsPage />);

    expect(portfolioCard()).toHaveTextContent(zar(3_600_000_000));
  });

  it("shows a dash instead of zero when no approved data exists yet", () => {
    nfStatistics.mockReturnValue({ data: { membership: { total: 0 } }, isLoading: false });
    monthlyTrend.mockReturnValue({ data: { months: [month(1, 0)] }, isLoading: false });

    render(<FederationsPage />);

    expect(membersCard()).toHaveTextContent("—");
    expect(portfolioCard()).toHaveTextContent("—");
  });

  it("shows a loading marker while the figures are fetched", () => {
    nfStatistics.mockReturnValue({ data: undefined, isLoading: true });
    monthlyTrend.mockReturnValue({ data: undefined, isLoading: true });

    render(<FederationsPage />);

    expect(membersCard()).toHaveTextContent("...");
    expect(portfolioCard()).toHaveTextContent("...");
  });
});
