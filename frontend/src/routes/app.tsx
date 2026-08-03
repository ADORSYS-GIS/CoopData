import { Navigate, Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

function AppLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-accent" />
          <p className="text-sm text-muted-foreground">{t("appLayout.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (user) {
    const role = user.role;
    let missingOrg = false;
    let orgKey = "";

    if (role === "federation" && !user.organizationId) {
      missingOrg = true;
      orgKey = "appLayout.orgFederation";
    } else if (role === "apex" && !user.cooperationId) {
      missingOrg = true;
      orgKey = "appLayout.orgApex";
    } else if (role === "cooperative" && !user.cooperationId) {
      missingOrg = true;
      orgKey = "appLayout.orgCooperative";
    }

    if (missingOrg) {
      const orgLabel = t(orgKey);
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">CoopData</p>
            <h1 className="mt-3 text-xl font-heading font-semibold tracking-tight text-foreground">
              {t("appLayout.missingOrgTitle", { org: orgLabel })}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("appLayout.missingOrgDesc", { org: orgLabel })}
            </p>
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("appLayout.returnHome")}
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return <Outlet />;
}

export const Route = createFileRoute("/app")({
  component: AppLayout,
});
