import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { BasicAnalyticsDashboard } from "@/pages/shared/BasicAnalyticsDashboard";
import { basicDashboardFixture } from "@/test-fixtures/basicDashboard";

const mockState = vi.hoisted(() => ({ role: "ministry", loading: false, empty: false }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key.split(".").pop() ?? key,
  }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Card: ({ title, children }: { title?: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ role: mockState.role }) }));

vi.mock("@/hooks/cooperatives/useCooperatives", () => ({
  useCooperatives: () => ({ data: [{ id: "a", name: "SNAT" }] }),
}));

vi.mock("@/hooks/analytics/useBasicDashboard", () => ({
  useBasicDashboard: () => ({
    data: mockState.empty
      ? {
          ...basicDashboardFixture,
          scope: { ...basicDashboardFixture.scope, cooperatives_reporting: 0 },
        }
      : basicDashboardFixture,
    isLoading: mockState.loading,
    error: null,
  }),
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

describe("BasicAnalyticsDashboard", () => {
  it("renders the indicator groups, the ranking table and the scope header", () => {
    mockState.empty = false;
    render(<BasicAnalyticsDashboard />);
    expect(screen.getByText("risk")).toBeTruthy();
    expect(screen.getByText("membership")).toBeTruthy();
    expect(screen.getAllByText("SNAT").length).toBeGreaterThan(0);
    expect(screen.getByText("consolidated")).toBeTruthy();
  });

  it("shows the empty state when no cooperative reported", () => {
    mockState.empty = true;
    render(<BasicAnalyticsDashboard />);
    expect(screen.getByText("empty")).toBeTruthy();
    expect(screen.queryByText("membership")).toBeNull();
  });
});
