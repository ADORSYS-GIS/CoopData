import React from "react";
import { ReportDataProps } from "./types";
import { AiInsightBox } from "./AiInsightBox";
import { useTranslation } from "react-i18next";

export const ReportBenchmarkComparison: React.FC<ReportDataProps> = ({
  kpisData,
  submission,
  submissionId,
  narratives,
}) => {
  const { t } = useTranslation();
  return (
    <div className="report-sheet relative w-[210mm] min-h-[268mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        {t("printReports.pearlsBenchmarkComparisonTitle")}
      </h2>

      <AiInsightBox
        title="Benchmark Analysis"
        content={narratives?.benchmark_comparison}
        fallbackContent={
          <>
            This section compares the cooperative's key performance indicators against the standard
            PEARLS and sector benchmarks. Status indicators highlight areas of strength and
            potential risk.
          </>
        }
      />

      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold w-[25%]">
              {t("printReports.headers.indicator")}
            </th>
            <th className="px-2 py-1 font-semibold w-[35%]">
              {t("printReports.headers.description")}
            </th>
            <th className="px-2 py-1 font-semibold text-right w-[15%]">
              {t("printReports.headers.value")}
            </th>
            <th className="px-2 py-1 font-semibold text-center w-[12%]">
              {t("printReports.headers.benchmark")}
            </th>
            <th className="px-2 py-1 font-semibold text-center w-[13%]">
              {t("printReports.headers.status")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {(kpisData.kpis || []).map((kpi) => (
            <tr key={kpi.name} className="hover:bg-slate-50">
              <td className="px-2 py-1 font-medium">{kpi.name.replace(/_/g, " ").toUpperCase()}</td>
              <td className="px-2 py-1">{kpi.description}</td>
              <td className="px-2 py-1 text-right font-bold">{kpi.formatted}</td>
              <td className="px-2 py-1 text-center">
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
        <span>{t("printReports.endOfReport")}</span>
        <span>
          SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}
        </span>
      </div>
    </div>
  );
};
