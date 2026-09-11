import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LegalCenterPage } from "@/pages/shared/LegalCenterPage";

function LegalRoute() {
  return (
    <ProtectedRoute>
      <LegalCenterPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/legal")({
  component: LegalRoute,
});
