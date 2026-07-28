import { createFileRoute } from "@tanstack/react-router";
import { FederationReportPrint } from "@/pages/shared/print/FederationReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useFederation } from "@/hooks/federations/useFederations";

export const Route = createFileRoute("/print/federation/$id")({
  component: PrintComponent,
});

function PrintComponent() {
  const { id } = Route.useParams();
  const { token, year } = Route.useSearch() as { token?: string, year?: string };
  
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  const { data: federation } = useFederation(id, token);
  
  const { data: overviewData, isLoading: isLoadingCurrent } = useNationalOverview({
    federationId: id,
    reportingYear: currentYear,
  }, true, token);

  const { data: priorData, isLoading: isLoadingPrior } = useNationalOverview({
    federationId: id,
    reportingYear: currentYear - 1,
  }, true, token);

  const isLoading = isLoadingCurrent || isLoadingPrior;

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating Federation Report layout…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-200 min-h-screen">
      <FederationReportPrint 
        entityName={federation?.name ?? "Federation"} 
        year={currentYear} 
        data={overviewData} 
        priorData={priorData}
      />
    </div>
  );
}

// Trigger Vite reload
