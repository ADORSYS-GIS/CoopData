import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfilePage } from "@/pages/shared/ProfilePage";

function ProfileRoute() {
  return (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/profile")({
  component: ProfileRoute,
});
