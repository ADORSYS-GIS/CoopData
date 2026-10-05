import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { ConsentStatusCard } from "./ConsentStatusCard";
import { COOKIE_CONSENT_KEY, setCookieConsentChoice } from "@/lib/cookieConsent";

type Consent = { document_type: string; document_version: string };
let status: {
  terms_accepted: boolean;
  terms_version: string;
  privacy_accepted: boolean;
  privacy_version: string;
  has_accepted_all_required: boolean;
  accepted_consents: Consent[];
};

vi.mock("@/hooks/auth/useConsent", () => ({
  useConsentStatus: () => ({ data: status, isLoading: false }),
  useRecordConsent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shared/useLegalDocuments", () => ({
  useLegalDocuments: () => ({
    policies: [
      { slug: "data-use", version: 2 },
      { slug: "acceptable-use", version: 1 },
    ],
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/app-shell", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const withStatus = (overrides: Partial<typeof status> = {}) => {
  status = {
    terms_accepted: true,
    terms_version: "1.0",
    privacy_accepted: true,
    privacy_version: "1.0",
    has_accepted_all_required: true,
    accepted_consents: [],
    ...overrides,
  };
};

describe("ConsentStatusCard", () => {
  afterEach(() => localStorage.removeItem(COOKIE_CONSENT_KEY));

  it("shows the cookie choice made in the banner and follows its changes", () => {
    withStatus();
    render(<ConsentStatusCard />);

    expect(screen.getByText("legal.cookieChoiceNone")).toBeInTheDocument();

    act(() => setCookieConsentChoice("rejected"));

    expect(screen.getByText("legal.cookieChoiceEssential")).toBeInTheDocument();
  });

  it("asks again for a required document whose accepted version is outdated", () => {
    withStatus({ terms_accepted: false, terms_version: "2.0" });

    render(<ConsentStatusCard />);

    expect(screen.getAllByText("legal.actionNeeded")).toHaveLength(1);
    expect(screen.getByText("legal.accept")).toBeInTheDocument();
  });

  it("counts an optional consent only for the current published version", () => {
    withStatus({
      accepted_consents: [
        { document_type: "DATA_USE_CONSENT", document_version: "1.0" },
        { document_type: "ACCEPTABLE_USE", document_version: "1.0" },
      ],
    });

    render(<ConsentStatusCard />);

    // Data use is at version 2.0, so the 1.0 consent no longer counts.
    expect(screen.getByText("legal.consentNotGiven")).toBeInTheDocument();
    expect(screen.getByText("legal.giveConsent")).toBeInTheDocument();
    expect(screen.getAllByText("legal.acknowledged")).toHaveLength(1);
  });
});
