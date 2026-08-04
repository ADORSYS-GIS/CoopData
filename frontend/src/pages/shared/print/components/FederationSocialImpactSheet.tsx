import React, { useEffect } from "react";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";
import { useTranslation } from "react-i18next";

interface FederationSocialImpactSheetProps {
  federationName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
}

export const FederationSocialImpactSheet: React.FC<FederationSocialImpactSheetProps> = ({
  federationName,
  year,
  data,
  priorData,
}) => {
  const { t } = useTranslation();
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];
  const priorCoops: CoopKpiRow[] = priorData?.cooperatives || [];

  const getSum = (coops: CoopKpiRow[], key: keyof CoopKpiRow["non_financial"]) => {
    return coops.reduce((acc, c) => {
      const val = c.non_financial?.[key];
      return acc + (typeof val === "number" ? val : 0);
    }, 0);
  };

  const getAvg = (coops: CoopKpiRow[], key: keyof CoopKpiRow["non_financial"]) => {
    const valid = coops.filter((c) => c.has_data && typeof c.non_financial?.[key] === "number");
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, c) => acc + (c.non_financial[key] as number), 0);
    return sum / valid.length;
  };

  const currentImpact = {
    savers: getSum(cooperatives, "active_members"), // Approximation for active savers
    borrowers: getSum(cooperatives, "active_borrowers"),
    savPenetration: getAvg(cooperatives, "savings_penetration_pct"),
    credPenetration: getAvg(cooperatives, "credit_penetration_pct"),
    womenBorrowers: getSum(cooperatives, "women_borrowers"),
    youthBorrowers: getSum(cooperatives, "youth_borrowers"),
    ruralBorrowers: getSum(cooperatives, "rural_borrowers"),
  };

  const priorImpact = {
    savers: getSum(priorCoops, "active_members"),
    borrowers: getSum(priorCoops, "active_borrowers"),
    savPenetration: getAvg(priorCoops, "savings_penetration_pct"),
    credPenetration: getAvg(priorCoops, "credit_penetration_pct"),
    womenBorrowers: getSum(priorCoops, "women_borrowers"),
    youthBorrowers: getSum(priorCoops, "youth_borrowers"),
    ruralBorrowers: getSum(priorCoops, "rural_borrowers"),
  };

  const calcYoY = (curr: number, prior: number, isPct: boolean = false) => {
    if (!prior || prior === 0) return { text: "-", dir: "flat" };
    if (isPct) {
      const diff = curr - prior;
      return {
        text: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp`,
        dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      };
    } else {
      const change = ((curr - prior) / prior) * 100;
      return {
        text: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        dir: change > 0 ? "up" : change < 0 ? "down" : "flat",
      };
    }
  };

  const renderYoY = (curr: number, prior: number, isPct: boolean = false) => {
    if (!prior && prior !== 0) return <td className="p-3 border border-slate-300 text-right">-</td>;
    const yoy = calcYoY(curr, prior, isPct);
    let color = "text-slate-600";
    if (yoy.dir === "up") color = "text-green-600";
    if (yoy.dir === "down") color = "text-red-600";
    return (
      <td className={`p-3 border border-slate-300 text-right font-bold ${color}`}>
        {yoy.text} {yoy.dir === "up" && "▲"}
        {yoy.dir === "down" && "▼"}
      </td>
    );
  };

  const totalLoans = getSum(cooperatives, "active_borrowers"); // Using active_borrowers as total loans approximation for %

  useEffect(() => {
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  return (
    <div
      className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900"
      style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
    >
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {t("printReports.socialImpactSummaryTitle")}
          </h1>
          <h2 className="text-xl text-slate-600 mt-1">{federationName}</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-700">
            {t("printReports.period", { year })}
          </p>
          <p className="text-sm text-slate-500"></p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-8">
        <div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-left border border-slate-900 w-1/2">
                  {t("printReports.headers.metric")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.current")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.priorYear")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.yoy")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.savers")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.savers.toLocaleString()}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.savers.toLocaleString()}
                </td>
                {renderYoY(currentImpact.savers, priorImpact.savers)}
              </tr>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.borrowers")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.borrowers.toLocaleString()}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.borrowers.toLocaleString()}
                </td>
                {renderYoY(currentImpact.borrowers, priorImpact.borrowers)}
              </tr>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.savingsPenetration")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.savPenetration.toFixed(1)}%
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.savPenetration.toFixed(1)}%
                </td>
                {renderYoY(currentImpact.savPenetration, priorImpact.savPenetration, true)}
              </tr>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.creditPenetration")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.credPenetration.toFixed(1)}%
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.credPenetration.toFixed(1)}%
                </td>
                {renderYoY(currentImpact.credPenetration, priorImpact.credPenetration, true)}
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-800 mb-4">
            {t("printReports.creditFlowPriority")}
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-3 text-left border border-slate-900">
                  {t("printReports.headers.segment")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.currentBorrowers")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.percentOfTotalBorrowers")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.priorYear")}
                </th>
                <th className="p-3 text-right border border-slate-900">
                  {t("printReports.headers.yoy")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.womenBorrowers")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.womenBorrowers.toLocaleString()}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {totalLoans > 0
                    ? ((currentImpact.womenBorrowers / totalLoans) * 100).toFixed(1)
                    : 0}
                  %
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.womenBorrowers.toLocaleString()}
                </td>
                {renderYoY(currentImpact.womenBorrowers, priorImpact.womenBorrowers)}
              </tr>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.youthBorrowers")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.youthBorrowers.toLocaleString()}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {totalLoans > 0
                    ? ((currentImpact.youthBorrowers / totalLoans) * 100).toFixed(1)
                    : 0}
                  %
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.youthBorrowers.toLocaleString()}
                </td>
                {renderYoY(currentImpact.youthBorrowers, priorImpact.youthBorrowers)}
              </tr>
              <tr className="even:bg-slate-50">
                <td className="p-3 border border-slate-300 font-medium">
                  {t("printReports.socialImpact.ruralBorrowers")}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {currentImpact.ruralBorrowers.toLocaleString()}
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {totalLoans > 0
                    ? ((currentImpact.ruralBorrowers / totalLoans) * 100).toFixed(1)
                    : 0}
                  %
                </td>
                <td className="p-3 border border-slate-300 text-right">
                  {priorImpact.ruralBorrowers.toLocaleString()}
                </td>
                {renderYoY(currentImpact.ruralBorrowers, priorImpact.ruralBorrowers)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
