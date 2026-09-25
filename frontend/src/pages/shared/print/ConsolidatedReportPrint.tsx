import React from "react";

import type { ApexNarratives } from "@/hooks/analytics/useConsolidatedNarratives";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";

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
}) => (
  <ConsolidatedTplReport
    tier={tier}
    entityName={entityName}
    year={year}
    data={data}
    priorData={priorData}
    narrative={narratives?.executive_dashboard}
  />
);
