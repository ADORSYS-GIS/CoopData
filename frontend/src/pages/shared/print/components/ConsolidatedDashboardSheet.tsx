import React from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { NationalOverviewResponse, CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { AiInsightBox } from "./AiInsightBox";

interface ConsolidatedDashboardSheetProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  totalApexes?: number;
  narratives?: string;
  riskNarratives?: string;
}

export const ConsolidatedDashboardSheet: React.FC<ConsolidatedDashboardSheetProps> = ({
  tier,
  entityName,
  year,
  data,
  priorData,
  totalApexes,
  narratives,
  riskNarratives,
}) => {
  const { t } = useTranslation();
  const { total_cooperatives, cooperatives_with_data, distributions, cooperatives } = data;
  const priorCoops = priorData?.cooperatives || [];

  // ── Helper: Sum KPI across all coops ──
  const sumKpi = (coops: CoopKpiRow[], kpiName: string) => {
    return coops.reduce((acc, c) => acc + (c.kpis?.[kpiName]?.value || 0), 0);
  };
  const sumMembers = (coops: CoopKpiRow[]) => {
    return coops.reduce((acc, c) => acc + (c.non_financial?.total_members || 0), 0);
  };

  // ── Calculate Current & Prior Totals ──
  const currentFin = {
    assets: sumKpi(cooperatives, "total_assets"),
    glp: sumKpi(cooperatives, "gross_loan_portfolio"),
    deposits: sumKpi(cooperatives, "total_member_deposits"),
    equity: sumKpi(cooperatives, "total_equity"),
    surplus: sumKpi(cooperatives, "net_surplus"),
    members: sumMembers(cooperatives),
  };

  const priorFin = {
    assets: sumKpi(priorCoops, "total_assets"),
    glp: sumKpi(priorCoops, "gross_loan_portfolio"),
    deposits: sumKpi(priorCoops, "total_member_deposits"),
    equity: sumKpi(priorCoops, "total_equity"),
    surplus: sumKpi(priorCoops, "net_surplus"),
    members: sumMembers(priorCoops),
  };

  // ── Helper: YoY Change ──
  const calcYoY = (curr: number, prior: number) => {
    if (!prior || prior === 0) return { text: "-", dir: "flat" };
    const change = ((curr - prior) / prior) * 100;
    return {
      text: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
      dir: change > 0 ? "up" : change < 0 ? "down" : "flat",
    };
  };

  const renderYoY = (curr: number, prior: number) => {
    if (!prior) return <td className="p-2 border border-slate-300 text-right">-</td>;
    const yoy = calcYoY(curr, prior);
    let color = "text-slate-600";
    if (yoy.dir === "up") color = "text-green-600";
    if (yoy.dir === "down") color = "text-red-600";
    return (
      <td className={`p-2 border border-slate-300 text-right font-bold ${color}`}>
        {yoy.text} {yoy.dir === "up" && "▲"}
        {yoy.dir === "down" && "▼"}
      </td>
    );
  };

  // ── Formatter ──
  const fmtNum = (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 0 });

  // ── Calculate Current & Prior Averages ──
  const getAvg = (coops: CoopKpiRow[], kpiName: string, count: number) => {
    if (!count) return 0;
    return sumKpi(coops, kpiName) / count;
  };

  const currAvgs = {
    par30: getAvg(cooperatives, "par30", cooperatives_with_data),
    car: getAvg(cooperatives, "capital_adequacy_ratio", cooperatives_with_data),
    roa: getAvg(cooperatives, "roa", cooperatives_with_data),
    roe: getAvg(cooperatives, "roe", cooperatives_with_data),
    oer: getAvg(cooperatives, "operating_expense_ratio", cooperatives_with_data),
    llc: getAvg(cooperatives, "loan_loss_coverage", cooperatives_with_data),
  };

  const priorAvgs = priorData
    ? {
        par30: getAvg(priorCoops, "par30", priorData.cooperatives_with_data),
        car: getAvg(priorCoops, "capital_adequacy_ratio", priorData.cooperatives_with_data),
        roa: getAvg(priorCoops, "roa", priorData.cooperatives_with_data),
        roe: getAvg(priorCoops, "roe", priorData.cooperatives_with_data),
        oer: getAvg(priorCoops, "operating_expense_ratio", priorData.cooperatives_with_data),
        llc: getAvg(priorCoops, "loan_loss_coverage", priorData.cooperatives_with_data),
      }
    : null;

  // Status mapping
  const renderStatus = (val: number, name: string) => {
    let color = "bg-slate-300"; // default
    if (name === "par30")
      color = val <= 5 ? "bg-green-500" : val <= 10 ? "bg-amber-500" : "bg-red-500";
    if (name === "car")
      color = val >= 10 ? "bg-green-500" : val >= 8 ? "bg-amber-500" : "bg-red-500";
    if (name === "roa")
      color = val >= 3 ? "bg-green-500" : val >= 1 ? "bg-amber-500" : "bg-red-500";
    if (name === "roe")
      color = val >= 8 ? "bg-green-500" : val >= 4 ? "bg-amber-500" : "bg-red-500";
    if (name === "oer")
      color = val <= 5 ? "bg-green-500" : val <= 8 ? "bg-amber-500" : "bg-red-500";
    if (name === "llc")
      color = val >= 100 ? "bg-green-500" : val >= 80 ? "bg-amber-500" : "bg-red-500";

    return <div className={`w-3 h-3 rounded-full ${color} mx-auto`}></div>;
  };

  // ── Risk Distribution Chart Data ──
  const getDist = (kpi: string) =>
    distributions[kpi] || { green_count: 0, amber_count: 0, red_count: 0 };

  // Calculate filing status from has_data
  const filedCount = cooperatives.filter((c) => c.has_data).length;
  const notFiledCount = total_cooperatives - filedCount;

  const chartData = [
    { name: "PAR30", ...getDist("par30") },
    { name: "CAR", ...getDist("capital_adequacy_ratio") },
    { name: "ROA", ...getDist("roa") },
    { name: "OER", ...getDist("operating_expense_ratio") },
    { name: "Filing", green_count: filedCount, amber_count: 0, red_count: notFiledCount },
  ];

  return (
    <div className="relative flex flex-col w-[210mm] min-h-[296mm] p-12 bg-white break-after-page font-sans">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-slate-900 border-b-2 border-slate-900 pb-2">
          {t("printReports.dashboard.consolidatedReport", { tier: t(`common.roles.${tier.toLowerCase()}`, tier) })}
        </h1>
        <p className="text-sm text-slate-600 mb-6 italic">
          {t("printReports.dashboard.purposeDesc", { tier: t(`common.roles.${tier.toLowerCase()}`, tier) })}
        </p>

        <h2 className="text-xl font-bold text-blue-800 mb-4">{t("printReports.dashboard.executiveDashboard")}</h2>

        <AiInsightBox
          title={`${tier} Executive Dashboard — AI Insight`}
          content={narratives}
          fallbackContent={
            <>
              This executive dashboard consolidates financial performance, KPI compliance, and risk
              distribution across all cooperatives within the {tier.toLowerCase()} for the reporting
              period.
            </>
          }
        />

        {/* Header Table */}
        <h3 className="text-sm font-bold text-slate-800 mb-1">{t("printReports.dashboard.header")}</h3>
        <table className="w-full text-left text-xs mb-6 border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700 w-1/4">{t("printReports.dashboard.field")}</th>
              <th className="p-2 border border-slate-700 w-1/4">{t("printReports.dashboard.value")}</th>
              <th className="p-2 border border-slate-700 w-1/4">{t("printReports.dashboard.field")}</th>
              <th className="p-2 border border-slate-700 w-1/4">{t("printReports.dashboard.value")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t(`common.roles.${tier.toLowerCase()}`, tier)}</td>
              <td className="p-2 border border-slate-300 font-bold">{entityName}</td>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.period")}</td>
              <td className="p-2 border border-slate-300 font-bold">{year}</td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.cooperatives")}</td>
              <td className="p-2 border border-slate-300 font-bold">{total_cooperatives}</td>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.submitted")}</td>
              <td className="p-2 border border-slate-300 font-bold">
                {cooperatives_with_data} (
                {((cooperatives_with_data / total_cooperatives) * 100).toFixed(1)}%)
              </td>
            </tr>
            {(tier === "Federation" || tier === "Ministry") && totalApexes !== undefined && (
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.activeApexes")}</td>
                <td className="p-2 border border-slate-300 font-bold" colSpan={3}>
                  {totalApexes}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Consolidated Financial Position */}
        <h3 className="text-sm font-bold text-slate-800 mb-1">{t("printReports.dashboard.financialPositionTitle")}</h3>
        <table className="w-full text-left text-xs mb-6 border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700">{t("printReports.dashboard.metric")}</th>
              <th className="p-2 border border-slate-700 text-right">{t("printReports.dashboard.current")}</th>
              <th className="p-2 border border-slate-700 text-right">{t("printReports.dashboard.priorYear")}</th>
              <th className="p-2 border border-slate-700 text-right">{t("printReports.dashboard.yoyChange")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalAssets")}</td>
              <td className="p-2 border border-slate-300 text-right">
                E {fmtNum(currentFin.assets)}
              </td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.assets ? `E ${fmtNum(priorFin.assets)}` : "-"}
              </td>
              {renderYoY(currentFin.assets, priorFin.assets)}
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalGlp")}</td>
              <td className="p-2 border border-slate-300 text-right">E {fmtNum(currentFin.glp)}</td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.glp ? `E ${fmtNum(priorFin.glp)}` : "-"}
              </td>
              {renderYoY(currentFin.glp, priorFin.glp)}
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalDeposits")}</td>
              <td className="p-2 border border-slate-300 text-right">
                E {fmtNum(currentFin.deposits)}
              </td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.deposits ? `E ${fmtNum(priorFin.deposits)}` : "-"}
              </td>
              {renderYoY(currentFin.deposits, priorFin.deposits)}
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalEquity")}</td>
              <td className="p-2 border border-slate-300 text-right">
                E {fmtNum(currentFin.equity)}
              </td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.equity ? `E ${fmtNum(priorFin.equity)}` : "-"}
              </td>
              {renderYoY(currentFin.equity, priorFin.equity)}
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalNetSurplus")}</td>
              <td className="p-2 border border-slate-300 text-right">
                E {fmtNum(currentFin.surplus)}
              </td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.surplus ? `E ${fmtNum(priorFin.surplus)}` : "-"}
              </td>
              {renderYoY(currentFin.surplus, priorFin.surplus)}
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.totalMembers")}</td>
              <td className="p-2 border border-slate-300 text-right">
                {fmtNum(currentFin.members)}
              </td>
              <td className="p-2 border border-slate-300 text-right">
                {priorFin.members ? fmtNum(priorFin.members) : "-"}
              </td>
              {renderYoY(currentFin.members, priorFin.members)}
            </tr>
          </tbody>
        </table>

        {/* Consolidated KPIs */}
        <h3 className="text-sm font-bold text-slate-800 mb-1">{t("printReports.dashboard.kpisTitle")}</h3>
        <table className="w-full text-left text-xs mb-8 border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700">{t("printReports.dashboard.kpi")}</th>
              <th className="p-2 border border-slate-700 text-center">{t("printReports.dashboard.current")}</th>
              <th className="p-2 border border-slate-700 text-center">{t("printReports.dashboard.prior")}</th>
              <th className="p-2 border border-slate-700 text-center">{t("printReports.dashboard.status")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgPar30")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.par30.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.par30.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.par30, "par30")}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgCar")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.car.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.car.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.car, "car")}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgRoa")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.roa.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.roa.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.roa, "roa")}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgRoe")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.roe.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.roe.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.roe, "roe")}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgOer")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.oer.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.oer.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.oer, "oer")}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 bg-slate-50">{t("printReports.dashboard.avgLlc")}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {currAvgs.llc.toFixed(1)}%
              </td>
              <td className="p-2 border border-slate-300 text-center text-slate-500">
                {priorAvgs ? priorAvgs.llc.toFixed(1) + "%" : "-"}
              </td>
              <td className="p-2 border border-slate-300 text-center">
                {renderStatus(currAvgs.llc, "llc")}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Risk Distribution */}
        <h3 className="text-sm font-bold text-slate-800 mb-1">
          {t("printReports.dashboard.riskDistributionTitle")}
        </h3>

        <AiInsightBox
          title={`${tier} Risk Distribution — AI Insight`}
          content={riskNarratives}
          fallbackContent={
            <>
              This risk distribution analysis covers the green/amber/red breakdown across all
              cooperatives within the {tier.toLowerCase()} for the reporting period.
            </>
          }
        />

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-4">
          <div className="h-64">
            <BarChart
              width={700}
              height={250}
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: "bold" }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              <Bar
                dataKey="green_count"
                name={t("printReports.dashboard.greenHealthy")}
                fill="#10b981"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="amber_count"
                name={t("printReports.dashboard.amberWatch")}
                fill="#f59e0b"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="red_count"
                name={t("printReports.dashboard.redRisk")}
                fill="#ef4444"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </div>
        </div>
        <table className="w-full text-left text-[11px] mb-8 border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700 w-1/4">{t("printReports.dashboard.indicator")}</th>
              <th className="p-2 border border-slate-700 w-1/4 text-center">
                <span className="w-2 h-2 inline-block rounded-full bg-green-500 mr-1"></span> {t("printReports.dashboard.green")}
              </th>
              <th className="p-2 border border-slate-700 w-1/4 text-center">
                <span className="w-2 h-2 inline-block rounded-full bg-amber-500 mr-1"></span> {t("printReports.dashboard.amber")}
              </th>
              <th className="p-2 border border-slate-700 w-1/4 text-center">
                <span className="w-2 h-2 inline-block rounded-full bg-red-500 mr-1"></span> {t("printReports.dashboard.red")}
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.name}>
                <td className="p-2 border border-slate-300 bg-slate-50">{row.name}</td>
                <td className="p-2 border border-slate-300 text-center">{row.green_count}</td>
                <td className="p-2 border border-slate-300 text-center">{row.amber_count}</td>
                <td className="p-2 border border-slate-300 text-center">{row.red_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-4 border-t border-slate-200 mt-auto">
        <p></p>
        <p></p>
      </div>
    </div>
  );
};
export default ConsolidatedDashboardSheet;
