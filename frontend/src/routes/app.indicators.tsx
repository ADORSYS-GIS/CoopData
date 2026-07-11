import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/app-shell";
import { NonFinancialCatalogManager } from "@/components/submissions/non-financial-catalog-manager";

function IndicatorsRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AppShell
        title="Non-Financial Indicators"
        subtitle="Configure the periodic KPIs that cooperatives must report each submission cycle"
      >
        <NonFinancialCatalogManager />
      </AppShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/indicators")({
  component: IndicatorsRoute,
});
