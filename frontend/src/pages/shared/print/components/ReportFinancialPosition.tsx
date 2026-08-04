import React, { useMemo } from "react";
import { ReportDataProps } from "./types";
import { getLineItem, calculateYoY, formatCurrency } from "./utils";
import { LineItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import { useTranslation } from "react-i18next";
import { AiInsightBox } from "./AiInsightBox";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const ReportFinancialPosition: React.FC<ReportDataProps> = ({
  lineItemsData,
  submission,
  submissionId,
  narratives,
}) => {
  const { t } = useTranslation();
  const assetsYoY = calculateYoY(
    getLineItem(lineItemsData, 1999),
    getLineItem(lineItemsData, 1999, true),
  );

  const { balanceSheetItems, incomeStatementItems, positionChartData } = useMemo(() => {
    const items = lineItemsData?.current_year || [];
    const priorItems = lineItemsData?.prior_year || [];

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

    const sumByCategory = (list: LineItemResponse[], categories: string[]) =>
      list
        .filter((i) => categories.includes(i.account_category.toLowerCase()))
        .reduce((acc, i) => acc + (i.value ?? 0), 0);

    const positionChartData = [
      {
        name: t("printReports.assets"),
        current: sumByCategory(items, ["assets"]),
        prior: sumByCategory(priorItems, ["assets"]),
      },
      {
        name: t("printReports.liabilities"),
        current: sumByCategory(items, ["liabilities"]),
        prior: sumByCategory(priorItems, ["liabilities"]),
      },
      {
        name: t("printReports.equity"),
        current: sumByCategory(items, ["equity"]),
        prior: sumByCategory(priorItems, ["equity"]),
      },
    ];

    return {
      balanceSheetItems: sorted.filter((i) =>
        bsCategories.includes(i.account_category.toLowerCase()),
      ),
      incomeStatementItems: sorted.filter((i) =>
        isCategories.includes(i.account_category.toLowerCase()),
      ),
      positionChartData,
    };
  }, [lineItemsData, t]);

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
    <div className="report-sheet relative w-[210mm] min-h-[268mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        {t("printReports.financialPositionTitle")}
      </h2>

      <AiInsightBox
        title="Financial Position Insights"
        content={narratives?.financial_position}
        fallbackContent={
          <>
            Total assets showed a{" "}
            {assetsYoY.startsWith("+") || assetsYoY === "—" ? "positive trend" : "decline"}{" "}
            year-on-year, driven by changes in member deposits and equity. The detailed balance
            sheet and income statement below reflect the financial health for the period.
          </>
        }
      />

      <h3 className="text-lg font-semibold text-slate-700 mb-4">
        {t("printReports.balanceSheet")}
      </h3>

      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-6">
        <h4 className="text-sm font-bold text-slate-800 mb-2">
          {t("printReports.financialPositionChart")}
        </h4>
        <BarChart
          width={680}
          height={240}
          data={positionChartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fontWeight: "bold" }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
          <Bar
            dataKey="current"
            name={t("printReports.currentYear")}
            fill="#2563eb"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="prior"
            name={t("printReports.priorYear")}
            fill="#94a3b8"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </div>

      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountCode")}</th>
            <th className="px-2 py-1 font-semibold">{t("printReports.headers.accountName")}</th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.currentYearSzl")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.priorYearSzl")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.yoyChange")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.percentOfAssets")}
            </th>
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
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.currentYearSzl")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.priorYearSzl")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.yoyChange")}
            </th>
            <th className="px-2 py-1 font-semibold text-right">
              {t("printReports.headers.percentOfIncome")}
            </th>
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
