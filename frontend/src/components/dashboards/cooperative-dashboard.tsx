import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  ShieldCheck,
  Users,
  Wallet,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Database,
  BarChart3,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCooperativeStats, useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import { useLatestSubmission } from "@/hooks/submissions/useLatestSubmission";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops } from "@/hooks/non-financial/useFarmCoop";

// ─────────────────────────────────────────────────────────────────────
// COOPERATIVE DASHBOARD — real data only
// ─────────────────────────────────────────────────────────────────────

const accentColor = "var(--accent)";
const accentOpacities = [1, 0.72, 0.48, 0.32, 0.18];

// Loan portfolio category labels mapped from KPI names
const LOAN_PORTFOLIO_LABELS = [
  { name: "Performing", kpiKey: null },
  { name: "Watch List", kpiKey: null },
  { name: "Substandard", kpiKey: null },
  { name: "Doubtful", kpiKey: null },
  { name: "Loss", kpiKey: null },
];

export function CooperativeDashboard() {
  const { data: stats, isLoading: statsLoading } = useCooperativeStats();
  const { data: realSubmissions = [], isLoading: subsLoading } = useCooperativeSubmissions();

  // Real KPI data from the latest submission
  const latestSubmission = useLatestSubmission();
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(latestSubmission?.id);

  // Real database record counts — page_size:1 to get just the total cheaply
  const { data: membersData } = useMembers({ page: 1, page_size: 1 });
  const { data: savingsData } = useSavings({ page: 1, page_size: 1 });
  const { data: loansData } = useLoans({ page: 1, page_size: 1 });
  const { data: fixedDepositsData } = useFixedDeposits({ page: 1, page_size: 1 });
  const { data: farmCoopData } = useFarmCoops({ page: 1, page_size: 1 });

  // Helper: find a KPI by name from the API response
  const getKpi = (name: string) => kpisData?.kpis.find((k) => k.name === name);

  // Database status from real counts
  const databaseStatus = [
    {
      name: "Membership",
      records: membersData?.total ?? 0,
      status: (membersData?.total ?? 0) > 0 ? "Current" : "Empty",
      icon: Users,
    },
    {
      name: "Savings",
      records: savingsData?.total ?? 0,
      status: (savingsData?.total ?? 0) > 0 ? "Current" : "Empty",
      icon: Wallet,
    },
    {
      name: "Fixed Deposits",
      records: fixedDepositsData?.total ?? 0,
      status: (fixedDepositsData?.total ?? 0) > 0 ? "Current" : "Empty",
      icon: TrendingUp,
    },
    {
      name: "Loans",
      records: loansData?.total ?? 0,
      status: (loansData?.total ?? 0) > 0 ? "Current" : "Empty",
      icon: BarChart3,
    },
    {
      name: "Multi-purpose",
      records: farmCoopData?.total ?? 0,
      status: (farmCoopData?.total ?? 0) > 0 ? "Current" : "Empty",
      icon: Database,
    },
  ];

  // Build loan portfolio donut from real KPI data
  const par30 = getKpi("par30")?.value ?? 0;
  const par90 = getKpi("par90")?.value ?? 0;
  const loanPortfolio = [
    { name: "Performing", value: Math.max(0, 100 - par30) },
    { name: "Watch List", value: Math.max(0, par30 - par90) },
    { name: "Non-Performing", value: par90 },
  ].filter((s) => s.value > 0);

  // Build compliance radial from OSS KPI
  const ossValue = getKpi("operational_self_sufficiency")?.value ?? 0;
  const complianceRadial = [
    { name: "Self-Sufficiency", value: Math.min(ossValue, 150), fill: accentColor },
  ];

  const profile = {
    name: "My Cooperative",
    regNo: "—",
    region: "—",
    sector: "—",
  };

  const totalSubs = stats?.total_submissions ?? 0;
  const pendingSubs = stats?.pending_submissions ?? 0;
  const approvedSubs = stats?.approved_submissions ?? 0;
  const rejectedSubs = stats?.rejected_submissions ?? 0;

  const statusTone = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
    if (status === "approved") return "success";
    if (["submitted", "in_review"].includes(status)) return "warning";
    if (["rejected", "returned"].includes(status)) return "danger";
    return "neutral";
  };

  const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: "Draft",
      submitted: "Submitted",
      in_review: "In Review",
      approved: "Approved",
      rejected: "Rejected",
      returned: "Returned",
    };
    return labels[status] ?? status;
  };

  return (
    <AppShell
      title="Cooperative Workspace"
      subtitle={`${profile.name} · Upload data, track submissions, view analytics`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/app/analytics"
            className="press-feedback hidden items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors sm:inline-flex"
          >
            <BarChart3 className="size-4 text-accent" />
            View all statistics
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <div className="col-span-2 lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-2 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <StatCard
                label="Total Submissions"
                value={totalSubs.toString()}
                subtitle="All data returns"
                icon={Database}
                tone="primary"
              />
              <StatCard
                label="Pending"
                value={pendingSubs.toString()}
                subtitle="Awaiting review"
                icon={ShieldCheck}
                tone="warning"
              />
              <StatCard
                label="Approved"
                value={approvedSubs.toString()}
                subtitle="Finalized declarations"
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Rejected"
                value={rejectedSubs.toString()}
                subtitle="Requires correction"
                icon={TrendingDown}
                tone="danger"
              />
            </>
          )}
        </div>

        {/* ── Database Status Grid ── */}
        <Card title="Database Status" subtitle="Current state of your 5 cooperative databases">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {databaseStatus.map((db) => (
              <div
                key={db.name}
                className="rounded-xl border border-border bg-surface p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <db.icon className="size-4 text-foreground" />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      db.status === "Current"
                        ? "bg-success/10 text-success"
                        : db.status === "Empty"
                          ? "bg-muted text-muted-foreground"
                          : "bg-warning/10 text-warning-foreground"
                    }`}
                  >
                    {db.status}
                  </span>
                </div>
                <p className="font-heading text-lg font-bold text-foreground num">
                  {db.records.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{db.name} records</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Charts Row 1: Loan Portfolio Quality (from KPIs) ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Financial Statement Summary"
            subtitle="Key balances from your latest submission"
          >
            {kpisLoading ? (
              <div className="h-72 grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-2">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-2 w-10" />
                  </div>
                ))}
              </div>
            ) : kpisData ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {[
                  { label: "Total Assets", name: "total_assets" },
                  { label: "Gross Loan Portfolio", name: "gross_loan_portfolio" },
                  { label: "Member Deposits", name: "total_member_deposits" },
                  { label: "Total Equity", name: "total_equity" },
                  { label: "Net Surplus", name: "net_surplus" },
                  { label: "Liquid Funds Ratio", name: "liquid_funds_ratio" },
                ].map(({ label, name }) => {
                  const kpi = kpisData.kpis.find((k) => k.name === name);
                  return (
                    <div key={name} className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        {label}
                      </p>
                      <p
                        className={`font-heading text-xl font-bold num ${
                          kpi?.status === "green"
                            ? "text-success"
                            : kpi?.status === "red"
                              ? "text-destructive"
                              : kpi?.status === "amber"
                                ? "text-warning-foreground"
                                : "text-foreground"
                        }`}
                      >
                        {kpi?.formatted ?? "—"}
                      </p>
                      {kpi?.benchmark !== undefined && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Benchmark:{" "}
                          {kpi.unit === "percent" ? `${kpi.benchmark}%` : String(kpi.benchmark)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                <BarChart3 className="size-10 opacity-30" />
                <div>
                  <p className="text-sm font-semibold">No financial data yet</p>
                  <p className="text-xs mt-1">
                    Upload a financial statement to see your data here.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Loan Portfolio Quality"
            subtitle={kpisData ? "Derived from PAR ratios" : "No data yet"}
          >
            {kpisLoading ? (
              <div className="h-52 flex flex-col gap-3 pt-2">
                <Skeleton className="h-36 w-36 rounded-full mx-auto" />
                <div className="space-y-2 border-t border-border pt-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ) : loanPortfolio.length > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={loanPortfolio}
                        dataKey="value"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {loanPortfolio.map((_, i) => (
                          <Cell
                            key={i}
                            fill={accentColor}
                            fillOpacity={accentOpacities[i] ?? 0.2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 border-t border-border pt-3 mt-1">
                  {loanPortfolio.map((item, i) => (
                    <li key={item.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="size-2.5 rounded-sm shrink-0"
                          style={{ background: accentColor, opacity: accentOpacities[i] ?? 0.2 }}
                        />
                        {item.name}
                      </span>
                      <span className="font-bold num text-foreground">
                        {item.value.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                <BarChart3 className="size-8 opacity-30" />
                <p className="text-xs">Submit a financial statement to see loan quality data.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Charts Row 2: OSS + Membership counts from real data ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card title="Membership Summary" subtitle="Total members in your cooperative database">
            <div className="flex flex-col gap-4 pt-2">
              {(membersData?.total ?? 0) > 0 ? (
                <>
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total Members
                    </p>
                    <p className="font-heading text-3xl font-bold text-foreground num mt-1">
                      {(membersData?.total ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Demographic breakdown available in Data Collection.
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                  <Users className="size-8 opacity-30" />
                  <p className="text-xs">No membership records uploaded yet.</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Database Coverage" subtitle="Records across all 5 databases">
            <div className="flex flex-col gap-2 pt-2">
              {databaseStatus.map((db) => {
                const hasData = db.records > 0;
                return (
                  <div key={db.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <db.icon className="size-3.5 shrink-0" />
                      {db.name}
                    </span>
                    <span
                      className={`font-bold num ${hasData ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {hasData ? db.records.toLocaleString() : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            title="Operational Self-Sufficiency"
            subtitle={kpisData ? "Income vs operating expenses" : "No data yet"}
          >
            {kpisLoading ? (
              <div className="h-52 flex flex-col items-center gap-3 pt-4">
                <Skeleton className="h-36 w-36 rounded-full" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-2 w-24" />
              </div>
            ) : ossValue > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      data={complianceRadial}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={10}
                        fill={
                          ossValue >= 110
                            ? "var(--success)"
                            : ossValue >= 100
                              ? "var(--warning)"
                              : "var(--destructive)"
                        }
                        background={{ fill: "var(--muted)" }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center -mt-4">
                  <p
                    className={`font-heading text-4xl font-bold num ${
                      ossValue >= 110
                        ? "text-success"
                        : ossValue >= 100
                          ? "text-warning-foreground"
                          : "text-destructive"
                    }`}
                  >
                    {ossValue.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ossValue >= 110
                      ? "Fully self-sufficient"
                      : ossValue >= 100
                        ? "Breaking even"
                        : "Below self-sufficiency"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Benchmark: 110%</p>
                </div>
              </>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                <ShieldCheck className="size-8 opacity-30" />
                <p className="text-xs">Submit a financial statement to see OSS data.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Key Financial Metrics (real KPI data) ── */}
        <Card
          title="Key Financial Metrics"
          subtitle={
            latestSubmission
              ? `From your ${latestSubmission.reporting_year} submission · ${latestSubmission.status}`
              : "Extracted from your latest financial statement"
          }
        >
          {kpisLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface p-4 animate-pulse space-y-2"
                >
                  <div className="h-2.5 w-16 rounded bg-muted" />
                  <div className="h-6 w-14 rounded bg-muted" />
                  <div className="h-2 w-10 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(
                [
                  { label: "Total Assets", kpiName: "total_assets" },
                  { label: "Gross Loans", kpiName: "gross_loan_portfolio" },
                  { label: "Member Deposits", kpiName: "total_member_deposits" },
                  { label: "Net Surplus", kpiName: "net_surplus" },
                  { label: "NPL Ratio", kpiName: "npl_ratio" },
                  {
                    label: "Capital Adequacy",
                    kpiName: "capital_adequacy_ratio",
                  },
                ] as const
              ).map((metric) => {
                const kpi = getKpi(metric.kpiName);
                const statusColor =
                  kpi?.status === "green"
                    ? "text-success"
                    : kpi?.status === "red"
                      ? "text-destructive"
                      : kpi?.status === "amber"
                        ? "text-warning-foreground"
                        : "text-foreground";

                return (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-border bg-surface p-4 hover:shadow-sm transition-shadow"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {metric.label}
                    </p>
                    {kpi ? (
                      <>
                        <p className={`font-heading text-xl font-bold num ${statusColor}`}>
                          {kpi.formatted}
                        </p>
                        {kpi.benchmark !== undefined && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Benchmark:{" "}
                            {kpi.unit === "percent" ? `${kpi.benchmark}%` : String(kpi.benchmark)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="font-heading text-xl font-bold text-muted-foreground num">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Submission History ── */}
        <Card title="Submission History" subtitle="Track review cycle statuses on your filings">
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Year</th>
                  <th className="px-5 py-3">Filed On</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-3 w-10" />
                      </td>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-3 w-24" />
                      </td>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </td>
                    </tr>
                  ))
                ) : realSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      <p className="text-sm font-semibold">No submissions yet</p>
                      <p className="text-xs mt-1">Create a new submission to get started.</p>
                    </td>
                  </tr>
                ) : (
                  realSubmissions.slice(0, 5).map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-muted/25 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {sub.reference ?? sub.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        {sub.reporting_year}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            statusTone(sub.status) === "success"
                              ? "bg-success/10 text-success"
                              : statusTone(sub.status) === "warning"
                                ? "bg-warning/10 text-warning-foreground"
                                : statusTone(sub.status) === "danger"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
