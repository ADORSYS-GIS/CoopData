import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Stub import.meta.env defaults for tests
vi.stubEnv("DEV", false);

// Mock window.matchMedia — not implemented in jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver — not implemented in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue) return options.defaultValue;
      const keysMap: Record<string, string> = {
        "insights.title": "Performance Insights",
        "insights.noBenchmark": "No benchmark data available yet",
        "insights.noBenchmarkDesc":
          "Sector benchmarks will appear once enough cooperatives have approved submissions.",
        "insights.inLine": "All metrics within 5% of sector average",
        "insights.inLineDesc": "Your cooperative is performing in line with sector peers.",
        "insights.yourValue": "Your value",
        "insights.sectorAvg": "Sector avg",
        "insights.aboveLabel": "▲ Above",
        "insights.belowLabel": "▼ Below",
        "insights.aboveDirection": "above",
        "insights.belowDirection": "below",
        "common.cancel": "Cancel",
        "common.back": "Back",
        "common.loading": "Loading…",
        "common.verifyingCredentials": "Verifying credentials…",
        "deleteDialog.deleteTitle": "Delete {{entity}}",
        "deleteDialog.permanentWarning": "This action is permanent and cannot be undone",
        "deleteDialog.aboutToDelete": "You are about to delete",
        "deleteDialog.calculatingImpact": "Calculating cascade impact…",
        "deleteDialog.permanentlyDelete": "This will permanently delete:",
        "deleteDialog.apexes": "Apexes",
        "deleteDialog.cooperatives": "Cooperatives",
        "deleteDialog.memberAccounts": "Member accounts",
        "deleteDialog.typeToConfirm": "Type",
        "deleteDialog.continue": "Continue",
        "deleteDialog.verifyIdentity": "Verify your identity",
        "deleteDialog.enterPassword": "Enter your password to confirm this destructive action.",
        "deleteDialog.password": "Password",
        "deleteDialog.accountPassword": "Your account password",
        "deleteDialog.authenticatorCode": "Authenticator code (6 digits)",
        "deleteDialog.verifying": "Verifying…",
        "deleteDialog.verifyAndDelete": "Verify & Delete",
        "deleteDialog.deleting": "Deleting {{entity}}…",
        "deleteDialog.cascadeDeleting": "Cascade-deleting all associated entities",
        "deleteDialog.verificationFailed": "Verification failed",
      };
      if (keysMap[key]) {
        let val = keysMap[key];
        if (options) {
          Object.keys(options).forEach((optKey) => {
            val = val.replace(`{{${optKey}}}`, String(options[optKey]));
          });
        }
        return val;
      }
      return key;
    },
    i18n: {
      changeLanguage: () => Promise.resolve(),
      language: "en",
    },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
}));
