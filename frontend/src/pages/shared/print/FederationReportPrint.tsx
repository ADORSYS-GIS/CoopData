import React, { useEffect } from "react";
import { ConsolidatedCoverPage } from "./components/ConsolidatedCoverPage";
import { ConsolidatedDashboardSheet } from "./components/ConsolidatedDashboardSheet";
import { FederationSectorSheet } from "./components/FederationSectorSheet";
import { FederationApexComparisonSheet } from "./components/FederationApexComparisonSheet";
import { ConsolidatedCoopDetailSheet } from "./components/ConsolidatedCoopDetailSheet";
import { FederationPearlsSheet } from "./components/FederationPearlsSheet";
import { FederationSocialImpactSheet } from "./components/FederationSocialImpactSheet";
import { ConsolidatedRiskWatchSheet } from "./components/ConsolidatedRiskWatchSheet";

interface FederationReportPrintProps {
  entityName: string;
  year: number;
  data: any;
  priorData?: any;
}

export const FederationReportPrint: React.FC<FederationReportPrintProps> = ({
  entityName,
  year,
  data,
  priorData,
}) => {

  useEffect(() => {
    // Wait for all charts to render
    setTimeout(() => {
      (window as any).isReady = true;
    }, 2000);
  }, []);

  if (!data) return null;

  return (
    <div className="print-report bg-white min-h-screen">
      
      {/* Cover Page */}
      <ConsolidatedCoverPage
        tier="Federation"
        entityName={entityName}
        year={year}
        totalCooperatives={data.total_cooperatives || 0}
        submittedCooperatives={data.cooperatives_with_data || 0}
      />

      {/* Sheet 1: Executive Dashboard */}
      <ConsolidatedDashboardSheet 
        tier="Federation" 
        entityName={entityName} 
        year={year} 
        data={data} 
        priorData={priorData} 
      />

      {/* Sheet 1 (Continued): Sector Breakdown */}
      <FederationSectorSheet
        federationName={entityName}
        year={year}
        data={data}
      />

      {/* Sheet 2 & 3: Apex Comparison and Filing Compliance */}
      <FederationApexComparisonSheet
        federationName={entityName}
        year={year}
        data={data}
      />

      {/* Sheet 4: Cooperative Detail (from the generic Consolidated report) */}
      <ConsolidatedCoopDetailSheet
        entityName={entityName}
        year={year}
        data={data}
      />

      {/* Sheet 5: PEARLS Comparative Analysis */}
      <FederationPearlsSheet
        federationName={entityName}
        year={year}
        data={data}
      />

      {/* Sheet 6: Federation Social Impact Summary */}
      <FederationSocialImpactSheet
        federationName={entityName}
        year={year}
        data={data}
        priorData={priorData}
      />

      {/* Sheet 7: Risk Watch (from the generic Consolidated report) */}
      <ConsolidatedRiskWatchSheet
        entityName={entityName}
        year={year}
        data={data}
      />
      
    </div>
  );
};
