import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CooperativeDetailPage } from "@/pages/apex/CooperativeDetailPage";

function CooperativeDetailRoute() {
  return (
    <ProtectedRoute allowedRoles={["apex"]}>
      <CooperativeDetailPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/cooperative/$cooperativeId")({
  component: CooperativeDetailRoute,
});
