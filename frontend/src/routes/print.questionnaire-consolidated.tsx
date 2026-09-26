import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";
import { useBasicDashboard } from "@/hooks/analytics/useBasicDashboard";
import { useGotenbergReady } from "@/hooks/print/useGotenbergReady";
import {
  QuestionnaireConsolidatedReport,
  type QuestionnaireTier,
} from "@/pages/shared/print/questcons/QuestionnaireConsolidatedReport";

export const Route = createFileRoute("/print/questionnaire-consolidated")({
  component: PrintComponent,
});

const TIER: Record<string, QuestionnaireTier> = {
  apex: "Apex",
  federation: "Federation",
  ministry: "Ministry",
};

function PrintComponent() {
  const { t } = useTranslation();
  const { token, year, scope, id, name } = Route.useSearch() as {
    token?: string;
    year?: string;
    scope?: string;
    id?: string;
    name?: string;
  };
  const tier = TIER[scope ?? ""] ?? "Ministry";
  const reportingYear = year ? parseInt(year, 10) : new Date().getFullYear();

  const { data: dashboard, isLoading } = useBasicDashboard(
    {
      reportingYear,
      apexId: tier === "Apex" ? id : undefined,
      federationId: tier === "Federation" ? id : undefined,
    },
    true,
    token,
  );

  useGotenbergReady(!isLoading);

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingLayout")}</p>
        </div>
      </div>
    );
  }

  return (
    <QuestionnaireConsolidatedReport
      tier={tier}
      entityName={name || tier}
      year={reportingYear}
      dashboard={dashboard}
    />
  );
}
