import React, { useEffect, useMemo } from "react";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useCooperative } from "@/hooks/cooperatives/useCooperatives";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { ShieldAlert, ShieldCheck } from "lucide-react";

interface Props {
  submissionId: string;
  tokenOverride?: string;
}

export const CooperativeReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  const { data: submission, isLoading: subLoading } = useSubmission(submissionId, undefined, tokenOverride);
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId, tokenOverride);

  // Fetch only the single cooperative profile to prevent over-fetching (P2)
  const { data: cooperative, isLoading: coopLoading } = useCooperative(
    submission?.cooperative_id ?? "",
    tokenOverride
  );

  // Signal Gotenberg when loading is done and layout has rendered (P3)
  useEffect(() => {
    if (submission && kpisData && cooperative) {
      // Use requestAnimationFrame to ensure the browser has finished painting Recharts before Gotenberg grabs it
      const rafId = requestAnimationFrame(() => {
        (window as any).status = "ready";
        console.log("Gotenberg signal: ready");
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [submission, kpisData, cooperative]);

  const kpiMap = useMemo(() => {
    if (!kpisData) return new Map<string, any>();
    return new Map(kpisData.kpis.map((k) => [k.name, k]));
  }, [kpisData]);

  if (subLoading || kpisLoading || coopLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating report layout…</p>
        </div>
      </div>
    );
  }

  if (!submission || !kpisData || !cooperative) {
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

  // KPIs for Page 2 Prudential Standards Table
  const complianceKpis = [
    findKpi("capital_adequacy_ratio"),
    findKpi("npl_ratio"),
    findKpi("par30"),
    findKpi("liquid_funds_ratio"),
    findKpi("operational_self_sufficiency"),
  ].filter(Boolean);

  // Financial structure data for the Recharts Bar Chart (P3)
  const financialStructureData = [
    {
      name: "Assets",
      value: findKpi("total_assets")?.value ?? 0,
      formatted: findKpi("total_assets")?.formatted ?? "—",
      color: "var(--chart-1, #1e40af)",
    },
    {
      name: "Loans",
      value: findKpi("gross_loan_portfolio")?.value ?? 0,
      formatted: findKpi("gross_loan_portfolio")?.formatted ?? "—",
      color: "var(--chart-2, #047857)",
    },
    {
      name: "Deposits",
      value: findKpi("total_member_deposits")?.value ?? 0,
      formatted: findKpi("total_member_deposits")?.formatted ?? "—",
      color: "var(--chart-3, #b45309)",
    },
    {
      name: "Equity",
      value: findKpi("total_equity")?.value ?? 0,
      formatted: findKpi("total_equity")?.formatted ?? "—",
      color: "var(--chart-4, #7e22ce)",
    },
  ];

  // Capital Buffers for Recharts Gauge (P3)
  const capitalAdequacy = findKpi("capital_adequacy_ratio")?.value ?? 0;
  const capitalAdequacyData = [
    { name: "Capital Adequacy", value: capitalAdequacy, fill: "var(--chart-1, #1e40af)" },
    { name: "Required Buffer", value: Math.max(10 - capitalAdequacy, 0), fill: "#e2e8f0" },
  ];

  return (
    <div className="bg-white text-slate-900 font-sans print:w-[210mm] print:h-[297mm]">
      {/* ─────────────────────────────────────────────────────────────────
          PAGE 1: Cover Page
          ───────────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col justify-between w-[210mm] h-[297mm] p-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white page-break-after">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-700/60 pb-8">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-lg">
              C
            </div>
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
            {cooperative.display_name ?? cooperative.name.toUpperCase()}
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

      {/* ─────────────────────────────────────────────────────────────────
          PAGE 2: Key Metrics & Compliance Grid
          ───────────────────────────────────────────────────────────────── */}
      <div className="w-[210mm] h-[297mm] p-16 flex flex-col justify-between page-break-after bg-slate-50">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Executive Performance & Compliance Grid</h2>
            <p className="text-xs text-slate-500">Page 2 of 3</p>
          </div>

          {/* Key Financial Totals Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              findKpi("total_assets"),
              findKpi("gross_loan_portfolio"),
              findKpi("total_member_deposits"),
              findKpi("net_surplus"),
            ].filter(Boolean).map((kpi) => (
              <div key={kpi.name} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {kpi.description}
                </p>
                <p className="text-2xl font-bold text-slate-800 tracking-tight">
                  {kpi.formatted}
                </p>
              </div>
            ))}
          </div>

          {/* Detailed Compliance Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 text-sm">Prudential Standards Compliance</h3>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Regulatory Indicator</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-right">Benchmark Target</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {complianceKpis.map((kpi) => {
                  const statusBg =
                    kpi.status === "green"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : kpi.status === "red"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-amber-100 text-amber-800 border-amber-200";

                  return (
                    <tr key={kpi.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-800">{kpi.description}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">{kpi.formatted}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500">
                        {kpi.benchmark ? `${kpi.benchmark}%` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBg}`}>
                          {kpi.status === "green" ? (
                            <ShieldCheck className="size-3" />
                          ) : (
                            <ShieldAlert className="size-3" />
                          )}
                          {kpi.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          <span>CoopData Official Print Output</span>
          <span>{cooperative.display_name ?? cooperative.name}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          PAGE 3: Visual Analytics
          ───────────────────────────────────────────────────────────────── */}
      <div className="w-[210mm] h-[297mm] p-16 flex flex-col justify-between bg-white">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Key Portfolio Analytics</h2>
            <p className="text-xs text-slate-500">Page 3 of 3</p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Visual KPI representation 1: Bar Chart of Financial Balances (P3) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col h-80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Financial Structure</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialStructureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Bar dataKey="value" fill="#1e40af">
                      {financialStructureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual KPI representation 2: Pie Chart of Capital adequacy (P3) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col h-80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Capital Buffer Ratio</h3>
              <div className="flex-1 min-h-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={capitalAdequacyData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="var(--chart-1, #1e40af)" />
                      <Cell fill="#e2e8f0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-slate-800">{capitalAdequacy.toFixed(1)}%</span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">CAR</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-2 leading-relaxed">
                Prudential minimum requirement: <span className="font-bold">10.0%</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Portfolio Assessment Summary</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This printable performance profile has been compiled from authorized financial statements and parsed ledgers. All indicators have been automatically validated against national oversight rules and are archived as official oversight documents.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          <span>End of Report</span>
          <span>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
