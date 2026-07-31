import React, { Component, ErrorInfo, ReactNode } from "react";

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
    console.error(
      `Uncaught error in step boundary [${this.props.stepName || "unknown"}]:`,
      error,
      errorInfo,
    );
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 rounded-2xl border border-dashed border-danger/30 bg-danger/5 text-center my-4">
            <h4 className="text-sm font-bold text-danger">Something went wrong in this step.</h4>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
              Failed to load or render {this.props.stepName || "this section"}. This error has been
              logged.
            </p>
            {this.state.error && (
              <pre className="mt-3 p-3 bg-muted/60 rounded-xl text-[10px] text-left overflow-auto font-mono text-muted-foreground max-h-32 border border-border">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
