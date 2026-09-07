import { AppShell, Card, StatCard } from "@/components/app-shell";
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
} from "recharts";
import {
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  Database,
  BarChart3,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCooperativeStats, useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import { useLatestSubmission } from "@/hooks/submissions/useLatestSubmission";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useMyCooperativeProfile } from "@/hooks/cooperatives/useCooperatives";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

// ─────────────────────────────────────────────────────────────────────
// COOPERATIVE DASHBOARD — essential statistics and profile only
// ─────────────────────────────────────────────────────────────────────

const accentColor = "var(--accent)";
const accentOpacities = [1, 0.72, 0.48, 0.32, 0.18];

export function CooperativeDashboard() {
  const { t } = useOrganizationLabelsContext();
  const { data: stats, isLoading: statsLoading } = useCooperativeStats();
  const { data: realSubmissions = [], isLoading: subsLoading } = useCooperativeSubmissions();
  const { data: profile, isLoading: profileLoading } = useMyCooperativeProfile();

  // Real KPI data from the latest submission
  const latestSubmission = useLatestSubmission();
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(latestSubmission?.id);

  // Helper: find a KPI by name from the API response
  const getKpi = (name: string) => kpisData?.kpis?.find((k) => k.name === name);

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
      draft: t("dashboard.status.draft"),
      submitted: t("dashboard.status.submitted"),
      in_review: t("dashboard.status.inReview"),
      approved: t("dashboard.status.approved"),
      rejected: t("dashboard.status.rejected"),
      returned: t("dashboard.status.changesRequested"),
    };
    return labels[status] ?? status;
  };

  // Build financial overview bar chart data
  const financialOverview = [
    { name: t("dashboard.coop.assets"), value: getKpi("total_assets")?.value ?? 0 },
    { name: t("dashboard.coop.loans"), value: getKpi("gross_loan_portfolio")?.value ?? 0 },
    { name: t("dashboard.coop.deposits"), value: getKpi("total_member_deposits")?.value ?? 0 },
  ];

  // Build loan portfolio quality pie chart data
  const par30 = getKpi("par30")?.value ?? 0;
  const par90 = getKpi("par90")?.value ?? 0;
  const loanPortfolio = [
    { name: t("dashboard.coop.performing"), value: Math.max(0, 100 - par30) },
    { name: t("dashboard.coop.watchList"), value: Math.max(0, par30 - par90) },
    { name: t("dashboard.coop.nonPerforming"), value: par90 },
  ].filter((s) => s.value > 0);

  const isLoading = statsLoading || subsLoading || profileLoading || kpisLoading;

  return (
    <AppShell
      title={profile?.name ?? t("dashboard.coop.title")}
      subtitle={`${profile?.name ?? t("dashboard.coop.title")} · ${t("dashboard.coop.subtitleSuffix")}`}
    >
      <div className="space-y-6">
        {/* ── KPI Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
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
                label={t("dashboard.coop.totalSubmissions")}
                value={totalSubs.toString()}
                subtitle={t("dashboard.coop.allDataReturns")}
                icon={Database}
                tone="primary"
                info={t("dashboard.coop.totalSubmissionsInfo")}
              />
              <StatCard
                label={t("dashboard.coop.pending")}
                value={pendingSubs.toString()}
                subtitle={t("dashboard.coop.awaitingReview")}
                icon={ShieldCheck}
                tone="warning"
                info={t("dashboard.coop.pendingInfo")}
              />
              <StatCard
                label={t("dashboard.coop.approved")}
                value={approvedSubs.toString()}
                subtitle={t("dashboard.coop.finalizedDeclarations")}
                icon={CheckCircle2}
                tone="success"
                info={t("dashboard.coop.approvedInfo")}
              />
              <StatCard
                label={t("dashboard.coop.rejected")}
                value={rejectedSubs.toString()}
                subtitle={t("dashboard.coop.requiresCorrection")}
                icon={TrendingDown}
                tone="danger"
                info={t("dashboard.coop.rejectedInfo")}
              />
            </>
          )}
        </div>

        {/* ── Profile & Core Financial Metrics Grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card
            title={profile?.name ?? "Profile"}
            subtitle="Cooperative identity and registry summary"
          >
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 mb-3 border-b border-border/50 pb-2">
                <Building2 className="size-4 text-accent" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Cooperative Details
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Region
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile?.region ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Institution Type
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile?.institution_type ?? "—"}
                </span>
              </div>
            </div>
          </Card>

          {/* Key Financial Metrics */}
          <div className="lg:col-span-2">
            <Card
              title={t("dashboard.coop.keyMetrics")}
              subtitle={
                latestSubmission
                  ? t("dashboard.coop.keyMetricsSub", {
                      year: latestSubmission.reporting_year,
                      status: statusLabel(latestSubmission.status),
                    })
                  : t("dashboard.coop.keyMetricsSubFallback")
              }
              info={t("dashboard.coop.keyMetricsInfo")}
            >
              {kpisLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(
                    [
                      { label: t("dashboard.coop.assets"), kpiName: "total_assets" },
                      { label: t("dashboard.coop.loans"), kpiName: "gross_loan_portfolio" },
                      { label: t("dashboard.coop.deposits"), kpiName: "total_member_deposits" },
                      { label: t("dashboard.coop.netSurplus"), kpiName: "net_surplus" },
                      { label: t("dashboard.coop.nplRatio"), kpiName: "npl_ratio" },
                      {
                        label: t("dashboard.coop.capitalAdequacy"),
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
                            <p className={`font-heading text-lg font-bold num ${statusColor}`}>
                              {kpi.formatted}
                            </p>
                            {kpi.benchmark !== undefined && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {t("common.benchmark")}:{" "}
                                {kpi.unit === "percent"
                                  ? `${kpi.benchmark}%`
                                  : String(kpi.benchmark)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-heading text-lg font-bold text-muted-foreground num">
                            —
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ── Charts Row: Balance Breakdown & Portfolio Quality ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title={t("dashboard.coop.portfolioBalance")}
            subtitle={t("dashboard.coop.portfolioBalanceSub")}
            info={t("dashboard.coop.portfolioBalanceInfo")}
          >
            {kpisLoading ? (
              <div className="h-72 flex items-center justify-center">
                <Skeleton className="h-48 w-full mx-6" />
              </div>
            ) : kpisData?.kpis && kpisData.kpis.length > 0 ? (
              <div className="h-72 pt-4 pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialOverview}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--foreground)",
                      }}
                      formatter={(val: number) => [`$${val.toLocaleString()}`, t("common.amount")]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {financialOverview.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            index === 0
                              ? "var(--primary)"
                              : index === 1
                                ? "var(--accent)"
                                : "var(--success)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                <BarChart3 className="size-10 opacity-30" />
                <div>
                  <p className="text-sm font-semibold">{t("dashboard.coop.noFinancialData")}</p>
                  <p className="text-xs mt-1">{t("dashboard.coop.noFinancialDataSub")}</p>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={t("dashboard.coop.portfolioQuality")}
            subtitle={
              kpisData?.kpis && kpisData.kpis.length > 0
                ? t("dashboard.coop.derivedPar")
                : t("dashboard.coop.noData")
            }
            info={t("dashboard.coop.portfolioQualityInfo")}
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
                <div className="h-44">
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
                <p className="text-xs">{t("dashboard.coop.submitFinancialStatement")}</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Submission History ── */}
        <Card
          title={t("dashboard.coop.history")}
          subtitle={t("dashboard.coop.historySub")}
          info={t("dashboard.coop.historyInfo")}
        >
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">{t("dashboard.coop.colReference")}</th>
                  <th className="px-5 py-3">{t("dashboard.coop.colYear")}</th>
                  <th className="px-5 py-3">{t("dashboard.coop.colFiledOn")}</th>
                  <th className="px-5 py-3">{t("dashboard.coop.colStatus")}</th>
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
                      <p className="text-sm font-semibold">{t("dashboard.apex.noSubmissions")}</p>
                      <p className="text-xs mt-1">{t("dashboard.coop.noSubmissionsSub")}</p>
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
