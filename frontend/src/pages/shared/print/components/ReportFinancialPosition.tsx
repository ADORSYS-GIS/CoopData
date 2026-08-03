import React, { useMemo } from "react";
import { ReportDataProps } from "./types";
import { getLineItem, calculateYoY, formatCurrency } from "./utils";
import { LineItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import { useTranslation } from "react-i18next";

export const ReportFinancialPosition: React.FC<ReportDataProps> = ({
  lineItemsData,
  submission,
  submissionId,
}) => {
  const { t } = useTranslation();
  const assetsYoY = calculateYoY(
    getLineItem(lineItemsData, 1999),
    getLineItem(lineItemsData, 1999, true),
  );

  const { balanceSheetItems, incomeStatementItems } = useMemo(() => {
    const items = lineItemsData?.current_year || [];

    // Deduplicate by account_code (take the latest month or first seen)
    const uniqueItemsMap = new Map<number, LineItemResponse>();
    items.forEach((item) => {
      if (item.account_code === undefined) return;
      const existing = uniqueItemsMap.get(item.account_code);
      // Assuming month is available, prefer the higher month (closer to year-end YTD)
      // Otherwise just keep the first one
      if (!existing || (item.month && existing.month && item.month > existing.month)) {
        uniqueItemsMap.set(item.account_code, item);
      }
    });

    const uniqueItems = Array.from(uniqueItemsMap.values());

    const sorted = uniqueItems.sort((a, b) => {
      return (a.account_code ?? 0) - (b.account_code ?? 0);
    });

    const bsCategories = ["assets", "liabilities", "equity"];
    const isCategories = ["income", "expenses", "surplus"];

    return {
      balanceSheetItems: sorted.filter((i) =>
        bsCategories.includes(i.account_category.toLowerCase()),
      ),
      incomeStatementItems: sorted.filter((i) =>
        isCategories.includes(i.account_category.toLowerCase()),
      ),
    };
  }, [lineItemsData]);

  const totalAssets = getLineItem(lineItemsData, 1999);
  const totalIncome = getLineItem(lineItemsData, 5999);

  const renderRow = (item: LineItemResponse, totalVal: number | undefined) => {
    if (!item.account_code) return null;
    const code = item.account_code;
    const currentVal = item.value;
    const priorVal = getLineItem(lineItemsData, code, true);

    const isTotal = code % 1000 === 999;
    const isHeader = code % 100 === 0 && !isTotal;
    const isSuperTotal =
      code === 1999 ||
      code === 2999 ||
      code === 3999 ||
      code === 5999 ||
      code === 6499 ||
      code === 6999;

    let percentage = "—";
    if (totalVal && currentVal !== undefined && currentVal !== null) {
      percentage = ((currentVal / totalVal) * 100).toFixed(1) + "%";
    }

    // Don't calculate % for header rows
    if (isHeader) percentage = "";

    return (
      <tr
        key={item.id}
        className={`${isSuperTotal ? "bg-slate-200 font-bold text-blue-900" : isTotal ? "bg-slate-100 font-bold" : isHeader ? "bg-slate-50 font-semibold italic" : ""}`}
      >
        <td className="px-2 py-1">{code}</td>
        <td className={`px-2 py-1 ${isHeader ? "" : isTotal ? "pl-2" : "pl-6"}`}>
          {item.account_name}
        </td>
        <td className="px-2 py-1 text-right">{formatCurrency(currentVal)}</td>
        <td className="px-2 py-1 text-right">{formatCurrency(priorVal)}</td>
        <td className="px-2 py-1 text-right">{calculateYoY(currentVal, priorVal)}</td>
        <td className="px-2 py-1 text-right">{percentage}</td>
      </tr>
    );
  };

  return (
    <div className="w-[210mm] min-h-[296mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        {t("printReports.financialPositionTitle")}
      </h2>

      <div className="bg-slate-50 p-4 mb-6 text-xs text-slate-700 leading-relaxed border border-slate-200 rounded">
        <p className="font-semibold mb-1">{t("printReports.narrative")}</p>
        {t("printReports.totalAssetsNarrativeStart")}{" "}
        {assetsYoY.startsWith("+") || assetsYoY === "—" ? t("printReports.positiveTrend") : t("printReports.decline")}{" "}
        {t("printReports.totalAssetsNarrativeEnd")}
      </div>

      <h3 className="text-lg font-semibold text-slate-700 mb-4">{t("printReports.balanceSheet")}</h3>
      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountCode")}</th>
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountName")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.currentYearSzl")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.priorYearSzl")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.yoyChange")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.percentOfAssets")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {balanceSheetItems.length > 0 ? (
            balanceSheetItems.map((item) => renderRow(item, totalAssets))
          ) : (
            <tr>
              <td colSpan={6} className="px-2 py-4 text-center text-slate-500 italic">
                {t("printReports.noBalanceSheetData")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 className="text-sm font-bold text-slate-800 mb-2">{t("printReports.incomeStatement")}</h3>
      <table className="w-full text-left text-[10px] border-collapse page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountCode")}</th>
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountName")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.currentYearSzl")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.priorYearSzl")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.yoyChange")}</th>
            <th className="px-2 py-1 font-semibold text-right">{t("printReports.headers.percentOfIncome")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {incomeStatementItems.length > 0 ? (
            incomeStatementItems.map((item) => renderRow(item, totalIncome))
          ) : (
            <tr>
              <td colSpan={6} className="px-2 py-4 text-center text-slate-500 italic">
                {t("printReports.noIncomeStatementData")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span></span>
        <span>
          SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}
        </span>
      </div>
    </div>
  );
};
