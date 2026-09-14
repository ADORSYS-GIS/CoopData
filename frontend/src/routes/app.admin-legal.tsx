import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLegalPolicyEditPage } from "@/pages/admin/AdminLegalPolicyEditPage";

function AdminLegalRoute() {
  return (
    <ProtectedRoute>
      <AdminLegalPolicyEditPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/admin-legal")({
  component: AdminLegalRoute,
});
