import React from "react";
import { ReportDataProps } from "./types";
import { getLineItem, calculateYoY, formatCurrency } from "./utils";

export const ReportFinancialPosition: React.FC<ReportDataProps> = ({
  lineItemsData,
  submission,
  submissionId,
}) => {
  const assetsYoY = calculateYoY(
    getLineItem(lineItemsData, "1999"),
    getLineItem(lineItemsData, "1999", true)
  );

  return (
    <div className="w-[210mm] h-[296mm] p-16 flex flex-col page-break-after bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        Sheet 2: "Financial Position"
      </h2>

      <div className="bg-slate-50 p-4 mb-6 text-xs text-slate-700 leading-relaxed border border-slate-200 rounded">
        <p className="font-semibold mb-1">Narrative</p>
        Total assets showed a {assetsYoY.startsWith("+") || assetsYoY === "—" ? "positive trend" : "decline"} year-on-year, driven by changes in member deposits and equity. The detailed balance sheet and income statement below reflect the financial health for the period.
      </div>

      <h3 className="text-sm font-bold text-slate-800 mb-2">Balance Sheet</h3>
      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">Account Code</th>
            <th className="px-2 py-1 font-semibold">Account Name</th>
            <th className="px-2 py-1 font-semibold text-right">Current Year (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">Prior Year (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">YoY Change (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">% of Assets</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1">1999</td>
            <td className="px-2 py-1">Total Assets</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "1999"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "1999", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "1999"), getLineItem(lineItemsData, "1999", true))}</td>
            <td className="px-2 py-1 text-right">100.0%</td>
          </tr>
          <tr>
            <td className="px-2 py-1">2101</td>
            <td className="px-2 py-1">Member Savings Deposits</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "2101"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "2101", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "2101"), getLineItem(lineItemsData, "2101", true))}</td>
            <td className="px-2 py-1 text-right">{getLineItem(lineItemsData, "1999") ? ((getLineItem(lineItemsData, "2101") || 0) / (getLineItem(lineItemsData, "1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
          </tr>
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1">2999</td>
            <td className="px-2 py-1">Total Liabilities</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "2999"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "2999", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "2999"), getLineItem(lineItemsData, "2999", true))}</td>
            <td className="px-2 py-1 text-right">{getLineItem(lineItemsData, "1999") ? ((getLineItem(lineItemsData, "2999") || 0) / (getLineItem(lineItemsData, "1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
          </tr>
          <tr className="bg-slate-200 font-bold text-blue-900">
            <td className="px-2 py-1">3999</td>
            <td className="px-2 py-1">Total Equity</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "3999"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "3999", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "3999"), getLineItem(lineItemsData, "3999", true))}</td>
            <td className="px-2 py-1 text-right">{getLineItem(lineItemsData, "1999") ? ((getLineItem(lineItemsData, "3999") || 0) / (getLineItem(lineItemsData, "1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-sm font-bold text-slate-800 mb-2">Income Statement</h3>
      <table className="w-full text-left text-[10px] border-collapse page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">Account Code</th>
            <th className="px-2 py-1 font-semibold">Account Name</th>
            <th className="px-2 py-1 font-semibold text-right">Current Year (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">Prior Year (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">YoY Change (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">% of Income</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1">5999</td>
            <td className="px-2 py-1">Total Income</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "5999"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "5999", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "5999"), getLineItem(lineItemsData, "5999", true))}</td>
            <td className="px-2 py-1 text-right">100.0%</td>
          </tr>
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1">6499</td>
            <td className="px-2 py-1">Total Expenses</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "6499"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "6499", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "6499"), getLineItem(lineItemsData, "6499", true))}</td>
            <td className="px-2 py-1 text-right">{getLineItem(lineItemsData, "5999") ? ((getLineItem(lineItemsData, "6499") || 0) / (getLineItem(lineItemsData, "5999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
          </tr>
          <tr className="bg-slate-200 font-bold text-blue-900">
            <td className="px-2 py-1">6999</td>
            <td className="px-2 py-1">Net Surplus</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "6999"))}</td>
            <td className="px-2 py-1 text-right">{formatCurrency(getLineItem(lineItemsData, "6999", true))}</td>
            <td className="px-2 py-1 text-right">{calculateYoY(getLineItem(lineItemsData, "6999"), getLineItem(lineItemsData, "6999", true))}</td>
            <td className="px-2 py-1 text-right">{getLineItem(lineItemsData, "5999") ? ((getLineItem(lineItemsData, "6999") || 0) / (getLineItem(lineItemsData, "5999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span>Page 4</span>
        <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
      </div>
    </div>
  );
};
