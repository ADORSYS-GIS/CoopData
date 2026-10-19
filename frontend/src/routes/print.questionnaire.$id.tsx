import { createFileRoute } from "@tanstack/react-router";
import { QuestionnaireReportPrint } from "@/pages/shared/QuestionnaireReportPrint";

export const Route = createFileRoute("/print/questionnaire/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { id } = Route.useParams();
  const { token, lng } = Route.useSearch() as { token?: string; lng?: string };

  return <QuestionnaireReportPrint submissionId={id} tokenOverride={token} lng={lng} />;
}
