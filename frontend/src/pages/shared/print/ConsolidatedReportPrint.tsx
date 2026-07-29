import React, { useEffect } from "react";
import {
  ConsolidatedCoverPage,
  ConsolidatedDashboardSheet,
  ConsolidatedCoopDetailSheet,
  ConsolidatedRiskWatchSheet,
} from "./components";
import type { NationalOverviewResponse } from "./components";

const COLORS = ["#0ea5e9", "#f59e0b", "#ef4444", "#94a3b8"];

interface ConsolidatedReportPrintProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
}

export const ConsolidatedReportPrint: React.FC<ConsolidatedReportPrintProps> = ({
  tier,
  entityName,
  year,
  data,
  priorData,
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
      />

      {tier === "Apex" && (
        <>
          <ConsolidatedCoopDetailSheet data={data} />
          <ConsolidatedRiskWatchSheet data={data} />
        </>
      )}
    </div>
  );
};
