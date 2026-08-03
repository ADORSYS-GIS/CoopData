import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/app-shell";
import { QuestionnaireTemplatesPage } from "@/pages/ministry/QuestionnaireTemplatesPage";

function QuestionnaireTemplatesRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AppShell
        title="Questionnaire Forms"
        subtitle="Manage dynamic forms filled by basic-tier cooperatives"
      >
        <QuestionnaireTemplatesPage />
      </AppShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/questionnaire-templates")({
  component: QuestionnaireTemplatesRoute,
});
