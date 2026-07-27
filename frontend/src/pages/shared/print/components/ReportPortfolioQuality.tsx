import React from "react";
import { ReportDataProps } from "./types";
import { findKpi, formatCurrency } from "./utils";
import { PieChart, Pie, Cell, Legend } from "recharts";

export const ReportPortfolioQuality: React.FC<ReportDataProps> = ({
  portfolioData,
  kpiMap,
  submission,
  submissionId,
}) => {
  const COLORS = ["#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981"];

  return (
    <div className="w-[210mm] h-[296mm] p-16 flex flex-col page-break-after bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        Sheet 3: "Portfolio Quality"
      </h2>

      <div className="flex justify-center mb-10 h-[250px] relative mt-4">
        <PieChart width={400} height={250}>
          <Pie
            isAnimationActive={false}
            data={portfolioData.categories}
            dataKey="balance"
            nameKey="category"
            cx="50%"
            cy="45%"
            outerRadius={80}
            label={({ category, percent }) => `${category} ${(percent * 100).toFixed(1)}%`}
          >
            {portfolioData.categories.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
        </PieChart>
        <div className="absolute top-0 left-0 w-full text-center">
          <h3 className="text-sm font-bold text-slate-800">Portfolio Distribution</h3>
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-800 mb-2">Portfolio Classification</h3>
      <table className="w-full text-left text-[10px] border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">Category</th>
            <th className="px-2 py-1 font-semibold text-right">Amount (SZL)</th>
            <th className="px-2 py-1 font-semibold text-right">% of Portfolio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {portfolioData.categories.map(c => (
            <tr key={c.category}>
              <td className="px-2 py-1">{c.category}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(c.balance)}</td>
              <td className="px-2 py-1 text-right">{findKpi(kpiMap, "gross_loan_portfolio")?.value ? ((c.balance / findKpi(kpiMap, "gross_loan_portfolio")!.value) * 100).toFixed(2) + "%" : "—"}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1">Total</td>
            <td className="px-2 py-1 text-right">{formatCurrency(portfolioData.categories.reduce((acc, c) => acc + c.balance, 0))}</td>
            <td className="px-2 py-1 text-right">100.0%</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span>Page 5</span>
        <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
      </div>
    </div>
  );
};
