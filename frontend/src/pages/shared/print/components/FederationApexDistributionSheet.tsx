import React, { useEffect } from "react";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";

interface FederationApexDistributionSheetProps {
  federationName: string;
  year: number;
  data: NationalOverviewResponse;
}

export const FederationApexDistributionSheet: React.FC<FederationApexDistributionSheetProps> = ({
  federationName,
  year,
  data,
}) => {
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  useEffect(() => {
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  const apexGroups = React.useMemo(() => {
    const groups = new Map<string, { coopCount: number; members: number }>();
    cooperatives.forEach((c) => {
      const name = c.apex_name || "Unaffiliated / Unknown";
      const members = c.non_financial?.total_members || 0;
      if (!groups.has(name)) {
        groups.set(name, { coopCount: 0, members: 0 });
      }
      const existing = groups.get(name)!;
      existing.coopCount += 1;
      existing.members += members;
    });
    return groups;
  }, [cooperatives]);

  return (
    <div
      className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
      style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
    >
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
          <h3 className="text-xl font-bold text-slate-800 text-center mb-6">
            Cooperatives & Active Members by Apex
          </h3>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 border border-slate-700">Apex Organization</th>
                <th className="p-3 border border-slate-700 text-right">Cooperatives</th>
                <th className="p-3 border border-slate-700 text-right">Total Active Members</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(apexGroups.entries()).map(([apexName, stats]) => (
                <tr key={apexName} className="border-b border-slate-200">
                  <td className="p-3 border-x border-slate-300 bg-slate-50">{apexName}</td>
                  <td className="p-3 border-x border-slate-300 text-right font-semibold text-blue-800">
                    {stats.coopCount}
                  </td>
                  <td className="p-3 border-x border-slate-300 text-right">
                    {stats.members.toLocaleString()}
                  </td>
                </tr>
              ))}
              {apexGroups.size === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-slate-500 italic border border-slate-300"
                  >
                    No cooperative distribution data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-900 text-sm leading-relaxed">
          Displays the total number of cooperatives and their aggregated active members under each
          Apex organization.
        </div>
      </div>
    </div>
  );
};
