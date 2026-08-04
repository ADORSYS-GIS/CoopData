import React from "react";
import { useTranslation } from "react-i18next";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";

interface ConsolidatedCoopDetailSheetProps {
  data: NationalOverviewResponse;
}

export const ConsolidatedCoopDetailSheet: React.FC<ConsolidatedCoopDetailSheetProps> = ({
  data,
}) => {
  const { t } = useTranslation();
  const { cooperatives } = data;

  const fmtNum = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "—";
    const abs = Math.abs(val);
    if (abs >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toFixed(0);
  };

  const fmtPct = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "—";
    return `${val.toFixed(1)}%`;
  };

  const renderStatus = (val: number | undefined, name: string) => {
    if (val === undefined || isNaN(val)) return null;
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

    return <span className={`w-2 h-2 inline-block rounded-full ${color} ml-1`}></span>;
  };

  const renderKpi = (val: number | undefined, name: string) => {
    if (val === undefined || isNaN(val)) return "—";
    let colorClass = "text-slate-800";
    if (name === "par30")
      colorClass =
        val <= 5 ? "text-green-600" : val <= 10 ? "text-amber-600" : "text-red-600 font-bold";
    if (name === "car")
      colorClass =
        val >= 10 ? "text-green-600" : val >= 8 ? "text-amber-600" : "text-red-600 font-bold";
    if (name === "roa")
      colorClass =
        val >= 3 ? "text-green-600" : val >= 1 ? "text-amber-600" : "text-red-600 font-bold";
    if (name === "roe")
      colorClass =
        val >= 8 ? "text-green-600" : val >= 4 ? "text-amber-600" : "text-red-600 font-bold";
    if (name === "oer")
      colorClass =
        val <= 5 ? "text-green-600" : val <= 8 ? "text-amber-600" : "text-red-600 font-bold";

    return (
      <span className={colorClass}>
        {fmtPct(val)}
        {renderStatus(val, name)}
      </span>
    );
  };

  return (
    <div className="report-sheet relative flex flex-col w-[210mm] min-h-[268mm] p-12 bg-white break-after-page font-sans">
      <div>
        <h2 className="text-xl font-bold text-blue-800 mb-4">
          {t("printReports.coopDetail.cooperativeDetail")}
        </h2>

        <table className="w-full text-left text-[9px] mb-8 border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-900 text-white leading-tight">
              <th className="p-2 border border-slate-700">{t("printReports.coopDetail.coop")}</th>
              <th className="p-2 border border-slate-700 text-center">
                {t("printReports.coopDetail.status")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.assets")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.glp")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.deposits")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.equity")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.surplus")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.par30")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.car")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.roa")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.roe")}
              </th>
              <th className="p-2 border border-slate-700 text-right">
                {t("printReports.coopDetail.oer")}
              </th>
            </tr>
          </thead>
          <tbody>
            {cooperatives.map((coop, i: number) => {
              const kpis = coop.kpis || {};
              const bgClass = i % 2 === 0 ? "bg-white" : "bg-slate-50";
              return (
                <tr key={coop.cooperative_id} className={bgClass}>
                  <td className="p-2 border border-slate-300 font-bold truncate max-w-[120px]">
                    {coop.name}
                  </td>
                  <td className="p-2 border border-slate-300 text-center">
                    {coop.has_data ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-amber-500">⏳</span>
                    )}
                  </td>
                  <td className="p-2 border border-slate-300 text-right">
                    {fmtNum(kpis.total_assets?.value)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right">
                    {fmtNum(kpis.gross_loan_portfolio?.value)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right">
                    {fmtNum(kpis.total_member_deposits?.value)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right">
                    {fmtNum(kpis.total_equity?.value)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right">
                    {fmtNum(kpis.net_surplus?.value)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                    {renderKpi(kpis.par30?.value, "par30")}
                  </td>
                  <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                    {renderKpi(kpis.capital_adequacy_ratio?.value, "car")}
                  </td>
                  <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                    {renderKpi(kpis.roa?.value, "roa")}
                  </td>
                  <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                    {renderKpi(kpis.roe?.value, "roe")}
                  </td>
                  <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                    {renderKpi(kpis.operating_expense_ratio?.value, "oer")}
                  </td>
                </tr>
              );
            })}
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
export default ConsolidatedCoopDetailSheet;
