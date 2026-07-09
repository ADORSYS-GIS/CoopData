import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CooperativeProfilePage } from "@/pages/apex/CooperativeProfilePage";

function CooperativeProfileRoute() {
  return (
    <ProtectedRoute allowedRoles={["apex"]}>
      <CooperativeProfilePage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/cooperative-profile/$cooperativeId")({
  component: CooperativeProfileRoute,
});
