import React from "react";

import type { FederationNarratives } from "@/hooks/analytics/useConsolidatedNarratives";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";

interface FederationReportPrintProps {
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  tier?: "Federation" | "Ministry" | "Apex";
  narratives?: FederationNarratives | null;
}

export const FederationReportPrint: React.FC<FederationReportPrintProps> = ({
  entityName,
  year,
  data,
  priorData,
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
      narrative={narratives?.executive_dashboard}
    />
  );
};
