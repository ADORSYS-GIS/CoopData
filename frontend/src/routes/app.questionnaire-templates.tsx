import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/app-shell";
import { QuestionnaireTemplatesPage } from "@/pages/ministry/QuestionnaireTemplatesPage";
import { useTranslation } from "react-i18next";

function QuestionnaireTemplatesRoute() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AppShell
        title={t("questionnaireTemplates.title")}
        subtitle={t("questionnaireTemplates.desc")}
      >
        <QuestionnaireTemplatesPage />
      </AppShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/questionnaire-templates")({
  component: QuestionnaireTemplatesRoute,
});
