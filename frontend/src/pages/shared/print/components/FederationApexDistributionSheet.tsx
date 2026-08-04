import React, { useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";
import { useTranslation } from "react-i18next";

const COLORS = [
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#64748b",
  "#3b82f6",
  "#14b8a6",
  "#f43f5e",
  "#d946ef",
];

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
  const { t } = useTranslation();
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  useEffect(() => {
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  const apexGroups = React.useMemo(() => {
    const groups = new Map<string, { coopCount: number; members: number }>();
    cooperatives.forEach((c) => {
      const name = c.apex_name || t("printReports.unaffiliated");
      const members = c.non_financial?.total_members || 0;
      if (!groups.has(name)) {
        groups.set(name, { coopCount: 0, members: 0 });
      }
      const existing = groups.get(name)!;
      existing.coopCount += 1;
      existing.members += members;
    });
    return groups;
  }, [cooperatives, t]);

  const chartData = React.useMemo(() => {
    return Array.from(apexGroups.entries()).map(([name, stats]) => ({
      name: name.length > 15 ? name.substring(0, 15) + "..." : name,
      fullName: name,
      cooperatives: stats.coopCount,
      members: stats.members,
    }));
  }, [apexGroups]);

  return (
    <div
      className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
      style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
    >
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {t("printReports.apexDistribution")}
          </h1>
          <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-700">
            {t("printReports.period", { year })}
          </p>
          <p className="text-sm text-slate-500">{t("printReports.distributionOverview")}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 min-h-0">
        <div className="border border-slate-300 p-6 rounded-lg bg-white shrink-0">
          <h3 className="text-xl font-bold text-slate-800 text-center mb-6">
            {t("printReports.coopsMembersByApex")}
          </h3>

          <div className="flex flex-row h-[300px] mb-8 w-full gap-4">
            <div className="w-1/2 h-full flex flex-col items-center">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                {t("printReports.cooperativesDistribution")}
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="cooperatives"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    isAnimationActive={false}
                    label
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-1/2 h-full flex flex-col items-center">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                {t("printReports.activeMembersDistribution")}
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="members"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    isAnimationActive={false}
                    label
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 border border-slate-700">
                  {t("printReports.headers.apexOrganization")}
                </th>
                <th className="p-3 border border-slate-700 text-right">
                  {t("printReports.headers.cooperatives")}
                </th>
                <th className="p-3 border border-slate-700 text-right">
                  {t("printReports.headers.totalActiveMembers")}
                </th>
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
                    {t("printReports.noCoopDistributionData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-900 text-sm leading-relaxed">
          {t("printReports.apexDistributionDesc")}
        </div>
      </div>
    </div>
  );
};
