import React from "react";

import type { FederationNarratives } from "@/hooks/analytics/useConsolidatedNarratives";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import type { ConsInput } from "@/pages/shared/print/cons/analysis";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";

interface FederationReportPrintProps {
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  trend?: ConsInput["trend"];
  tier?: "Federation" | "Ministry" | "Apex";
  narratives?: FederationNarratives | null;
}

export const FederationReportPrint: React.FC<FederationReportPrintProps> = ({
  entityName,
  year,
  data,
  priorData,
  trend,
  tier = "Federation",
  narratives,
}) => {
  if (!data) return null;
  return (
    <ConsolidatedTplReport
      tier={tier}
      entityName={entityName}
      year={year}
      data={data}
      priorData={priorData}
      trend={trend}
      narrative={narratives?.executive_dashboard}
    />
  );
};
