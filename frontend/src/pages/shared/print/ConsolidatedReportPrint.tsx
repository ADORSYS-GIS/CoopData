import React from "react";

import type { ApexNarratives } from "@/hooks/analytics/useConsolidatedNarratives";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import type { ConsInput } from "@/pages/shared/print/cons/analysis";
import { ConsolidatedTplReport } from "@/pages/shared/print/cons/ConsolidatedTplReport";

interface ConsolidatedReportPrintProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  trend?: ConsInput["trend"];
  narratives?: ApexNarratives | null;
}

export const ConsolidatedReportPrint: React.FC<ConsolidatedReportPrintProps> = ({
  tier,
  entityName,
  year,
  data,
  priorData,
  trend,
  narratives,
}) => (
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
