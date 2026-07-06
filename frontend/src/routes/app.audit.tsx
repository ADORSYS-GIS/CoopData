import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuditPage } from "@/pages/ministry/AuditPage";

function AuditRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AuditPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/audit")({
  component: AuditRoute,
});
