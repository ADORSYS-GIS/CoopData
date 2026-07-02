import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FederationsPage } from "@/pages/ministry/FederationsPage";

function FederationsRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <FederationsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/federations")({
  component: FederationsRoute,
});
