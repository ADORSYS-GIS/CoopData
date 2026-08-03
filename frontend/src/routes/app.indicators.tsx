import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/app-shell";
import { NonFinancialCatalogManager } from "@/components/submissions/non-financial-catalog-manager";
import { useTranslation } from "react-i18next";

function IndicatorsRoute() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AppShell
        title={t("submissions.catalogManager.routeTitle")}
        subtitle={t("submissions.catalogManager.routeSubtitle")}
      >
        <NonFinancialCatalogManager />
      </AppShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/indicators")({
  component: IndicatorsRoute,
});
