import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { QuestionnaireAnalyticsPage } from "@/pages/shared/QuestionnaireAnalyticsPage";

function BasicAnalyticsRoute() {
  return (
    <ProtectedRoute>
      <QuestionnaireAnalyticsPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/basic-analytics")({
  component: BasicAnalyticsRoute,
});
