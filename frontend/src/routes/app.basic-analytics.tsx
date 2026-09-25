import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BasicAnalyticsDashboard } from "@/pages/shared/BasicAnalyticsDashboard";

function BasicAnalyticsRoute() {
  return (
    <ProtectedRoute>
      <BasicAnalyticsDashboard />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/basic-analytics")({
  component: BasicAnalyticsRoute,
});
