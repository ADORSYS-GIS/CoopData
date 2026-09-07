import { createFileRoute } from "@tanstack/react-router";
import { FederationReportPrint } from "@/pages/shared/print/FederationReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useFederation } from "@/hooks/federations/useFederations";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { useFederationNarratives } from "@/hooks/analytics/useConsolidatedNarratives";

export const Route = createFileRoute("/print/federation/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { token, year } = Route.useSearch() as { token?: string; year?: string };

  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  const { data: federation } = useFederation(id, token);

  const { data: overviewData, isLoading: isLoadingCurrent } = useNationalOverview(
    {
      federationId: id,
      reportingYear: currentYear,
    },
    true,
    token,
  );

  const { data: priorData, isLoading: isLoadingPrior } = useNationalOverview(
    {
      federationId: id,
      reportingYear: currentYear - 1,
    },
    true,
    token,
  );

  const { data: narratives } = useFederationNarratives(id, currentYear, token);

  const isLoading = isLoadingCurrent || isLoadingPrior;

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingFederation")}</p>
        </div>
      </div>
    );
  }

  return (
    <FederationReportPrint
      entityName={federation?.name ?? "Federation"}
      year={currentYear}
      data={overviewData}
      priorData={priorData}
      narratives={narratives}
    />
  );
}

// Trigger Vite reload
