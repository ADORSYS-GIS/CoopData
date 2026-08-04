import React, { useEffect } from "react";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import { CoopKpiRow } from "./types";
import { useTranslation } from "react-i18next";
import { AiInsightBox } from "./AiInsightBox";

interface FederationPearlsSheetProps {
  federationName: string;
  year: number;
  data: NationalOverviewResponse;
  narratives?: string;
}

export const FederationPearlsSheet: React.FC<FederationPearlsSheetProps> = ({
  federationName,
  year,
  data,
  narratives,
}) => {
  const { t } = useTranslation();
  const cooperatives: CoopKpiRow[] = data.cooperatives || [];

  const apexNames = Array.from(
    new Set(cooperatives.map((c) => c.apex_name || t("printReports.unaffiliated"))),
  );

  const getAvg = (coops: CoopKpiRow[], kpi: string) => {
    const valid = coops.filter((c) => c.kpis?.[kpi]);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, c) => acc + (c.kpis?.[kpi]?.value || 0), 0);
    return sum / valid.length;
  };

  const renderVal = (val: number, isPercent: boolean = true) => {
    if (val === 0) return "-";
    return isPercent ? val.toFixed(1) + "%" : val.toFixed(1);
  };

  const pearlsDimensions = [
    {
      dimension: t("printReports.pearls.protection"),
      label: t("printReports.pearls.loanLossCoverage"),
      key: "loan_loss_coverage",
    },
    {
      dimension: t("printReports.pearls.protection"),
      label: t("printReports.pearls.provisionsNpl"),
      key: "provisions_npl",
    },
    {
      dimension: t("printReports.pearls.effectiveStructure"),
      label: t("printReports.pearls.netLoansAssets"),
      key: "net_loan_portfolio",
    },
    {
      dimension: t("printReports.pearls.effectiveStructure"),
      label: t("printReports.pearls.depositsAssets"),
      key: "deposits_to_loans",
    },
    {
      dimension: t("printReports.pearls.assetQuality"),
      label: t("printReports.pearls.par30"),
      key: "par30",
    },
    {
      dimension: t("printReports.pearls.assetQuality"),
      label: t("printReports.pearls.nplWriteOff"),
      key: "npl_ratio",
    },
    {
      dimension: t("printReports.pearls.ratesOfReturn"),
      label: t("printReports.pearls.roa"),
      key: "roa",
    },
    {
      dimension: t("printReports.pearls.ratesOfReturn"),
      label: t("printReports.pearls.roe"),
      key: "roe",
    },
    {
      dimension: t("printReports.pearls.liquidity"),
      label: t("printReports.pearls.liquidFunds"),
      key: "liquid_funds_ratio",
    },
    {
      dimension: t("printReports.pearls.signsOfGrowth"),
      label: t("printReports.pearls.assetGrowth"),
      key: "asset_growth",
    },
    {
      dimension: t("printReports.pearls.signsOfGrowth"),
      label: t("printReports.pearls.memberGrowth"),
      key: "member_growth",
    },
  ];

  useEffect(() => {
    setTimeout(() => {
      (window as unknown as { isReady: boolean }).isReady = true;
    }, 1500);
  }, []);

  return (
    <div
      className="print-page w-full min-h-[1122px] flex flex-col bg-white p-12 text-slate-900 border-b border-gray-200"
      style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}
    >
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {t("printReports.pearlsBenchmarkComparisonTitle")}
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

      <div className="flex-1 min-h-0">
        <AiInsightBox
          title="PEARLS Compliance — AI Analysis"
          content={narratives}
          fallbackContent={<>{t("printReports.pearls.mappedKpis")}</>}
        />

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-3 text-left border border-slate-900 w-1/4">
                {t("printReports.pearls.dimension")}
              </th>
              <th className="p-3 text-left border border-slate-900 w-1/4">
                {t("printReports.pearls.kpi")}
              </th>
              {apexNames.map((name) => (
                <th key={name} className="p-3 text-right border border-slate-900">
                  {name}
                </th>
              ))}
              <th className="p-3 text-right border border-slate-900 bg-slate-800">
                {t("printReports.pearls.sectorAvg")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pearlsDimensions.map((row, i) => {
              const sectorAvg = getAvg(cooperatives, row.key);
              return (
                <tr key={i} className="even:bg-slate-50 border-b border-slate-300">
                  <td className="p-3 border-x border-slate-300 font-bold text-slate-700">
                    {row.dimension}
                  </td>
                  <td className="p-3 border-x border-slate-300">{row.label}</td>

                  {apexNames.map((name) => {
                    const apexCoops = cooperatives.filter(
                      (c) =>
                        c.apex_name === name ||
                        (!c.apex_name && name === t("printReports.unaffiliated")),
                    );
                    const apexAvg = getAvg(apexCoops, row.key);
                    return (
                      <td key={name} className="p-3 border-x border-slate-300 text-right">
                        {renderVal(apexAvg)}
                      </td>
                    );
                  })}

                  <td className="p-3 border-x border-slate-300 text-right font-bold bg-slate-100">
                    {renderVal(sectorAvg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
