import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MambuSyncPage } from "@/pages/apex/MambuSyncPage";

function MambuRoute() {
  return (
    <ProtectedRoute allowedRoles={["apex"]}>
      <MambuSyncPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/mambu")({
  component: MambuRoute,
});
