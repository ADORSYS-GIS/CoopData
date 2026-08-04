import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CustomKpisPage } from "@/pages/ministry/CustomKpisPage";

function CustomKpisRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <CustomKpisPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/custom-kpis")({
  component: CustomKpisRoute,
});
