import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ConsentStatusCard } from "./ConsentStatusCard";

vi.mock("@/hooks/auth/useConsent", () => ({
  useConsentStatus: () => ({
    data: { terms_version: "1.0", privacy_version: "1.0" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/shared/useLegalDocuments", () => ({
  useLegalDocuments: () => ({ policies: [{ slug: "data-use", version: 2 }] }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/legal">{children}</a>,
}));

vi.mock("@/components/app-shell", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: { version?: string }) =>
      (fallback ?? key).replace("{{version}}", opts?.version ?? ""),
  }),
}));

describe("ConsentStatusCard", () => {
  it("offers only links to the documents, with no status tags or action buttons", () => {
    render(<ConsentStatusCard />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(8);
  });

  it("shows the current published version of an optional document", () => {
    render(<ConsentStatusCard />);

    expect(screen.getByText("Version 2.0")).toBeInTheDocument();
  });
});
