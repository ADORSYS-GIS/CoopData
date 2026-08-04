import React from "react";
import { useTranslation } from "react-i18next";
import type {
  NationalOverviewResponse,
  CoopKpiRow,
  KpiValue,
} from "@/hooks/analytics/useNationalOverview";
import { AiInsightBox } from "./AiInsightBox";

interface ConsolidatedRiskWatchSheetProps {
  data: NationalOverviewResponse;
  narratives?: string;
}

export const ConsolidatedRiskWatchSheet: React.FC<ConsolidatedRiskWatchSheetProps> = ({ data }) => {
  const { t } = useTranslation();
  const { cooperatives } = data;

  const getAction = (kpiName: string) => {
    if (kpiName === "par30" || kpiName === "par90")
      return t("printReports.riskWatch.actions.remedialPlan");
    if (kpiName === "capital_adequacy_ratio")
      return t("printReports.riskWatch.actions.capitalInjection");
    if (kpiName === "operating_expense_ratio")
      return t("printReports.riskWatch.actions.costReduction");
    if (kpiName === "roa" || kpiName === "roe")
      return t("printReports.riskWatch.actions.profitabilityReview");
    if (kpiName === "liquid_funds_ratio") return t("printReports.riskWatch.actions.liquidityPlan");
    return t("printReports.riskWatch.actions.followUp");
  };

  const getThresholdStr = (kpiName: string, benchmark: number | null | undefined) => {
    if (benchmark == null) return "—";
    if (["par30", "par90", "npl_ratio", "operating_expense_ratio"].includes(kpiName)) {
      return `<= ${benchmark.toFixed(1)}%`;
    }
    return `>= ${benchmark.toFixed(1)}%`;
  };

  const getSeverity = (kpiName: string) => {
    if (["par30", "capital_adequacy_ratio", "liquid_funds_ratio"].includes(kpiName))
      return t("printReports.riskWatch.severities.critical");
    return t("printReports.riskWatch.severities.high");
  };

  // Find all red KPIs
  const riskRows: {
    coopName: string;
    kpiName: string;
    value: number;
    formatted: string;
    benchmark: number | null;
  }[] = [];
  cooperatives.forEach((coop: CoopKpiRow) => {
    if (!coop.kpis) return;
    Object.entries(coop.kpis).forEach(([kpiName, kpiVal]: [string, KpiValue]) => {
      if (kpiVal.status === "red") {
        riskRows.push({
          coopName: coop.name,
          kpiName,
          value: kpiVal.value,
          formatted: kpiVal.formatted,
          benchmark: kpiVal.benchmark,
        });
      }
    });
  });

  return (
    <div className="report-sheet relative flex flex-col w-[210mm] min-h-[268mm] p-12 bg-white break-after-page font-sans">
      <div>
        <h2 className="text-xl font-bold text-blue-800 mb-4">
          {t("printReports.riskWatch.title")}
        </h2>
        <p className="text-sm text-slate-600 mb-6 italic">
          {t("printReports.riskWatch.description")}
        </p>

        {riskRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-lg bg-slate-50">
            {t("printReports.riskWatch.noHighRisk")}
          </div>
        ) : (
          <table className="w-full text-left text-xs mb-8 border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 border border-slate-700">
                  {t("printReports.riskWatch.cooperative")}
                </th>
                <th className="p-2 border border-slate-700">
                  {t("printReports.riskWatch.riskIndicator")}
                </th>
                <th className="p-2 border border-slate-700">{t("printReports.riskWatch.value")}</th>
                <th className="p-2 border border-slate-700">
                  {t("printReports.riskWatch.threshold")}
                </th>
                <th className="p-2 border border-slate-700">
                  {t("printReports.riskWatch.severity")}
                </th>
                <th className="p-2 border border-slate-700">
                  {t("printReports.riskWatch.actionRequired")}
                </th>
              </tr>
            </thead>
            <tbody>
              {riskRows.map((row, i) => {
                const bgClass = i % 2 === 0 ? "bg-white" : "bg-slate-50";
                return (
                  <tr key={`${row.coopName}-${row.kpiName}`} className={bgClass}>
                    <td className="p-2 border border-slate-300 font-bold truncate max-w-[150px]">
                      {row.coopName}
                    </td>
                    <td className="p-2 border border-slate-300 capitalize">
                      {row.kpiName.replace(/_/g, " ")}
                    </td>
                    <td className="p-2 border border-slate-300 font-bold text-red-600 whitespace-nowrap">
                      {row.formatted}{" "}
                      <span className="w-2 h-2 inline-block rounded-full bg-red-500 ml-1"></span>
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {getThresholdStr(row.kpiName, row.benchmark)}
                    </td>
                    <td className="p-2 border border-slate-300">{getSeverity(row.kpiName)}</td>
                    <td className="p-2 border border-slate-300">{getAction(row.kpiName)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-4 border-t border-slate-200 mt-auto">
        <p></p>
        <p></p>
      </div>
    </div>
  );
};
export default ConsolidatedRiskWatchSheet;
