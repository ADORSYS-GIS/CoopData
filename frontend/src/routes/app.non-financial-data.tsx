import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NonFinancialDataPage } from "@/pages/cooperative/NonFinancialDataPage";

function NonFinancialDataRoute() {
  return (
    <ProtectedRoute allowedRoles={["cooperative"]}>
      <NonFinancialDataPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/non-financial-data")({
  component: NonFinancialDataRoute,
});
