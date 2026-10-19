import { createFileRoute } from "@tanstack/react-router";
import { CooperativeReportPrint } from "@/pages/shared/CooperativeReportPrint";

export const Route = createFileRoute("/print/cooperative/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { id } = Route.useParams();
  const { token, lng } = Route.useSearch() as { token?: string; lng?: string };

  return <CooperativeReportPrint submissionId={id} tokenOverride={token} lng={lng} />;
}
