import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { Building2, Users, ShieldCheck, BarChart3, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import { useMinistrySubmissions } from "@/hooks/submissions/useSubmissions";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

// ─────────────────────────────────────────────────────────────────────
// MINISTRY DASHBOARD — real data only
// Full national oversight: all federations, apexes, cooperatives
// ─────────────────────────────────────────────────────────────────────
export function MinistryDashboard() {
  const { t } = useOrganizationLabelsContext();
  const { data: stats, isLoading: statsLoading } = useMinistryStats();
  const { data: submissions = [], isLoading: subsLoading } = useMinistrySubmissions();

  const totalCoops = stats?.total_cooperatives ?? 0;
  const totalSubmissions = stats?.total_submissions ?? 0;
  const pendingCount = stats?.pending_review_count ?? 0;
  const approvedCount = stats?.approved_count ?? 0;
  const rejectedCount = stats?.rejected_count ?? 0;

  const statusLabel: Record<string, string> = {
    draft: t("dashboard.status.draft"),
    submitted: t("dashboard.status.submitted"),
    in_review: t("dashboard.status.inReview"),
    approved: t("dashboard.status.approved"),
    rejected: t("dashboard.status.rejected"),
    returned: t("dashboard.status.changesRequested"),
  };

  return (
    <AppShell
      title={t("dashboard.ministry.title")}
      subtitle={t("dashboard.ministry.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/app/analytics"
            className="press-feedback hidden items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors sm:inline-flex"
          >
            <BarChart3 className="size-4 text-accent" />
            {t("dashboard.ministry.viewAllStats")}
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Row ── */}
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
                icon={Building2}
                label={t("dashboard.ministry.totalCooperatives")}
                value={totalCoops.toLocaleString()}
                subtitle={t("dashboard.ministry.registeredAcrossAll")}
                tone="accent"
              />
              <StatCard
                icon={Users}
                label={t("dashboard.ministry.totalSubmissions")}
                value={totalSubmissions.toLocaleString()}
                subtitle={t("dashboard.ministry.allTimeSubmissions")}
                tone="success"
              />
              <StatCard
                icon={ShieldCheck}
                label={t("dashboard.ministry.pendingReview")}
                value={pendingCount.toLocaleString()}
                subtitle={t("dashboard.ministry.awaitingApproval")}
                tone="warning"
              />
              <StatCard
                icon={BarChart3}
                label={t("dashboard.ministry.approved")}
                value={approvedCount.toLocaleString()}
                subtitle={`${rejectedCount} ${t("dashboard.ministry.rejected")}`}
                tone="info"
              />
            </>
          )}
        </div>

        {/* ── Recent Submissions ── */}
        <Card
          title={t("dashboard.ministry.recentSubmissions")}
          subtitle={t("dashboard.ministry.recentSubmissionsSub")}
          action={
            <Link
              to="/app/submissions"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("dashboard.ministry.viewAll")}
            </Link>
          }
        >
          {subsLoading ? (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-3">{t("dashboard.ministry.colReference")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colCooperative")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colYear")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colFiledOn")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-5 py-3.5">
                        <Skeleton className="h-3 w-32" />
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <BarChart3 className="size-8 mb-3 opacity-30" />
              <p className="text-sm font-semibold">{t("dashboard.ministry.noSubmissions")}</p>
              <p className="text-xs mt-1">{t("dashboard.ministry.noSubmissionsSub")}</p>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-3">{t("dashboard.ministry.colReference")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colCooperative")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colYear")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colFiledOn")}</th>
                    <th className="px-5 py-3">{t("dashboard.ministry.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submissions.slice(0, 8).map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {sub.reference ?? sub.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5 font-semibold">{sub.cooperative_name ?? "—"}</td>
                      <td className="px-5 py-3.5">{sub.reporting_year}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {sub.submitted_at || sub.created_at
                          ? new Date(sub.submitted_at || sub.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            sub.status === "approved"
                              ? "bg-success/10 text-success"
                              : ["submitted", "in_review"].includes(sub.status)
                                ? "bg-warning/10 text-warning-foreground"
                                : ["rejected", "returned"].includes(sub.status)
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel[sub.status] ?? sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Summary Stats ── */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card
            title={t("dashboard.ministry.submissionOverview")}
            subtitle={t("dashboard.ministry.submissionOverviewSub")}
          >
            {statsLoading ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {[
                  {
                    label: t("dashboard.status.approved"),
                    value: approvedCount,
                    color: "text-success",
                  },
                  {
                    label: t("dashboard.status.inReview"),
                    value: pendingCount,
                    color: "text-warning-foreground",
                  },
                  {
                    label: t("dashboard.status.rejected"),
                    value: rejectedCount,
                    color: "text-destructive",
                  },
                  {
                    label: t("dashboard.status.draft"),
                    value: totalSubmissions - approvedCount - pendingCount - rejectedCount,
                    color: "text-muted-foreground",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-bold num ${item.color}`}>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={t("dashboard.ministry.cooperativeCoverage")}
            subtitle={t("dashboard.ministry.cooperativeCoverageSub")}
          >
            {statsLoading ? (
              <div className="flex items-center gap-4 pt-2">
                <Skeleton className="h-12 w-20" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2 w-28" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 pt-2">
                <div className="text-4xl font-bold text-accent num">
                  {totalCoops.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>{t("dashboard.ministry.registeredCooperatives")}</p>
                  <p className="mt-1">
                    {((approvedCount / Math.max(totalSubmissions, 1)) * 100).toFixed(0)}%{" "}
                    {t("dashboard.ministry.submissionApprovalRate")}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={t("dashboard.ministry.analyticsCardTitle")}
            subtitle={t("dashboard.ministry.analyticsCardSub")}
          >
            <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground gap-3">
              <BarChart3 className="size-8 opacity-40" />
              <p className="text-xs">{t("dashboard.ministry.analyticsCardDesc")}</p>
              <Link
                to="/app/analytics"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("dashboard.ministry.goToAnalytics")}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
