import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = ["#0ea5e9", "#f59e0b", "#ef4444", "#94a3b8"];

interface ConsolidatedReportPrintProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  data: any; // NationalOverviewResponse
}

export const ConsolidatedReportPrint: React.FC<ConsolidatedReportPrintProps> = ({ tier, entityName, year, data }) => {
  const { total_cooperatives, cooperatives_with_data, distributions, non_financial_summary, cooperatives } = data;

  const getDist = (kpi: string) => distributions[kpi] || { green_pct: 0, amber_pct: 0, red_pct: 0, no_data_pct: 100, green_count: 0, amber_count: 0, red_count: 0, no_data_count: 0 };

  const chartData = [
    { name: "PAR 30", ...getDist("par30") },
    { name: "ROA", ...getDist("roa") },
    { name: "Capital Adequacy", ...getDist("capital_adequacy_ratio") },
    { name: "Liquidity", ...getDist("liquid_funds_ratio") },
  ];

  const CustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === 0) return null;
    return (
      <text x={x + width / 2} y={y + 15} fill="#fff" textAnchor="middle" fontSize="10">
        {value}
      </text>
    );
  };

  const totalAssets = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.kpis?.total_assets?.value || 0), 0) || 0;
  const totalDeposits = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.kpis?.total_member_deposits?.value || 0), 0) || 0;
  const totalMembers = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.non_financial?.total_members || 0), 0) || 0;

  const avgPar30 = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.kpis?.par30?.value || 0), 0) / (cooperatives_with_data || 1);
  const avgCar = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.kpis?.capital_adequacy_ratio?.value || 0), 0) / (cooperatives_with_data || 1);
  const avgRoa = cooperatives?.reduce((sum: number, coop: any) => sum + (coop.kpis?.roa?.value || 0), 0) / (cooperatives_with_data || 1);

  return (
    <div className="bg-white text-slate-900 font-sans print:w-[210mm]">
      {/* Cover Page */}
      <div className="relative flex flex-col justify-between w-[210mm] h-[296mm] p-12 bg-white break-after-page">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-slate-900 border-b-2 border-slate-900 pb-2">
            Section {tier === 'Apex' ? 'B' : tier === 'Federation' ? 'C' : 'D'}: {tier} Consolidated Report
          </h1>
          <p className="text-sm text-slate-600 mb-8 italic">
            Purpose: Show {tier.toLowerCase()} leadership which cooperatives are healthy, which need attention, and overall health.
          </p>

          <h2 className="text-xl font-bold text-blue-800 mb-4">Sheet 1: "Executive Dashboard"</h2>
          
          <h3 className="text-sm font-bold text-slate-800 mb-2">Header</h3>
          <table className="w-full text-left text-xs mb-8 border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 border border-slate-700 w-1/4">Field</th>
                <th className="p-2 border border-slate-700 w-1/4">Value</th>
                <th className="p-2 border border-slate-700 w-1/4">Field</th>
                <th className="p-2 border border-slate-700 w-1/4">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">{tier}</td>
                <td className="p-2 border border-slate-300">{entityName}</td>
                <td className="p-2 border border-slate-300 bg-slate-50">Period</td>
                <td className="p-2 border border-slate-300">{year}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Cooperatives</td>
                <td className="p-2 border border-slate-300">{total_cooperatives}</td>
                <td className="p-2 border border-slate-300 bg-slate-50">Submitted</td>
                <td className="p-2 border border-slate-300">{cooperatives_with_data} ({((cooperatives_with_data/total_cooperatives)*100).toFixed(1)}%)</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-sm font-bold text-slate-800 mb-2">Consolidated Financial Position</h3>
          <table className="w-full text-left text-xs mb-8 border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 border border-slate-700">Metric</th>
                <th className="p-2 border border-slate-700 text-right">Current</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Total Assets</td>
                <td className="p-2 border border-slate-300 text-right">E {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Total Deposits</td>
                <td className="p-2 border border-slate-300 text-right">E {totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Total Members</td>
                <td className="p-2 border border-slate-300 text-right">{totalMembers.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-sm font-bold text-slate-800 mb-2">Consolidated KPIs</h3>
          <table className="w-full text-left text-xs mb-8 border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 border border-slate-700">KPI</th>
                <th className="p-2 border border-slate-700 text-right">Current Avg</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Average PAR30</td>
                <td className="p-2 border border-slate-300 text-right">{avgPar30.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Average CAR</td>
                <td className="p-2 border border-slate-300 text-right">{avgCar.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 bg-slate-50">Average ROA</td>
                <td className="p-2 border border-slate-300 text-right">{avgRoa.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sheet 2: Cooperative Detail */}
      <div className="w-[210mm] min-h-[296mm] p-12 block break-after-page bg-white">
        <h2 className="text-xl font-bold text-blue-800 mb-4">Sheet 2: "Cooperative Detail"</h2>
        <table className="w-full text-left text-[9px] border-collapse page-break-inside-avoid">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700">Coop</th>
              <th className="p-2 border border-slate-700 text-center">Status</th>
              <th className="p-2 border border-slate-700 text-right">Assets</th>
              <th className="p-2 border border-slate-700 text-right">PAR30</th>
              <th className="p-2 border border-slate-700 text-right">CAR</th>
              <th className="p-2 border border-slate-700 text-right">ROA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cooperatives?.map((coop: any) => {
              const assets = coop.kpis?.total_assets?.value || 0;
              const par30 = coop.kpis?.par30?.value;
              const car = coop.kpis?.capital_adequacy_ratio?.value;
              const roa = coop.kpis?.roa?.value;
              return (
                <tr key={coop.cooperative_id} className="hover:bg-slate-50">
                  <td className="p-2 border border-slate-200 font-bold">{coop.name}</td>
                  <td className="p-2 text-center border border-slate-200">
                    {coop.has_data ? <span className="text-green-600">✓</span> : <span className="text-slate-400">Overdue</span>}
                  </td>
                  <td className="p-2 text-right border border-slate-200">{assets > 0 ? (assets / 1000000).toFixed(1) + 'M' : "—"}</td>
                  <td className={`p-2 text-right border border-slate-200 ${coop.kpis?.par30?.status === 'red' ? 'text-red-600 font-bold' : ''}`}>
                    {par30 !== undefined ? par30.toFixed(1) + "%" : "—"}
                  </td>
                  <td className={`p-2 text-right border border-slate-200 ${coop.kpis?.capital_adequacy_ratio?.status === 'red' ? 'text-red-600 font-bold' : ''}`}>
                    {car !== undefined ? car.toFixed(1) + "%" : "—"}
                  </td>
                  <td className={`p-2 text-right border border-slate-200 ${coop.kpis?.roa?.status === 'red' ? 'text-red-600 font-bold' : ''}`}>
                    {roa !== undefined ? roa.toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <h2 className="text-xl font-bold text-blue-800 mb-4 mt-12">Risk Distribution (Number of Coops)</h2>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="green_count" name="Green (Healthy)" fill="#10b981" isAnimationActive={false} label={<CustomBarLabel />} />
              <Bar dataKey="amber_count" name="Amber (Watch)" fill="#f59e0b" isAnimationActive={false} label={<CustomBarLabel />} />
              <Bar dataKey="red_count" name="Red (Risk)" fill="#ef4444" isAnimationActive={false} label={<CustomBarLabel />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
