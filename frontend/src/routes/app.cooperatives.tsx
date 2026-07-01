import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CooperativesPage } from "@/pages/apex/CooperativesPage";

function CooperativesRoute() {
  return (
    <ProtectedRoute allowedRoles={["apex"]}>
      <CooperativesPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/cooperatives")({
  component: CooperativesRoute,
});
