import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AnalyticsPage } from "@/pages/shared/AnalyticsPage";

function AnalyticsRoute() {
  return (
    <ProtectedRoute>
      <AnalyticsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsRoute,
});
