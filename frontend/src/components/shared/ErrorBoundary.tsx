import React, { Component, ErrorInfo, ReactNode } from "react";
import i18next from "i18next";

/**
 * ErrorBoundary wraps React components to catch and handle rendering errors gracefully.
 *
 * Wraps child components and catches any errors thrown during their render lifecycle.
 * When an error occurs:
 * - Displays a safe, user-friendly error message to users
 * - Logs full error details to browser DevTools Console (F12) for debugging
 *
 * Security behavior:
 * - Raw errors are NEVER shown in the UI (prevents information disclosure)
 * - All errors are logged to browser DevTools Console for debugging
 *
 * Usage: Wrap any component that might throw errors (e.g., form wizards, data grids)
 */
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  stepName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to DevTools Console for debugging
    // (Users never see this in the UI)
    console.error(
      `[ErrorBoundary] Uncaught error in "${this.props.stepName || "unknown"}"]:`,
      error,
      errorInfo,
    );
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 rounded-2xl border border-dashed border-danger/30 bg-danger/5 text-center my-4">
            <h4 className="text-sm font-bold text-danger">{i18next.t("errorBoundary.title")}</h4>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
              {i18next.t("errorBoundary.desc", {
                section: this.props.stepName || i18next.t("errorBoundary.thisSection"),
              })}
            </p>
            {/*
              Raw errors are NEVER shown in the UI.
              Check DevTools Console (F12) to see error details for debugging.
            */}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
