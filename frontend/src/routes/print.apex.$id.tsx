import { createFileRoute } from "@tanstack/react-router";
import { ConsolidatedReportPrint } from "@/pages/shared/print/ConsolidatedReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useApex } from "@/hooks/apexes/useApexes";
import { usePeriodSeries } from "@/hooks/analytics/usePeriodSeries";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { usePrintLanguage } from "@/hooks/print/usePrintLanguage";
import { useReportRoleLabels } from "@/hooks/print/useReportRoleLabels";
import { setReportRoles } from "@/pages/shared/print/tpl/i18n";
import { useApexNarratives } from "@/hooks/analytics/useConsolidatedNarratives";

export const Route = createFileRoute("/print/apex/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { token, year, name, lng } = Route.useSearch() as {
    token?: string;
    year?: string;
    name?: string;
    lng?: string;
  };

  const languageReady = usePrintLanguage(lng);
  const { data: roleLabels, isLoading: isLoadingRoles } = useReportRoleLabels(token);
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  const { data: apex } = useApex(id, token);

  const { data: overviewData, isLoading: isLoadingCurrent } = useNationalOverview(
    {
      apexId: id,
      reportingYear: currentYear,
    },
    true,
    token,
  );

  const { data: priorData, isLoading: isLoadingPrior } = useNationalOverview(
    {
      apexId: id,
      reportingYear: currentYear - 1,
    },
    true,
    token,
  );

  const { data: narratives, isLoading: isLoadingNarratives } = useApexNarratives(
    id,
    currentYear,
    token,
    lng,
  );

  const { data: series, isLoading: isLoadingSeries } = usePeriodSeries(
    { apexId: id, reportingYear: currentYear, periodType: "yearly" },
    true,
    token,
  );

  const isLoading =
    !languageReady ||
    isLoadingRoles ||
    isLoadingCurrent ||
    isLoadingPrior ||
    isLoadingSeries ||
    isLoadingNarratives;

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingApex")}</p>
        </div>
      </div>
    );
  }

  setReportRoles(roleLabels);
  return (
    <ConsolidatedReportPrint
      tier="Apex"
      entityName={
        name || apex?.name || overviewData.cooperatives[0]?.apex_name || t("pdf.cons.issuer.Apex")
      }
      year={currentYear}
      data={overviewData}
      priorData={priorData}
      trend={series?.points}
      narratives={narratives}
    />
  );
}

// Trigger Vite reload
