import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: router.pathname } }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import { CookieConsentBanner } from "./CookieConsentBanner";

// The test setup mocks react-i18next so `t()` returns the translation key.
const BANNER_TITLE = "cookie.title";

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("asks for consent on normal pages", () => {
    router.pathname = "/app/dashboard";

    render(<CookieConsentBanner />);

    expect(screen.getByText(BANNER_TITLE)).toBeInTheDocument();
  });

  it("never appears on print pages, which are turned into PDFs", () => {
    router.pathname = "/print/questionnaire/123";

    render(<CookieConsentBanner />);

    expect(screen.queryByText(BANNER_TITLE)).not.toBeInTheDocument();
  });
});
