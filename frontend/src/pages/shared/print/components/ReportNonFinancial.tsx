import React from "react";
import { ReportDataProps } from "./types";
import { findKpi } from "./utils";
import { PieChart, Pie, Legend } from "recharts";

export const ReportNonFinancial: React.FC<ReportDataProps> = ({
  portfolioData,
  membershipData,
  kpiMap,
  kpisData,
  submission,
  submissionId,
}) => {
  const totalMembers = (membershipData.active_members || 0) + (membershipData.inactive_members || 0);

  return (
    <div className="w-[210mm] min-h-[296mm] p-16 block break-after-page bg-white">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
        Non-Financial Highlights
      </h2>

      <div className="flex flex-col items-center justify-center mb-10 mt-4">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Membership Composition ({totalMembers} Total)</h3>
        <PieChart width={400} height={300}>
          <Pie
            isAnimationActive={false}
            data={[
              { name: `Female (${membershipData.female_members})`, value: membershipData.female_members, fill: '#ec4899' },
              { name: `Male (${membershipData.male_members})`, value: membershipData.male_members, fill: '#0284c7' },
            ]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={100}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
        </PieChart>
      </div>

      <table className="w-full text-left text-xs border-collapse mb-8 page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 font-semibold">Metric</th>
            <th className="px-3 py-2 font-semibold">Value</th>
            <th className="px-3 py-2 font-semibold">YoY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <tr className="hover:bg-slate-50">
            <td className="px-3 py-2">Total Members</td>
            <td className="px-3 py-2">{totalMembers} (Active: {membershipData.active_members}, {totalMembers > 0 ? Math.round(membershipData.active_members / totalMembers * 100) : 0}%)</td>
            <td className="px-3 py-2">—</td>
          </tr>
          <tr className="hover:bg-slate-50">
            <td className="px-3 py-2">Youth Members</td>
            <td className="px-3 py-2">{membershipData.youth_members}</td>
            <td className="px-3 py-2">—</td>
          </tr>
          <tr className="hover:bg-slate-50">
            <td className="px-3 py-2">Active Loans</td>
            <td className="px-3 py-2">{portfolioData.categories.reduce((acc, c) => acc + c.count, 0)} (Loan Balance: {findKpi(kpiMap, "gross_loan_portfolio")?.formatted ?? "—"})</td>
            <td className="px-3 py-2">—</td>
          </tr>
          <tr className="hover:bg-slate-50">
            <td className="px-3 py-2">AGM Attendance</td>
            <td className="px-3 py-2">{membershipData.agm_attendance} ({totalMembers > 0 ? Math.round(membershipData.agm_attendance / totalMembers * 100) : 0}%)</td>
            <td className="px-3 py-2">—</td>
          </tr>
        </tbody>
      </table>

      <h4 className="text-sm font-bold text-slate-800 mb-2">Data Columns Reference</h4>
      <table className="w-full text-left text-[10px] border-collapse page-break-inside-avoid">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-1 font-semibold">Metric</th>
            <th className="px-2 py-1 font-semibold">Current Value</th>
            <th className="px-2 py-1 font-semibold">Unit</th>
            <th className="px-2 py-1 font-semibold">Prior Year</th>
            <th className="px-2 py-1 font-semibold">YoY Change</th>
            <th className="px-2 py-1 font-semibold">YoY %</th>
            <th className="px-2 py-1 font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <tr>
            <td className="px-2 py-1">Total Assets</td>
            <td className="px-2 py-1">{findKpi(kpiMap, "total_assets")?.formatted}</td>
            <td className="px-2 py-1">SZL</td>
            <td className="px-2 py-1">{kpisData?.prior_year_kpis?.find(k => k.name === "total_assets")?.formatted ?? "—"}</td>
            <td className="px-2 py-1">—</td>
            <td className="px-2 py-1">—</td>
            <td className="px-2 py-1">—</td>
          </tr>
          <tr>
            <td className="px-2 py-1">PAR30</td>
            <td className="px-2 py-1">{findKpi(kpiMap, "par30")?.formatted}</td>
            <td className="px-2 py-1">%</td>
            <td className="px-2 py-1">{kpisData?.prior_year_kpis?.find(k => k.name === "par30")?.formatted ?? "—"}</td>
            <td className="px-2 py-1">—</td>
            <td className="px-2 py-1">—</td>
            <td className="px-2 py-1">—</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto pb-4">
        <span>Page 3</span>
        <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
      </div>
    </div>
  );
};
