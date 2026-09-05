import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { Building2, Users, ShieldCheck, BarChart3, ArrowRight, Inbox, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import { useMinistrySubmissions } from "@/hooks/submissions/useSubmissions";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import {
  SubmissionTrendChart,
  StatusBreakdownDonut,
} from "@/components/dashboards/dashboard-charts";

// ─────────────────────────────────────────────────────────────────────
// MINISTRY DASHBOARD — clean overview + recent submissions
// ─────────────────────────────────────────────────────────────────────

export function MinistryDashboard() {
  const { t } = useOrganizationLabelsContext();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useMinistryStats();
  const { data: submissions = [], isLoading: subsLoading } = useMinistrySubmissions();

  const totalCoops = stats?.total_cooperatives ?? 0;
  const totalSubmissions = stats?.total_submissions ?? 0;
  const pendingCount = stats?.pending_review_count ?? 0;
  const approvedCount = stats?.approved_count ?? 0;
  const rejectedCount = stats?.rejected_count ?? 0;

  const statusVariant: Record<
    string,
    "default" | "success" | "warning" | "destructive" | "secondary"
  > = {
    approved: "success",
    submitted: "warning",
    in_review: "warning",
    rejected: "destructive",
    returned: "destructive",
    draft: "secondary",
  };

  const statusLabel: Record<string, string> = {
    draft: t("dashboard.status.draft"),
    submitted: t("dashboard.status.submitted"),
    in_review: t("dashboard.status.inReview"),
    approved: t("dashboard.status.approved"),
    rejected: t("dashboard.status.rejected"),
    returned: t("dashboard.status.changesRequested"),
  };

  const recentSubmissions = submissions.slice(0, 6);

  const draftCount = Math.max(totalSubmissions - approvedCount - pendingCount - rejectedCount, 0);

  const pendingSubmissions = submissions
    .filter((s) => ["submitted", "in_review"].includes(s.status))
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? b.created_at ?? 0).getTime() -
        new Date(a.submitted_at ?? a.created_at ?? 0).getTime(),
    )
    .slice(0, 6);

  return (
    <AppShell title={t("dashboard.ministry.title")} subtitle={t("dashboard.ministry.subtitle")}>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {t("dashboard.ministry.welcome", { name: user?.firstName || user?.name || "" })}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("dashboard.ministry.welcomeSub")}
            </p>
          </div>
          <Link
            to="/app/analytics"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline sm:mt-0"
          >
            {t("dashboard.ministry.viewAllStats")}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* KPI Row */}
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

        {/* Overview + Status breakdown */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Overview graph */}
          <Card
            className="lg:col-span-2"
            title={t("dashboard.ministry.overviewTitle")}
            subtitle={t("dashboard.ministry.overviewSub")}
          >
            {subsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-[220px] w-full rounded-lg" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ) : (
              <SubmissionTrendChart
                data={submissions}
                emptyTitle={t("dashboard.ministry.noTrendData")}
                emptySub={t("dashboard.ministry.noTrendDataSub")}
                seriesLabel={t("dashboard.ministry.submissions")}
              />
            )}
          </Card>

          {/* Status breakdown donut */}
          <Card
            title={t("dashboard.ministry.statusBreakdown")}
            subtitle={t("dashboard.ministry.statusBreakdownSub")}
          >
            {statsLoading ? (
              <div className="flex h-[240px] items-center justify-center">
                <Skeleton className="size-40 rounded-full" />
              </div>
            ) : (
              <StatusBreakdownDonut
                approved={approvedCount}
                pending={pendingCount}
                rejected={rejectedCount}
                draft={draftCount}
                totalLabel={t("dashboard.ministry.totalSubmissions")}
                emptyLabel={t("dashboard.ministry.noSubmissions")}
              />
            )}
          </Card>
        </div>

        {/* Recent submissions + Pending review queue */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent submissions */}
          <Card
            className="lg:col-span-2"
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
            <div className="-mx-5 -mb-5">
              {subsLoading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Inbox className="size-8 mb-3 opacity-30" />
                  <p className="text-sm font-semibold">{t("dashboard.ministry.noSubmissions")}</p>
                  <p className="text-xs mt-1">{t("dashboard.ministry.noSubmissionsSub")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentSubmissions.map((sub) => {
                    const filedAt = sub.submitted_at ?? sub.created_at;
                    return (
                      <li key={sub.id}>
                        <Link
                          to={`/app/submissions/${sub.id}`}
                          className="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                              {sub.cooperative_name ?? t("dashboard.ministry.unknownCooperative")}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {sub.reporting_year}
                              {filedAt && (
                                <span className="ml-2">
                                  {new Date(filedAt).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge variant={statusVariant[sub.status] ?? "default"}>
                            {statusLabel[sub.status] ?? sub.status}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* Pending review queue */}
          <Card
            title={t("dashboard.ministry.pendingQueue")}
            subtitle={t("dashboard.ministry.pendingQueueSub")}
            action={
              <Link
                to="/app/submissions"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("dashboard.ministry.viewAll")}
              </Link>
            }
          >
            <div className="-mx-5 -mb-5">
              {subsLoading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Clock className="size-8 mb-3 opacity-30" />
                  <p className="text-sm font-semibold">{t("dashboard.ministry.noPending")}</p>
                  <p className="text-xs mt-1">{t("dashboard.ministry.noPendingSub")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {pendingSubmissions.map((sub) => {
                    const filedAt = sub.submitted_at ?? sub.created_at;
                    return (
                      <li key={sub.id}>
                        <Link
                          to={`/app/submissions/${sub.id}`}
                          className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-foreground">
                            <Clock className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                              {sub.cooperative_name ?? t("dashboard.ministry.unknownCooperative")}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {sub.reporting_year}
                              {filedAt && (
                                <span className="ml-2">
                                  {new Date(filedAt).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge variant="warning">{statusLabel[sub.status] ?? sub.status}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
