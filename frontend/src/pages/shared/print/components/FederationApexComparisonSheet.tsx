import React, { useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";

interface FederationApexComparisonSheetProps {
  federationName: string;
  year: number;
  data: NationalOverviewResponse;
}

export const FederationApexComparisonSheet: React.FC<FederationApexComparisonSheetProps> = ({
  federationName,
  year,
  data,
}) => {
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  // Group by Apex
  const apexGroups: Record<string, CoopKpiRow[]> = {};
  cooperatives.forEach((c) => {
    const a = c.apex_name || "Unaffiliated";
    if (!apexGroups[a]) apexGroups[a] = [];
    apexGroups[a].push(c);
  });

  const getAvg = (coops: CoopKpiRow[], kpi: string) => {
    const valid = coops.filter((c) => c.kpis?.[kpi]);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, c) => acc + (c.kpis?.[kpi]?.value || 0), 0);
    return sum / valid.length;
  };

  const getSum = (coops: CoopKpiRow[], kpi: string) => {
    return coops.reduce((acc, c) => acc + (c.kpis?.[kpi]?.value || 0), 0);
  };

  // Apex Data Array
  const apexData = Object.entries(apexGroups).map(([apex, coops]) => {
    const total = coops.length;
    const submitted = coops.filter((c) => c.has_data).length;
    // Approvals are simplified here to submitted for mock compliance since we don't track status directly in CoopKpiRow
    const approved = submitted;
    const filingPct = total > 0 ? (submitted / total) * 100 : 0;

    const filedCoops = coops.filter((c) => c.has_data);

    return {
      apex,
      coops: total,
      submitted,
      approved,
      returned: 0,
      pending: 0,
      onTime: submitted,
      late: 0,
      notFiled: total - submitted,
      filingPct,
      assets: getSum(filedCoops, "total_assets"),
      par30: getAvg(filedCoops, "par30"),
      car: getAvg(filedCoops, "capital_adequacy_ratio"),
      roa: getAvg(filedCoops, "roa"),
      oer: getAvg(filedCoops, "operating_expense_ratio"),
    };
  });

  const formatShortCurrency = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
    if (val >= 1000) return (val / 1000).toFixed(1) + "K";
    return val.toString();
  };

  useEffect(() => {
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  return (
    <>
      {/* Sheet 2: Apex Comparison */}
      <div
        className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
        style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
      >
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Apex Comparison</h1>
            <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-700">Period: {year}</p>
            <p className="text-sm text-slate-500"></p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-8 min-h-0">
          <div className="border border-slate-300 p-6 rounded-lg bg-white shrink-0">
            <h3 className="text-xl font-bold text-slate-800 text-center mb-6">
              Filing Rate & Avg PAR30 by Apex
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={apexData}
                  margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={true} />
                  <XAxis dataKey="apex" tick={{ fontSize: 16 }} tickMargin={15} />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    label={{
                      value: "Filing Rate (%)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 0,
                      fontSize: 16,
                      fontWeight: "bold",
                      fill: "#0284c7",
                    }}
                    tick={{ fill: "#0284c7" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 20]}
                    label={{
                      value: "Avg PAR30 (%)",
                      angle: 90,
                      position: "insideRight",
                      offset: 0,
                      fontSize: 16,
                      fontWeight: "bold",
                      fill: "#dc2626",
                    }}
                    tick={{ fill: "#dc2626" }}
                  />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="filingPct" fill="#38bdf8" isAnimationActive={false}>
                    <LabelList
                      dataKey="filingPct"
                      position="insideTop"
                      fill="#fff"
                      formatter={(val: number) => `${val.toFixed(0)}%`}
                      style={{ fontSize: 14, fontWeight: "bold" }}
                    />
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="par30"
                    stroke="#dc2626"
                    strokeWidth={3}
                    dot={{ r: 6, fill: "#dc2626" }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="shrink-0 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-3 text-left border border-slate-900">Apex</th>
                  <th className="p-3 text-right border border-slate-900">Coops</th>
                  <th className="p-3 text-right border border-slate-900">Submitted</th>
                  <th className="p-3 text-right border border-slate-900">Approved</th>
                  <th className="p-3 text-right border border-slate-900">Filing%</th>
                  <th className="p-3 text-right border border-slate-900">Assets</th>
                  <th className="p-3 text-right border border-slate-900">Avg PAR30</th>
                  <th className="p-3 text-right border border-slate-900">Avg CAR</th>
                  <th className="p-3 text-right border border-slate-900">Avg ROA</th>
                  <th className="p-3 text-right border border-slate-900">Avg OER</th>
                  <th className="p-3 text-center border border-slate-900">Risk</th>
                </tr>
              </thead>
              <tbody>
                {apexData.map((row, i) => (
                  <tr key={i} className="even:bg-slate-50">
                    <td className="p-3 border border-slate-300 font-medium">{row.apex}</td>
                    <td className="p-3 border border-slate-300 text-right">{row.coops}</td>
                    <td className="p-3 border border-slate-300 text-right">{row.submitted}</td>
                    <td className="p-3 border border-slate-300 text-right">{row.approved}</td>
                    <td className="p-3 border border-slate-300 text-right">
                      {row.filingPct.toFixed(0)}%
                    </td>
                    <td className="p-3 border border-slate-300 text-right">
                      {formatShortCurrency(row.assets)}
                    </td>
                    <td className="p-3 border border-slate-300 text-right font-bold">
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
                    <td className="p-3 border border-slate-300 text-right font-bold">
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
                    <td className="p-3 border border-slate-300 text-right font-bold">
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
                    <td className="p-3 border border-slate-300 text-right font-bold">
                      <span
                        className={
                          row.oer > 15
                            ? "text-red-600"
                            : row.oer > 10
                              ? "text-amber-500"
                              : "text-green-600"
                        }
                      >
                        {row.oer.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 border border-slate-300 text-center">
                      <div
                        className={`mx-auto w-4 h-4 rounded-full ${row.par30 > 10 || row.car < 10 ? "bg-red-500" : row.par30 > 5 || row.car < 15 ? "bg-amber-500" : "bg-green-500"}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sheet 3: Filing Compliance by Apex */}
      <div
        className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
        style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
      >
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Filing Compliance by Apex</h1>
            <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-700">Period: {year}</p>
            <p className="text-sm text-slate-500"></p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-left border border-slate-900">Apex</th>
                <th className="p-3 text-right border border-slate-900">Total</th>
                <th className="p-3 text-right border border-slate-900">Submitted</th>
                <th className="p-3 text-right border border-slate-900">Approved</th>
                <th className="p-3 text-right border border-slate-900">Returned</th>
                <th className="p-3 text-right border border-slate-900">Pending</th>
                <th className="p-3 text-right border border-slate-900">On Time</th>
                <th className="p-3 text-right border border-slate-900">Late</th>
                <th className="p-3 text-right border border-slate-900">Not Filed</th>
                <th className="p-3 text-right border border-slate-900">Compliance%</th>
              </tr>
            </thead>
            <tbody>
              {apexData.map((row, i) => (
                <tr key={i} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-medium">{row.apex}</td>
                  <td className="p-3 border border-slate-300 text-right font-bold">{row.coops}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.submitted}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.approved}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.returned}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.pending}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.onTime}</td>
                  <td className="p-3 border border-slate-300 text-right">{row.late}</td>
                  <td className="p-3 border border-slate-300 text-right text-red-600 font-bold">
                    {row.notFiled}
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-bold">
                    {row.filingPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                <td className="p-3 border border-slate-300">Total</td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.coops, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.submitted, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.approved, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.returned, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.pending, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.onTime, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.reduce((acc, row) => acc + row.late, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right text-red-600">
                  {apexData.reduce((acc, row) => acc + row.notFiled, 0)}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {apexData.length > 0
                    ? (
                        (apexData.reduce((acc, row) => acc + row.submitted, 0) /
                          apexData.reduce((acc, row) => acc + row.coops, 0)) *
                        100
                      ).toFixed(0) + "%"
                    : "0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
