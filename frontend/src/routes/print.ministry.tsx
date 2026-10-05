import { createFileRoute } from "@tanstack/react-router";
import { FederationReportPrint } from "@/pages/shared/print/FederationReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { usePeriodSeries } from "@/hooks/analytics/usePeriodSeries";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { useMinistryNarratives } from "@/hooks/analytics/useConsolidatedNarratives";

export const Route = createFileRoute("/print/ministry")({
  component: PrintComponent,
});

function PrintComponent() {
  const { t } = useTranslation();
  const { token, year } = Route.useSearch() as { token?: string; year?: string };
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();

  const { data: overviewData, isLoading: isLoadingCurrent } = useNationalOverview(
    {
      reportingYear: currentYear,
    },
    true,
    token,
  );

  const { data: priorData, isLoading: isLoadingPrior } = useNationalOverview(
    {
      reportingYear: currentYear - 1,
    },
    true,
    token,
  );

  const { data: narratives } = useMinistryNarratives(currentYear, token);

  const { data: series, isLoading: isLoadingSeries } = usePeriodSeries(
    { reportingYear: currentYear, periodType: "yearly" },
    true,
    token,
  );

  const isLoading = isLoadingCurrent || isLoadingPrior || isLoadingSeries;

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingNational")}</p>
        </div>
      </div>
    );
  }

  return (
    <FederationReportPrint
      tier="Ministry"
      entityName="Ministry of Commerce, Industry and Trade"
      year={currentYear}
      data={overviewData}
      priorData={priorData}
      trend={series?.points}
      narratives={narratives}
    />
  );
}

// Trigger Vite reload
