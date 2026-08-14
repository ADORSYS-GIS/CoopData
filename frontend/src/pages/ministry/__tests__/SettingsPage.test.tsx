import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
  Card: ({
    title,
    subtitle,
    children,
  }: {
    title?: string;
    subtitle?: string;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </section>
  ),
}));

vi.mock("@/components/submissions/non-financial-catalog-manager", () => ({
  NonFinancialCatalogManager: () => <div data-testid="nf-manager" />,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keysMap: Record<string, string> = {
        "settings.title": "Settings",
        "settings.subtitle": "Platform preferences and shortcuts to important configuration areas",
        "settings.subtitleIndicators": "Configure dynamic reporting requirements for cooperatives",
        "settings.backBtn": "Back to Settings",
        "settings.appearance.title": "Appearance",
        "settings.appearance.subtitle": "Choose how the platform looks for you",
        "settings.appearance.light": "Light",
        "settings.appearance.dark": "Dark",
        "settings.appearance.system": "System",
        "settings.appearance.language": "Language",
        "settings.appearance.languageDesc": "Choose the language for the platform interface",
        "profile.selectLanguage": "Select language",
        "settings.indicators.title": "Non-Financial Indicators",
        "settings.indicators.desc": "Configure dynamic reporting fields for cooperatives.",
        "settings.indicators.open": "Configure indicators",
        "settings.shortcuts.title": "Configuration Shortcuts",
        "settings.shortcuts.subtitle": "These settings live on their own pages",
        "settings.shortcuts.profile.title": "Profile & Security",
        "settings.shortcuts.profile.desc": "Password, MFA, session and language preferences",
        "settings.shortcuts.users.title": "Users & Access",
        "settings.shortcuts.users.desc": "Provision users and manage who can access the platform",
        "settings.shortcuts.audit.title": "Audit Trail",
        "settings.shortcuts.audit.desc": "Review every action recorded across the platform",
        "settings.shortcuts.templates.title": "Questionnaire Templates",
        "settings.shortcuts.templates.desc": "Design the questionnaires cooperatives fill in",
        "settings.shortcuts.kpis.title": "Custom KPIs",
        "settings.shortcuts.kpis.desc": "Define additional performance indicators for cooperatives",
        "settings.shortcuts.invitations.title": "Federation Invitations",
        "settings.shortcuts.invitations.desc":
          "Invite federation officers and track pending invites",
      };
      return keysMap[key] ?? key;
    },
    i18n: { changeLanguage: () => Promise.resolve(), language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import { ThemeProvider } from "@/lib/theme";
import { SettingsPage } from "@/pages/ministry/SettingsPage";

function renderPage() {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders the Appearance card with Light, Dark and System options", () => {
    renderPage();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });

  it("applies dark theme when the Dark option is selected", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("coopdata_theme")).toBe("dark");
  });

  it("renders the language switcher inside the Appearance card", () => {
    renderPage();
    expect(screen.getByText("Language")).toBeInTheDocument();
    // The LanguageSwitcher select trigger renders the current language (English)
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("re-applies light theme when the Light option is selected after dark", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("coopdata_theme")).toBe("light");
  });

  it("renders configuration shortcuts linking to the right pages", () => {
    renderPage();
    expect(screen.getByText("Configuration Shortcuts")).toBeInTheDocument();

    const expected = [
      { title: "Profile & Security", href: "/app/profile" },
      { title: "Users & Access", href: "/app/users" },
      { title: "Audit Trail", href: "/app/audit" },
      { title: "Questionnaire Templates", href: "/app/questionnaire-templates" },
      { title: "Custom KPIs", href: "/app/custom-kpis" },
      { title: "Federation Invitations", href: "/app/invitations" },
    ];

    for (const { title, href } of expected) {
      const link = screen.getByText(title).closest("a");
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("opens the Non-Financial Indicators manager and returns to settings", () => {
    renderPage();
    expect(screen.queryByTestId("nf-manager")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Configure indicators" }));
    expect(screen.getByTestId("nf-manager")).toBeInTheDocument();
    expect(screen.getByText("Back to Settings")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back to Settings"));
    expect(screen.queryByTestId("nf-manager")).not.toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
  });
});
