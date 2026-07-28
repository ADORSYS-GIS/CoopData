import React from "react";
import { ReportDataProps } from "./types";

export const ReportBenchmarkComparison: React.FC<ReportDataProps> = ({
  kpisData,
  submission,
  submissionId,
}) => {
  return (
    <div className="w-[210mm] min-h-[297mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        "PEARLS Benchmark Comparison"
      </h2>

      <div className="bg-slate-50 p-4 mb-6 text-xs text-slate-700 leading-relaxed border border-slate-200 rounded">
        <p className="font-semibold mb-1">Narrative</p>
        This section compares the cooperative's key performance indicators against the standard
        PEARLS and sector benchmarks. Status indicators highlight areas of strength and potential
        risk.
      </div>

      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">Indicator</th>
            <th className="px-2 py-1 font-semibold">Description</th>
            <th className="px-2 py-1 font-semibold text-right">Value</th>
            <th className="px-2 py-1 font-semibold text-right">Benchmark</th>
            <th className="px-2 py-1 font-semibold text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {(kpisData.kpis || []).map((kpi) => (
            <tr key={kpi.name} className="hover:bg-slate-50">
              <td className="px-2 py-1 font-medium">{kpi.name.replace(/_/g, " ").toUpperCase()}</td>
              <td className="px-2 py-1">{kpi.description}</td>
              <td className="px-2 py-1 text-right font-bold">{kpi.formatted}</td>
              <td className="px-2 py-1 text-right">
                {kpi.benchmark !== undefined && kpi.benchmark !== null
                  ? kpi.unit === "percent"
                    ? `${kpi.benchmark}%`
                    : kpi.benchmark
                  : "—"}
              </td>
              <td className="px-2 py-1 text-center">
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    kpi.status === "green"
                      ? "bg-green-100 text-green-800"
                      : kpi.status === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : kpi.status === "red"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {kpi.status || "N/A"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span>End of Report</span>
        <span>
          SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}
        </span>
      </div>
    </div>
  );
};
