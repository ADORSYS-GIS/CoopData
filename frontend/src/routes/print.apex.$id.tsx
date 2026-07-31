import { createFileRoute } from "@tanstack/react-router";
import { ConsolidatedReportPrint } from "@/pages/shared/print/ConsolidatedReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useApex } from "@/hooks/apexes/useApexes";
import { useApexNarratives } from "@/hooks/analytics/useConsolidatedNarratives";

export const Route = createFileRoute("/print/apex/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { id } = Route.useParams();
  const { token, year } = Route.useSearch() as { token?: string; year?: string };

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

  const { data: narratives } = useApexNarratives(id, currentYear, token);

  const isLoading = isLoadingCurrent || isLoadingPrior;

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating Apex Report layout…</p>
        </div>
      </div>
    );
  }

  return (
    <ConsolidatedReportPrint
      tier="Apex"
      entityName={apex?.name ?? "Apex"}
      year={currentYear}
      data={overviewData}
      priorData={priorData}
      narratives={narratives}
    />
  );
}

// Trigger Vite reload
