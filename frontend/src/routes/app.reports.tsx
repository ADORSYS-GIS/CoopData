import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReportsPage } from "@/pages/shared/ReportsPage";

function ReportsRoute() {
  return (
    <ProtectedRoute>
      <ReportsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/reports")({
  component: ReportsRoute,
});
