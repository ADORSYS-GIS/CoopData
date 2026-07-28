import React, { useEffect } from "react";
import { ConsolidatedCoverPage } from "./components/ConsolidatedCoverPage";
import { ConsolidatedDashboardSheet } from "./components/ConsolidatedDashboardSheet";
import { FederationApexDistributionSheet } from "./components/FederationApexDistributionSheet";
import { FederationSectorSheet } from "./components/FederationSectorSheet";
import { FederationApexComparisonSheet } from "./components/FederationApexComparisonSheet";
import { FederationPearlsSheet } from "./components/FederationPearlsSheet";
import { FederationSocialImpactSheet } from "./components/FederationSocialImpactSheet";
import type { NationalOverviewResponse } from "./components";

interface FederationReportPrintProps {
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  tier?: "Federation" | "Ministry" | "Apex";
}

export const FederationReportPrint: React.FC<FederationReportPrintProps> = ({
  entityName,
  year,
  data,
  priorData,
  tier = "Federation",
}) => {
  useEffect(() => {
    // Wait for all charts to render
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 2000);
  }, []);

  const totalApexes = React.useMemo(() => {
    if (!data?.cooperatives) return 0;
    const apexSet = new Set<string>();
    data.cooperatives.forEach((c) => {
      if (c.apex_id) apexSet.add(c.apex_id);
    });
    return apexSet.size;
  }, [data]);

  if (!data) return null;

  return (
    <div className="print-report bg-white min-h-screen">
      {/* Cover Page */}
      <ConsolidatedCoverPage
        tier={tier}
        entityName={entityName}
        year={year}
        totalCooperatives={data.total_cooperatives || 0}
        submittedCooperatives={data.cooperatives_with_data || 0}
        totalApexes={totalApexes}
      />

      {/* Sheet 1: Executive Dashboard */}
      <ConsolidatedDashboardSheet
        tier={tier}
        entityName={entityName}
        year={year}
        data={data}
        priorData={priorData}
        totalApexes={totalApexes}
      />

      {/* Sheet 1 (Continued): Sector Breakdown */}
      <FederationSectorSheet federationName={entityName} year={year} data={data} />

      {/* Sheet 1 (Continued): Apex Distribution */}
      <FederationApexDistributionSheet federationName={entityName} year={year} data={data} />

      {/* Sheet 2 & 3: Apex Comparison and Filing Compliance */}
      <FederationApexComparisonSheet federationName={entityName} year={year} data={data} />

      {/* Sheet 4: PEARLS Comparative Analysis */}
      <FederationPearlsSheet federationName={entityName} year={year} data={data} />

      {/* Sheet 6: Federation Social Impact Summary */}
      <FederationSocialImpactSheet
        federationName={entityName}
        year={year}
        data={data}
        priorData={priorData}
      />
    </div>
  );
};
