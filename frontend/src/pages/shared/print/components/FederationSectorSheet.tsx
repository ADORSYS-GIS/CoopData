import React, { useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";
import { useTranslation } from "react-i18next";
import { AiInsightBox } from "./AiInsightBox";

interface FederationSectorSheetProps {
  federationName: string;
  year: number;
  data: NationalOverviewResponse;
  narratives?: string;
}

export const FederationSectorSheet: React.FC<FederationSectorSheetProps> = ({
  federationName,
  year,
  data,
  narratives,
}) => {
  const { t } = useTranslation();
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  // Group by Sector
  const sectorGroups: Record<string, CoopKpiRow[]> = {};
  cooperatives.forEach((c) => {
    const s = c.sector || t("printReports.uncategorized");
    if (!sectorGroups[s]) sectorGroups[s] = [];
    sectorGroups[s].push(c);
  });

  const getAvg = (coops: CoopKpiRow[], kpi: string) => {
    const valid = coops.filter((c) => c.kpis?.[kpi]);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, c) => acc + (c.kpis?.[kpi]?.value || 0), 0);
    return sum / valid.length;
  };

  const sectorData = Object.entries(sectorGroups).map(([sector, coops]) => {
    const total = coops.length;
    const submitted = coops.filter((c) => c.has_data).length;
    const filingPct = total > 0 ? (submitted / total) * 100 : 0;

    // Only average for those that submitted data
    const filedCoops = coops.filter((c) => c.has_data);

    return {
      sector,
      coops: total,
      filingPct,
      par30: getAvg(filedCoops, "par30"),
      car: getAvg(filedCoops, "capital_adequacy_ratio"),
      roa: getAvg(filedCoops, "roa"),
    };
  });

  // Calculate overall text narrative
  const totalAssets = cooperatives.reduce((acc, c) => acc + (c.kpis?.total_assets?.value || 0), 0);
  const totalFilingPct =
    cooperatives.length > 0
      ? (cooperatives.filter((c) => c.has_data).length / cooperatives.length) * 100
      : 0;

  useEffect(() => {
    // Small delay to allow Recharts to paint in Gotenberg
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  return (
    <div
      className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
      style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
    >
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("printReports.sectorBreakdown")}</h1>
          <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-700">{t("printReports.period", { year })}</p>
          <p className="text-sm text-slate-500"></p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 min-h-0">
        {/* Chart */}
        <div className="border border-slate-300 p-6 rounded-lg bg-white shrink-0">
          <h3 className="text-xl font-bold text-slate-800 text-center mb-6">
            {t("printReports.filingRateBySector")}
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} margin={{ top: 30, right: 30, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} />
                <XAxis dataKey="sector" tick={{ fontSize: 16 }} tickMargin={15} />
                <YAxis
                  domain={[0, 100]}
                  label={{
                    value: t("printReports.filingRatePct"),
                    angle: -90,
                    position: "insideLeft",
                    offset: 15,
                    fontSize: 16,
                    fontWeight: "bold",
                  }}
                />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="filingPct" isAnimationActive={false}>
                  <LabelList
                    dataKey="filingPct"
                    position="top"
                    formatter={(val: number) => `${val.toFixed(0)}%`}
                    style={{ fontSize: 16, fontWeight: "bold" }}
                  />
                  {sectorData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.filingPct < 75 ? "#ef4444" : "#0284c7"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="shrink-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-left border border-slate-900 w-1/4">{t("printReports.headers.type")}</th>
                <th className="p-3 text-right border border-slate-900">{t("printReports.headers.coops")}</th>
                <th className="p-3 text-right border border-slate-900">{t("printReports.headers.filingPct")}</th>
                <th className="p-3 text-right border border-slate-900">{t("printReports.headers.avgPar30")}</th>
                <th className="p-3 text-right border border-slate-900">{t("printReports.headers.avgCar")}</th>
                <th className="p-3 text-right border border-slate-900">{t("printReports.headers.avgRoa")}</th>
              </tr>
            </thead>
            <tbody>
              {sectorData.map((row, i) => (
                <tr key={i} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-medium">{row.sector}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.coops}</td>
                  <td className="p-3 border border-slate-300 text-right">
                    {row.filingPct.toFixed(0)}%
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-bold text-slate-700">
                    <span
                      className={
                        row.par30 > 10
                          ? "text-red-600"
                          : row.par30 > 5
                            ? "text-amber-500"
                            : "text-green-600"
                      }
                    >
                      {row.par30.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-bold text-slate-700">
                    <span
                      className={
                        row.car < 10
                          ? "text-red-600"
                          : row.car < 15
                            ? "text-amber-500"
                            : "text-green-600"
                      }
                    >
                      {row.car.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-bold text-slate-700">
                    <span
                      className={
                        row.roa < 0
                          ? "text-red-600"
                          : row.roa < 3
                            ? "text-amber-500"
                            : "text-green-600"
                      }
                    >
                      {row.roa.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Narrative */}
        <AiInsightBox
          title="Sector Composition — AI Insight"
          content={narratives}
          fallbackContent={
            <>
              The federation's total assets for the reported period are{" "}
              <strong>
                E {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </strong>
              . Filing rates stand at <strong>{totalFilingPct.toFixed(1)}%</strong> across{" "}
              {cooperatives.length} member cooperatives.
            </>
          }
        />
      </div>
    </div>
  );
};
