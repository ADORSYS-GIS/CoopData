import React from "react";
import { useTranslation } from "react-i18next";
import { ReportDataProps } from "./types";
import { findKpi, formatCurrency, calculateYoY } from "./utils";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { AiInsightBox } from "./AiInsightBox";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const ReportExecutiveSummary: React.FC<ReportDataProps> = ({
  submission,
  submissionId,
  cooperative,
  coopName,
  kpiMap,
  kpisData,
  narratives,
}) => {
  const { t } = useTranslation();
  const complianceKpis = [
    findKpi(kpiMap, "par30"),
    findKpi(kpiMap, "capital_adequacy_ratio"),
    findKpi(kpiMap, "return_on_assets"),
    findKpi(kpiMap, "return_on_equity"),
    findKpi(kpiMap, "operational_expense_ratio"),
    findKpi(kpiMap, "loan_loss_coverage"),
    findKpi(kpiMap, "liquid_funds_ratio"),
    findKpi(kpiMap, "operational_self_sufficiency"),
  ].filter((k) => k !== undefined);

  const renderStatusBadge = (status?: string) => {
    if (status === "green")
      return (
        <span className="text-green-500">
          <ShieldCheck className="size-4 inline mr-1" /> {t("printReports.green")}
        </span>
      );
    if (status === "red")
      return (
        <span className="text-red-500">
          <ShieldAlert className="size-4 inline mr-1" /> {t("printReports.red")}
        </span>
      );
    return (
      <span className="text-amber-500">
        <Shield className="size-4 inline mr-1" /> {t("printReports.amber")}
      </span>
    );
  };

  const totalAssetsFormatted =
    findKpi(kpiMap, "total_assets")?.formatted ?? "a significant portion";

  const ratioChartData = complianceKpis
    .filter((k) => k.unit === "percent" && k.benchmark !== undefined && k.benchmark !== null)
    .map((k) => ({
      name: k.name.replace(/_/g, " ").toUpperCase(),
      value: k.value ?? 0,
      benchmark: k.benchmark ?? 0,
    }));

  return (
    <div className="report-sheet relative w-[210mm] min-h-[268mm] p-16 block break-after-page bg-white font-sans">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        {t("printReports.performanceReport")}
      </h2>
      <h3 className="text-lg font-semibold text-slate-700 mb-4">
        {t("printReports.executiveSummary")}
      </h3>

      {/* Header Block */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-y-2 gap-x-8 text-xs">
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.cooperativeName")}</span>{" "}
          <span className="text-slate-800">{coopName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.registrationNo")}</span>{" "}
          <span className="text-slate-800">
            {cooperative?.id?.slice(0, 8).toUpperCase() ?? t("printReports.n/a")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.reportingPeriod")}</span>{" "}
          <span className="text-slate-800">{submission.reporting_year}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.institutionType")}</span>{" "}
          <span className="text-slate-800 capitalize">
            {cooperative?.institution_type ?? t("printReports.n/a")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.region")}</span>{" "}
          <span className="text-slate-800 capitalize">
            {cooperative?.region ?? t("printReports.n/a")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-600">{t("printReports.status")}</span>{" "}
          <span
            className={`font-bold capitalize ${submission.status === "approved" ? "text-green-600" : "text-slate-800"}`}
          >
            {submission.status
              ? t(`submissions.status.${submission.status}`, submission.status)
              : t("printReports.draft")}
          </span>
        </div>
      </div>

      {/* AI Insight */}
      <AiInsightBox
        title="Executive Summary & Key Strengths"
        content={narratives?.executive_summary}
        fallbackContent={
          <>
            This cooperative's total assets represent {totalAssetsFormatted} of the national
            cooperative sector total. The sector's average PAR30 is roughly 8.2%, and this
            cooperative's asset quality continues to be monitored closely against regulatory limits.
          </>
        }
      />

      {/* Financial Highlights */}
      <h4 className="text-sm font-bold text-slate-800 mb-2">
        {t("printReports.financialHighlights")}
      </h4>
      <table className="w-full text-left text-xs border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 font-semibold">{t("printReports.metric")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.current")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.priorYear")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.yoyChange")}</th>
            <th className="px-3 py-2 font-semibold text-center">{t("printReports.trend")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {[
            "total_assets",
            "gross_loan_portfolio",
            "total_member_deposits",
            "total_equity",
            "net_surplus",
          ].map((key) => {
            const kpi = findKpi(kpiMap, key);
            const priorKpi = kpisData?.prior_year_kpis?.find((k) => k.name === key);
            if (!kpi) return null;

            const yoyChange = kpi.value && priorKpi?.value ? kpi.value - priorKpi.value : null;

            return (
              <tr key={kpi.name} className="hover:bg-slate-50">
                <td className="px-3 py-2">{kpi.description}</td>
                <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                <td className="px-3 py-2">{priorKpi?.formatted ?? "—"}</td>
                <td className="px-3 py-2">
                  {yoyChange !== null ? formatCurrency(yoyChange) : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {yoyChange !== null ? (yoyChange > 0 ? "▲" : yoyChange < 0 ? "▼" : "—") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Key Ratios */}
      <h4 className="text-sm font-bold text-slate-800 mb-2">{t("printReports.keyRatios")}</h4>
      <table className="w-full text-left text-xs border-collapse page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 font-semibold">{t("printReports.ratio")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.value")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.benchmark")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.status")}</th>
            <th className="px-3 py-2 font-semibold">{t("printReports.yoy")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {complianceKpis.map((kpi) => {
            const priorKpi = kpisData?.prior_year_kpis?.find((k) => k.name === kpi.name);
            const yoyDisplay = calculateYoY(kpi.value, priorKpi?.value);
            return (
              <tr key={kpi.name} className="hover:bg-slate-50">
                <td className="px-3 py-2">{kpi.description}</td>
                <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                <td className="px-3 py-2 text-slate-500">
                  {kpi.benchmark
                    ? kpi.unit === "percent"
                      ? `${kpi.benchmark}%`
                      : kpi.benchmark
                    : "—"}
                </td>
                <td className="px-3 py-2">{renderStatusBadge(kpi.status)}</td>
                <td className="px-3 py-2 text-slate-500">{yoyDisplay}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {ratioChartData.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-6">
          <h4 className="text-sm font-bold text-slate-800 mb-2">
            {t("printReports.ratioBenchmarkChart")}
          </h4>
          <BarChart
            width={680}
            height={240}
            data={ratioChartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: "bold" }}
              interval={0}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
            <Bar
              dataKey="value"
              name={t("printReports.current")}
              fill="#2563eb"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="benchmark"
              name={t("printReports.benchmark")}
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </div>
      )}

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span></span>
        <span>
          SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}
        </span>
      </div>
    </div>
  );
};
export default ReportExecutiveSummary;
