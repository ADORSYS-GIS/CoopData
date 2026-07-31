import React, { useEffect } from "react";
import {
  ConsolidatedCoverPage,
  ConsolidatedDashboardSheet,
  ConsolidatedCoopDetailSheet,
  ConsolidatedRiskWatchSheet,
} from "./components";
import type { NationalOverviewResponse } from "./components";
import type { ApexNarratives } from "@/hooks/analytics/useConsolidatedNarratives";

interface ConsolidatedReportPrintProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  narratives?: ApexNarratives | null;
}

export const ConsolidatedReportPrint: React.FC<ConsolidatedReportPrintProps> = ({
  tier,
  entityName,
  year,
  data,
  priorData,
  narratives,
}) => {
  const { total_cooperatives, cooperatives_with_data } = data;

  useEffect(() => {
    // Signal Gotenberg that charts and DOM are fully rendered
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1000);
  }, []);

  return (
    <div className="bg-white text-slate-900 font-sans print:w-[210mm]">
      <ConsolidatedCoverPage
        tier={tier}
        entityName={entityName}
        year={year}
        totalCooperatives={total_cooperatives}
        submittedCooperatives={cooperatives_with_data}
      />

      <ConsolidatedDashboardSheet
        tier={tier}
        entityName={entityName}
        year={year}
        data={data}
        priorData={priorData}
        narratives={narratives?.sector_overview}
      />

      {tier === "Apex" && (
        <>
          <ConsolidatedCoopDetailSheet data={data} />
          <ConsolidatedRiskWatchSheet data={data} narratives={narratives?.risk_assessment} />
        </>
      )}
    </div>
  );
};
