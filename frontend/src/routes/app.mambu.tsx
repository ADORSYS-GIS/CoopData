import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MambuSyncPage } from "@/pages/ministry/MambuSyncPage";

function MambuRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry", "apex", "cooperative"]}>
      <MambuSyncPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/mambu")({
  component: MambuRoute,
});
