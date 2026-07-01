import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FinancialStatementPage } from "@/pages/cooperative/FinancialStatementPage";

function FinancialStatementRoute() {
  return (
    <ProtectedRoute allowedRoles={["cooperative"]}>
      <FinancialStatementPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/financial-statement")({
  component: FinancialStatementRoute,
});
