// frontend/src/routes/app.data-privacy.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DataPrivacyPage } from "@/pages/shared/DataPrivacyPage";

function DataPrivacyRoute() {
  return (
    <ProtectedRoute>
      <DataPrivacyPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/data-privacy")({
  component: DataPrivacyRoute,
});
