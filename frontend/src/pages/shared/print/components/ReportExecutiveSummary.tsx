import React from "react";
import { ReportDataProps } from "./types";
import { findKpi, formatCurrency, calculateYoY } from "./utils";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

export const ReportExecutiveSummary: React.FC<ReportDataProps> = ({
  submission,
  submissionId,
  cooperative,
  coopName,
  kpiMap,
  kpisData,
}) => {
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
    if (status === "green") return <span className="text-green-500"><ShieldCheck className="size-4 inline mr-1" /> Green</span>;
    if (status === "red") return <span className="text-red-500"><ShieldAlert className="size-4 inline mr-1" /> Red</span>;
    return <span className="text-amber-500"><Shield className="size-4 inline mr-1" /> Amber</span>;
  };

  const totalAssetsFormatted = findKpi(kpiMap, 'total_assets')?.formatted ?? 'a significant portion';

  return (
    <div className="w-[210mm] min-h-[296mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        Section A: Coop Performance Report
      </h2>
      <h3 className="text-lg font-semibold text-slate-700 mb-4">Sheet 1: "Executive Summary"</h3>
      
      {/* Header Block */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-y-2 gap-x-8 text-xs">
        <div className="flex justify-between"><span className="font-bold text-slate-600">Cooperative Name</span> <span className="text-slate-800">{coopName}</span></div>
        <div className="flex justify-between"><span className="font-bold text-slate-600">Registration No</span> <span className="text-slate-800">{cooperative?.id?.slice(0, 8).toUpperCase() ?? "N/A"}</span></div>
        <div className="flex justify-between"><span className="font-bold text-slate-600">Reporting Period</span> <span className="text-slate-800">{submission.reporting_year}</span></div>
        <div className="flex justify-between"><span className="font-bold text-slate-600">Institution Type</span> <span className="text-slate-800 capitalize">{cooperative?.institution_type ?? "N/A"}</span></div>
        <div className="flex justify-between"><span className="font-bold text-slate-600">Region</span> <span className="text-slate-800 capitalize">{cooperative?.region ?? "N/A"}</span></div>
        <div className="flex justify-between"><span className="font-bold text-slate-600">Status</span> <span className={`font-bold capitalize ${submission.status === "approved" ? "text-green-600" : "text-slate-800"}`}>{submission.status ?? "Draft"}</span></div>
      </div>

      {/* Sector Context */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 text-xs text-blue-900 leading-relaxed">
        <p className="font-semibold mb-1">Sector Context</p>
        This cooperative's total assets represent {totalAssetsFormatted} of the national cooperative sector total. The sector's average PAR30 is roughly 8.2%, and this cooperative's asset quality continues to be monitored closely against regulatory limits.
      </div>

      {/* Financial Highlights */}
      <h4 className="text-sm font-bold text-slate-800 mb-2">Financial Highlights</h4>
      <table className="w-full text-left text-xs border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 font-semibold">Metric</th>
            <th className="px-3 py-2 font-semibold">Current</th>
            <th className="px-3 py-2 font-semibold">Prior Year</th>
            <th className="px-3 py-2 font-semibold">YoY Change (SZL)</th>
            <th className="px-3 py-2 font-semibold text-center">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {[
            "total_assets",
            "gross_loan_portfolio",
            "total_member_deposits",
            "total_equity",
            "net_surplus"
          ].map(key => {
            const kpi = findKpi(kpiMap, key);
            const priorKpi = kpisData?.prior_year_kpis?.find((k) => k.name === key);
            if (!kpi) return null;
            
            const yoyChange = (kpi.value && priorKpi?.value) ? kpi.value - priorKpi.value : null;
            
            return (
              <tr key={kpi.name} className="hover:bg-slate-50">
                <td className="px-3 py-2">{kpi.description}</td>
                <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                <td className="px-3 py-2">{priorKpi?.formatted ?? "—"}</td>
                <td className="px-3 py-2">{yoyChange !== null ? formatCurrency(yoyChange) : "—"}</td>
                <td className="px-3 py-2 text-center">{yoyChange !== null ? (yoyChange > 0 ? "▲" : (yoyChange < 0 ? "▼" : "—")) : "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Key Ratios */}
      <h4 className="text-sm font-bold text-slate-800 mb-2">Key Ratios</h4>
      <table className="w-full text-left text-xs border-collapse page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 font-semibold">Ratio</th>
            <th className="px-3 py-2 font-semibold">Value</th>
            <th className="px-3 py-2 font-semibold">Benchmark</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">YoY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {complianceKpis.map(kpi => {
            const priorKpi = kpisData?.prior_year_kpis?.find(k => k.name === kpi.name);
            const yoyDisplay = calculateYoY(kpi.value, priorKpi?.value);
            return (
              <tr key={kpi.name} className="hover:bg-slate-50">
                <td className="px-3 py-2">{kpi.description}</td>
                <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                <td className="px-3 py-2 text-slate-500">{kpi.benchmark ? (kpi.unit === 'percent' ? `${kpi.benchmark}%` : kpi.benchmark) : "—"}</td>
                <td className="px-3 py-2">{renderStatusBadge(kpi.status)}</td>
                <td className="px-3 py-2 text-slate-500">{yoyDisplay}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span>Page 2</span>
        <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
      </div>
    </div>
  );
};
