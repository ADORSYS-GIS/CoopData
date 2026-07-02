import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SettingsPage } from "@/pages/ministry/SettingsPage";

function SettingsRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <SettingsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});
