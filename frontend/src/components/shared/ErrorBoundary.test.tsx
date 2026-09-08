import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { ReactNode } from "react";

// Mock i18next - ErrorBoundary imports i18next directly
vi.mock("i18next", () => ({
  default: {
    t: (key: string, options?: Record<string, unknown>) => {
      let translation = key;
      const translations: Record<string, string> = {
        "errorBoundary.title": "Something went wrong",
        "errorBoundary.desc": "An error occurred in {{section}}",
        "errorBoundary.thisSection": "this section",
      };
      if (translations[key]) {
        translation = translations[key];
        // Interpolate options
        if (options) {
          Object.keys(options).forEach((optKey) => {
            translation = translation.replace(
              new RegExp(`\\{\\{${optKey}\\}\\}`, "g"),
              String(options[optKey]),
            );
          });
        }
      }
      return translation;
    },
  },
  t: (key: string, options?: Record<string, unknown>) => {
    let translation = key;
    const translations: Record<string, string> = {
      "errorBoundary.title": "Something went wrong",
      "errorBoundary.desc": "An error occurred in {{section}}",
      "errorBoundary.thisSection": "this section",
    };
    if (translations[key]) {
      translation = translations[key];
      // Interpolate options
      if (options) {
        Object.keys(options).forEach((optKey) => {
          translation = translation.replace(
            new RegExp(`\\{\\{${optKey}\\}\\}`, "g"),
            String(options[optKey]),
          );
        });
      }
    }
    return translation;
  },
}));

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DEV to false (as per setup.ts default)
    vi.stubEnv("DEV", false);
  });

  // Helper component that throws during render
  function RenderError({ message }: { message?: string }) {
    throw new Error(message || "Render error");
  }

  describe("Error Catching", () => {
    it("should catch errors thrown during render and show fallback UI", () => {
      render(
        <ErrorBoundary>
          <RenderError message="Test error message" />
        </ErrorBoundary>,
      );

      // Should show error UI instead of crashing
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should render children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <div data-testid="success">Content rendered successfully</div>
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("success")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("should catch errors at any nesting level", () => {
      render(
        <ErrorBoundary>
          <div>
            <div>
              <RenderError message="Nested error" />
            </div>
          </div>
        </ErrorBoundary>,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("Error Display", () => {
    it("should show user-friendly error message", () => {
      render(
        <ErrorBoundary>
          <RenderError />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should include step name in error description when provided", () => {
      render(
        <ErrorBoundary stepName="Financial Data Entry">
          <RenderError />
        </ErrorBoundary>,
      );

      // Should show the step name in the description
      expect(screen.getByText(/Financial Data Entry/)).toBeInTheDocument();
    });

    it("should NEVER show raw error in UI (even in DEV mode)", () => {
      vi.stubEnv("DEV", true);

      render(
        <ErrorBoundary>
          <RenderError message="This should NEVER appear in UI" />
        </ErrorBoundary>,
      );

      // Raw error should NEVER be shown in the UI
      expect(screen.queryByText(/This should NEVER appear in UI/)).not.toBeInTheDocument();
    });
  });

  describe("Custom Fallback", () => {
    it("should render custom fallback when provided", () => {
      const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <RenderError />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
  });

  describe("Error Logging", () => {
    it("should log errors to console for debugging", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <ErrorBoundary stepName="Test Step">
          <RenderError message="Logged error" />
        </ErrorBoundary>,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ErrorBoundary]"),
        expect.any(Error),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });
  });
});
