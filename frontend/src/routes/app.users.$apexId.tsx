import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ApexUsersPage } from "@/pages/federation/ApexUsersPage";

function ApexUsersRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry", "federation", "apex"]}>
      <ApexUsersPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/users/$apexId")({
  component: ApexUsersRoute,
});
