import { createFileRoute } from "@tanstack/react-router";
import { ConsolidatedReportPrint } from "@/pages/shared/print/ConsolidatedReportPrint";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";

export const Route = createFileRoute("/print/ministry")({
  component: PrintComponent,
});

function PrintComponent() {
  const currentYear = new Date().getFullYear();
  
  const { data: overviewData, isLoading } = useNationalOverview({
    reportingYear: currentYear,
  });

  if (isLoading || !overviewData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating National Report layout…</p>
        </div>
      </div>
    );
  }

  return (
    <ConsolidatedReportPrint
      tier="Ministry"
      entityName="Ministry of Commerce, Industry and Trade"
      year={currentYear}
      data={overviewData}
    />
  );
}

// Trigger Vite reload
