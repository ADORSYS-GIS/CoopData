import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubmissionsPage } from "@/pages/shared/SubmissionsPage";

function SubmissionsRoute() {
  return (
    <ProtectedRoute>
      <SubmissionsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/submissions")({
  component: SubmissionsRoute,
});
