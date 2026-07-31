import { ShieldX, ArrowLeft } from "lucide-react";
import { login as keycloakLogin } from "@/services/shared/authService";
import { useTranslation } from "react-i18next";

export function UnauthorizedPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
          <ShieldX className="size-8 text-destructive" />
        </div>
        <h1 className="mt-6 text-4xl font-heading font-bold tracking-tight text-foreground">
          {t("unauthorized.title")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {t("unauthorized.desc")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t("unauthorized.noRole")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="size-4" />
            {t("unauthorized.returnHome")}
          </a>
          <button
            onClick={() => keycloakLogin()}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("unauthorized.signInDifferent")}
          </button>
        </div>
      </div>
    </div>
  );
}
