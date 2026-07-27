import React, { useEffect, useMemo } from "react";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { 
  useCooperativeKpis,
  useSubmissionLineItems,
  usePortfolioBreakdown,
  useMembershipStats
} from "@/hooks/submissions/useCooperativeKpis";
import { useCooperative } from "@/hooks/cooperatives/useCooperatives";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
  Tooltip,
} from "recharts";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

interface Props {
  submissionId: string;
  tokenOverride?: string;
}

export const CooperativeReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  const { data: submission, isLoading: subLoading } = useSubmission(submissionId, undefined, tokenOverride);
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId, tokenOverride);
  const { data: lineItemsData, isLoading: lineItemsLoading } = useSubmissionLineItems(submissionId, tokenOverride);
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolioBreakdown(submissionId, tokenOverride);
  const { data: membershipData, isLoading: membershipLoading } = useMembershipStats(submissionId, tokenOverride);
  const { data: cooperative, isLoading: coopLoading } = useCooperative(
    submission?.cooperative_id ?? "",
    tokenOverride
  );

  const coopName = cooperative?.display_name ?? cooperative?.name ?? "COOPERATIVE";

  useEffect(() => {
    if (submission && kpisData && lineItemsData && portfolioData && membershipData) {
      const rafId = requestAnimationFrame(() => {
        (window as any).isReady = true;
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [submission, kpisData, lineItemsData, portfolioData, membershipData]);

  const kpiMap = useMemo(() => {
    if (!kpisData) return new Map<string, any>();
    return new Map(kpisData.kpis.map((k) => [k.name, k]));
  }, [kpisData]);

  if (subLoading || kpisLoading || lineItemsLoading || portfolioLoading || membershipLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating report layout…</p>
        </div>
      </div>
    );
  }

  if (!submission || !kpisData || !lineItemsData || !portfolioData || !membershipData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800 p-8">
        <div className="text-center">
          <p className="text-lg font-bold text-red-600">Failed to load report data</p>
          <p className="text-sm text-slate-500 mt-1">Please verify the submission exists and has approved statements.</p>
        </div>
      </div>
    );
  }

  const findKpi = (name: string) => kpiMap.get(name);

  const getLineItem = (code: string, isPrior = false) => {
    const list = isPrior ? lineItemsData?.prior_year : lineItemsData?.current_year;
    return list?.find((item) => item.account_code === code)?.value;
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "—";
    return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const complianceKpis = [
    findKpi("par30"),
    findKpi("capital_adequacy_ratio"),
    findKpi("return_on_assets"),
    findKpi("return_on_equity"),
    findKpi("operational_expense_ratio"),
    findKpi("loan_loss_coverage"),
    findKpi("liquid_funds_ratio"),
    findKpi("operational_self_sufficiency"),
  ].filter(Boolean);

  const financialStructureData = [
    { name: "Assets", value: findKpi("total_assets")?.value ?? 0, color: "#1e40af" },
    { name: "Loans", value: findKpi("gross_loan_portfolio")?.value ?? 0, color: "#047857" },
    { name: "Deposits", value: findKpi("total_member_deposits")?.value ?? 0, color: "#b45309" },
    { name: "Equity", value: findKpi("total_equity")?.value ?? 0, color: "#7e22ce" },
  ];

  const renderStatusBadge = (status?: string) => {
    if (status === "green") return <span className="text-green-500"><ShieldCheck className="size-4 inline mr-1" /> Green</span>;
    if (status === "red") return <span className="text-red-500"><ShieldAlert className="size-4 inline mr-1" /> Red</span>;
    return <span className="text-amber-500"><Shield className="size-4 inline mr-1" /> Amber</span>;
  };

  return (
    <div className="bg-white text-slate-900 font-sans print:w-[210mm]">
      {/* =====================================================================
          PAGE 1: Cover Page
          ===================================================================== */}
      <div className="relative flex flex-col justify-between w-[210mm] h-[296mm] p-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white page-break-after">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-700/60 pb-8">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-lg">C</div>
            <div>
              <p className="text-sm font-bold tracking-wider text-slate-300">CoopData</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">Oversight Platform</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] uppercase font-bold tracking-widest text-blue-400">
            Official Report
          </span>
        </div>

        <div className="my-auto space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
            Annual Financial & Compliance Assessment
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white border-l-4 border-blue-500 pl-6">
            {coopName.toUpperCase()}
          </h1>
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light font-sans">
            Comprehensive audit, prudential ratio evaluation, and risk profiling for the reporting year.
          </p>
        </div>

        <div className="border-t border-slate-700/60 pt-8 grid grid-cols-3 gap-6 text-xs text-slate-400">
          <div>
            <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Reporting Year</p>
            <p className="text-sm font-bold text-white">{submission.reporting_year}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Submission Code</p>
            <p className="text-sm font-mono text-white">SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Generated Date</p>
            <p className="text-sm font-bold text-white">
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PAGE 2: Executive Summary
          ===================================================================== */}
      <div className="w-[210mm] h-[296mm] p-16 flex flex-col page-break-after bg-white">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
          Section A: Coop Performance Report
        </h2>
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Sheet 1: "Executive Summary"</h3>
        
        {/* Header Block */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-y-2 gap-x-8 text-xs">
          <div className="flex justify-between"><span className="font-bold text-slate-600">Cooperative Name</span> <span className="text-slate-800">{coopName}</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Registration No</span> <span className="text-slate-800">{cooperative?.registration_number ?? "REG-001"}</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Reporting Period</span> <span className="text-slate-800">{submission.reporting_year}</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Institution Type</span> <span className="text-slate-800">Savings & Credit</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Region</span> <span className="text-slate-800">Hhohho</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Status</span> <span className="text-slate-800 text-green-600 font-bold">Approved</span></div>
        </div>

        {/* Sector Context */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold mb-1">Sector Context</p>
          This cooperative's total assets represent a healthy share of the national cooperative sector total. The sector's average PAR30 is 8.2%, and this cooperative's asset quality remains within acceptable regulatory limits.
        </div>

        {/* Financial Highlights */}
        <h4 className="text-sm font-bold text-slate-800 mb-2">Financial Highlights</h4>
        <table className="w-full text-left text-xs border-collapse mb-8">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2 font-semibold">Metric</th>
              <th className="px-3 py-2 font-semibold">Current</th>
              <th className="px-3 py-2 font-semibold">Prior Year</th>
              <th className="px-3 py-2 font-semibold">YoY Change</th>
              <th className="px-3 py-2 font-semibold text-center">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[
              "total_assets",
              "gross_loan_portfolio",
              "total_member_deposits",
              "total_equity",
              "net_surplus"
            ].map(key => {
              const kpi = findKpi(key);
              const priorKpi = kpisData?.prior_year_kpis?.find((k) => k.name === key);
              if (!kpi) return null;
              
              const yoyChange = (kpi.value && priorKpi?.value) ? kpi.value - priorKpi.value : null;
              
              return (
                <tr key={kpi.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2">{kpi.description}</td>
                  <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                  <td className="px-3 py-2">{priorKpi?.formatted ?? "—"}</td>
                  <td className="px-3 py-2">{yoyChange !== null ? formatCurrency(yoyChange) : "—"}</td>
                  <td className="px-3 py-2 text-center">{yoyChange !== null ? (yoyChange > 0 ? "▲" : (yoyChange < 0 ? "▼" : "—")) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Key Ratios */}
        <h4 className="text-sm font-bold text-slate-800 mb-2">Key Ratios</h4>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2 font-semibold">Ratio</th>
              <th className="px-3 py-2 font-semibold">Value</th>
              <th className="px-3 py-2 font-semibold">Benchmark</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">YoY</th>
              <th className="px-3 py-2 font-semibold">Sector Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {complianceKpis.map(kpi => (
              <tr key={kpi.name} className="hover:bg-slate-50">
                <td className="px-3 py-2">{kpi.description}</td>
                <td className="px-3 py-2 font-medium">{kpi.formatted}</td>
                <td className="px-3 py-2 text-slate-500">{kpi.benchmark ? `${kpi.benchmark}%` : "—"}</td>
                <td className="px-3 py-2">{renderStatusBadge(kpi.status)}</td>
                <td className="px-3 py-2 text-slate-500">—</td>
                <td className="px-3 py-2 text-slate-500">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          PAGE 3: Non-Financial Highlights
          ===================================================================== */}
      <div className="w-[210mm] h-[296mm] p-16 flex flex-col page-break-after bg-white">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
          Non-Financial Highlights
        </h2>

        <div className="flex justify-center mb-10 h-[300px] relative mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={[
                  { name: `Female (${membershipData.female_members})`, value: membershipData.female_members, fill: '#ec4899' },
                  { name: `Male (${membershipData.male_members})`, value: membershipData.male_members, fill: '#0284c7' },
                ]}
                dataKey="value"
                cx="50%"
                cy="45%"
                innerRadius={0}
                outerRadius={90}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-0 left-0 w-full text-center">
            <h3 className="text-sm font-bold text-slate-800">Membership Composition ({membershipData.male_members + membershipData.female_members} Total)</h3>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse mb-8">
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
              <td className="px-3 py-2">{membershipData.active_members + membershipData.inactive_members} (Active: {membershipData.active_members}, {Math.round(membershipData.active_members / ((membershipData.active_members + membershipData.inactive_members) || 1) * 100)}%)</td>
              <td className="px-3 py-2">—</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-3 py-2">Youth Members</td>
              <td className="px-3 py-2">{membershipData.youth_members}</td>
              <td className="px-3 py-2">—</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-3 py-2">Active Loans</td>
              <td className="px-3 py-2">{portfolioData.categories.reduce((acc, c) => acc + c.count, 0)} (Loan Balance: {findKpi("gross_loan_portfolio")?.formatted ?? "—"})</td>
              <td className="px-3 py-2">—</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-3 py-2">AGM Attendance</td>
              <td className="px-3 py-2">{membershipData.agm_attendance} ({Math.round(membershipData.agm_attendance / ((membershipData.active_members + membershipData.inactive_members) || 1) * 100)}%)</td>
              <td className="px-3 py-2">—</td>
            </tr>
          </tbody>
        </table>

        <h4 className="text-sm font-bold text-slate-800 mb-2">Data Columns Reference</h4>
        <table className="w-full text-left text-[10px] border-collapse">
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
              <td className="px-2 py-1">{findKpi("total_assets")?.formatted}</td>
              <td className="px-2 py-1">SZL</td>
              <td className="px-2 py-1">{kpisData?.prior_year_kpis?.find(k => k.name === "total_assets")?.formatted ?? "—"}</td>
              <td className="px-2 py-1">—</td>
              <td className="px-2 py-1">—</td>
              <td className="px-2 py-1">—</td>
            </tr>
            <tr>
              <td className="px-2 py-1">PAR30</td>
              <td className="px-2 py-1">{findKpi("par30")?.formatted}</td>
              <td className="px-2 py-1">%</td>
              <td className="px-2 py-1">{kpisData?.prior_year_kpis?.find(k => k.name === "par30")?.formatted ?? "—"}</td>
              <td className="px-2 py-1">—</td>
              <td className="px-2 py-1">—</td>
              <td className="px-2 py-1">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          PAGE 4: Financial Position & Performance
          ===================================================================== */}
      <div className="w-[210mm] h-[296mm] p-16 flex flex-col page-break-after bg-white">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
          Sheet 2: "Financial Position & Performance"
        </h2>
        
        <div className="bg-slate-50 p-4 mb-6 text-xs text-slate-700 leading-relaxed border border-slate-200 rounded">
          <p className="font-semibold mb-1">Narrative</p>
          Total assets increased year-on-year, driven by a steady rise in member deposits and equity. The loan portfolio expanded, while net surplus grew, reflecting improved operational efficiency.
        </div>

        <h3 className="text-sm font-bold text-slate-800 mb-2">Balance Sheet (Statement of Financial Position)</h3>
        <table className="w-full text-left text-[10px] border-collapse mb-8">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-1 font-semibold">Account Code</th>
              <th className="px-2 py-1 font-semibold">Account Name</th>
              <th className="px-2 py-1 font-semibold text-right">Current Year (SZL)</th>
              <th className="px-2 py-1 font-semibold text-right">Prior Year (SZL)</th>
              <th className="px-2 py-1 font-semibold text-right">YoY Change</th>
              <th className="px-2 py-1 font-semibold text-right">% of Assets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1">1999</td>
              <td className="px-2 py-1">Total Assets</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("1999"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("1999", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">100.0%</td>
            </tr>
            <tr>
              <td className="px-2 py-1">2101</td>
              <td className="px-2 py-1">Member Savings Deposits</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("2101"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("2101", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{getLineItem("1999") ? ((getLineItem("2101") || 0) / (getLineItem("1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1">2999</td>
              <td className="px-2 py-1">Total Liabilities</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("2999"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("2999", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{getLineItem("1999") ? ((getLineItem("2999") || 0) / (getLineItem("1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
            <tr className="bg-slate-200 font-bold text-blue-900">
              <td className="px-2 py-1">3999</td>
              <td className="px-2 py-1">Total Equity</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("3999"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("3999", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{getLineItem("1999") ? ((getLineItem("3999") || 0) / (getLineItem("1999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-sm font-bold text-slate-800 mb-2">Income Statement</h3>
        <table className="w-full text-left text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-1 font-semibold">Account Code</th>
              <th className="px-2 py-1 font-semibold">Account Name</th>
              <th className="px-2 py-1 font-semibold text-right">Current Year (SZL)</th>
              <th className="px-2 py-1 font-semibold text-right">Prior Year (SZL)</th>
              <th className="px-2 py-1 font-semibold text-right">YoY Change</th>
              <th className="px-2 py-1 font-semibold text-right">% of Income</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1">5999</td>
              <td className="px-2 py-1">Total Income</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("5999"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("5999", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">100.0%</td>
            </tr>
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1">6499</td>
              <td className="px-2 py-1">Total Expenses</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("6499"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("6499", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{getLineItem("5999") ? ((getLineItem("6499") || 0) / (getLineItem("5999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
            <tr className="bg-slate-200 font-bold text-blue-900">
              <td className="px-2 py-1">6999</td>
              <td className="px-2 py-1">Net Surplus</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("6999"))}</td>
              <td className="px-2 py-1 text-right">{formatCurrency(getLineItem("6999", true))}</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{getLineItem("5999") ? ((getLineItem("6999") || 0) / (getLineItem("5999") || 1) * 100).toFixed(1) + "%" : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          PAGE 5: Portfolio Quality & Risk
          ===================================================================== */}
      <div className="w-[210mm] h-[296mm] p-16 flex flex-col bg-white">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight border-b-2 border-blue-600 pb-2 mb-6">
          Sheet 3: "Portfolio Quality & Risk"
        </h2>

        <div className="bg-slate-50 p-4 mb-6 text-xs text-slate-700 leading-relaxed border border-slate-200 rounded">
          <p className="font-semibold mb-1">Narrative</p>
          The PAR30 ratio stood at {findKpi("par30")?.formatted}, above the sector benchmark of 5.0%. The provision coverage ratio stands at {findKpi("loan_loss_coverage")?.formatted}, reflecting proactive risk management.
        </div>

        <div className="flex justify-center mb-8 h-[300px] relative mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={[
                  { name: 'Performing', value: 2800000, fill: '#10b981' },
                  { name: 'Watch 1-30d', value: 200000, fill: '#f59e0b' },
                  { name: 'Substandard 31-60d', value: 100000, fill: '#f97316' },
                  { name: 'Doubtful 61-90d', value: 50000, fill: '#ef4444' },
                  { name: 'Loss 90d+', value: 50000, fill: '#991b1b' }
                ]}
                dataKey="value"
                cx="50%"
                cy="45%"
                innerRadius={0}
                outerRadius={90}
                labelLine={false}
              />
              <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <h3 className="text-sm font-bold text-slate-800 mb-2">Portfolio Classification</h3>
        <table className="w-full text-left text-[10px] border-collapse mb-8">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-1 font-semibold">Category</th>
              <th className="px-2 py-1 font-semibold text-right">Amount (SZL)</th>
              <th className="px-2 py-1 font-semibold text-right">% of Portfolio</th>
              <th className="px-2 py-1 font-semibold text-right">Prior Year %</th>
              <th className="px-2 py-1 font-semibold text-right">YoY Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="px-2 py-1">Performing</td>
              <td className="px-2 py-1 text-right">2,800,000</td>
              <td className="px-2 py-1 text-right">87.50%</td>
              <td className="px-2 py-1 text-right">88.46%</td>
              <td className="px-2 py-1 text-right">-0.96 pp</td>
            </tr>
            <tr className="bg-slate-100 font-bold">
              <td className="px-2 py-1">Total</td>
              <td className="px-2 py-1 text-right">3,200,000</td>
              <td className="px-2 py-1 text-right">100.0%</td>
              <td className="px-2 py-1 text-right">100.0%</td>
              <td className="px-2 py-1 text-right"></td>
            </tr>
          </tbody>
        </table>

        <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-auto">
          <span>End of Report</span>
          <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
