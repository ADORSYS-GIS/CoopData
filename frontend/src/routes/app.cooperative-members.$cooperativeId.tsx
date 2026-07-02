import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CooperativeMembersPage } from "@/pages/apex/CooperativeMembersPage";

function CooperativeMembersRoute() {
  return (
    <ProtectedRoute allowedRoles={["apex"]}>
      <CooperativeMembersPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/cooperative-members/$cooperativeId")({
  component: CooperativeMembersRoute,
});
