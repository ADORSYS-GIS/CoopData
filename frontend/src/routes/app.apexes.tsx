import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ApexesPage } from "@/pages/federation/ApexesPage";

function ApexesRoute() {
  return (
    <ProtectedRoute allowedRoles={["federation"]}>
      <ApexesPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/apexes")({
  component: ApexesRoute,
});
