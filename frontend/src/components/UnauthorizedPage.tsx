import { ShieldX, ArrowLeft } from "lucide-react";
import { login as keycloakLogin } from "@/services/shared/authService";

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
          <ShieldX className="size-8 text-destructive" />
        </div>
        <h1 className="mt-6 text-4xl font-heading font-bold tracking-tight text-foreground">
          Access Denied
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          You don't have the required permissions to access this page. If you believe this is an
          error, please contact your administrator.
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your account may not have been assigned a role yet. Reach out to your organization
          administrator to get access.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="size-4" />
            Return Home
          </a>
          <button
            onClick={() => keycloakLogin()}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Sign in with different account
          </button>
        </div>
      </div>
    </div>
  );
}
