import React, { useEffect } from "react";
import { ApexDistributionBar } from "@/components/analytics/ApexDistributionBar";
import { CoopKpiRow } from "@/openapi-client/api";

interface FederationApexDistributionSheetProps {
  federationName: string;
  year: number;
  data: any;
}

export const FederationApexDistributionSheet: React.FC<FederationApexDistributionSheetProps> = ({
  federationName,
  year,
  data,
}) => {
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  useEffect(() => {
    setTimeout(() => {
      (window as any).isReady = true;
    }, 1500);
  }, []);

  return (
    <div className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200" style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}>
      
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Apex Distribution</h1>
          <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-700">Period: {year}</p>
          <p className="text-sm text-slate-500">Distribution Overview</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 min-h-0">
        <div className="border border-slate-300 p-6 rounded-lg bg-white shrink-0">
          <h3 className="text-xl font-bold text-slate-800 text-center mb-6">Cooperatives & Active Members by Apex</h3>
          <div className="h-[500px]">
             <ApexDistributionBar cooperatives={cooperatives as any} />
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-900 text-sm leading-relaxed">
          Displays the number of cooperatives and active members under each Apex organization.
        </div>
      </div>
    </div>
  );
};
