import { AppShell, Card, StatCard, StatusPill } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { Building2, ShieldCheck, Clock, CheckCircle2, ArrowRight, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useFederationSubmissions } from "@/hooks/submissions/useSubmissions";
import { useApexes } from "@/hooks/apexes/useApexes";
import { useFederationStats } from "@/hooks/analytics/useFederationStats";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import {
  SubmissionTrendChart,
  StatusBreakdownDonut,
} from "@/components/dashboards/dashboard-charts";

// ─────────────────────────────────────────────────────────────────────
// FEDERATION DASHBOARD — clean overview + review queue
// Reviews submissions from apexes
// ─────────────────────────────────────────────────────────────────────

export function FederationDashboard() {
  const { t } = useOrganizationLabelsContext();
  const { user } = useAuth();

  const { data: submissions = [], isLoading: subsLoading } = useFederationSubmissions();
  const { data: apexes = [], isLoading: apexesLoading } = useApexes();
  const { data: fedStats, isLoading: statsLoading } = useFederationStats();

  const totalApexes = apexes.length;
  const totalCoops =
    fedStats?.cooperative_count ?? apexes.reduce((sum, a) => sum + (a.sub_groups?.length ?? 0), 0);
  const pendingCount =
    fedStats?.pending_review_count ??
    submissions.filter((s) => ["submitted", "in_review"].includes(s.status)).length;
  const approvedCount =
    fedStats?.approved_count ?? submissions.filter((s) => s.status === "approved").length;
  const rejectedCount =
    fedStats?.rejected_count ??
    submissions.filter((s) => ["rejected", "returned"].includes(s.status)).length;

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

  const draftCount = Math.max(submissions.length - approvedCount - pendingCount - rejectedCount, 0);

  const pendingSubmissions = submissions
    .filter((s) => ["submitted", "in_review"].includes(s.status))
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? b.created_at ?? 0).getTime() -
        new Date(a.submitted_at ?? a.created_at ?? 0).getTime(),
    )
    .slice(0, 6);

  return (
    <AppShell title={t("dashboard.federation.title")} subtitle={t("dashboard.federation.subtitle")}>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {t("dashboard.federation.welcome", { name: user?.firstName || user?.name || "" })}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("dashboard.federation.welcomeSub")}
            </p>
          </div>
          <Link
            to="/app/analytics"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline sm:mt-0"
          >
            {t("dashboard.federation.viewAllStats")}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {apexesLoading || subsLoading || statsLoading ? (
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
                label={t("dashboard.federation.apexesUnderFed")}
                value={totalApexes.toString()}
                subtitle={t("dashboard.federation.registeredApexes")}
                tone="accent"
              />
              <StatCard
                icon={Clock}
                label={t("dashboard.federation.pendingReview")}
                value={pendingCount.toString()}
                subtitle={t("dashboard.federation.awaitingAction")}
                tone="warning"
              />
              <StatCard
                icon={CheckCircle2}
                label={t("dashboard.federation.approvedForwarded")}
                value={approvedCount.toString()}
                subtitle={t("dashboard.federation.sentToMinistry")}
                tone="success"
              />
              <StatCard
                icon={ShieldCheck}
                label={t("dashboard.federation.rejectedChanges")}
                value={rejectedCount.toString()}
                subtitle={t("dashboard.federation.requiresIntervention")}
                tone="danger"
              />
            </>
          )}
        </div>

        {/* Overview + Status breakdown */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title={t("dashboard.federation.overviewTitle")}
            subtitle={t("dashboard.federation.overviewSub")}
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
                emptyTitle={t("dashboard.federation.noTrendData")}
                emptySub={t("dashboard.federation.noTrendDataSub")}
                seriesLabel={t("dashboard.federation.submissions")}
              />
            )}
          </Card>

          <Card
            title={t("dashboard.federation.statusBreakdown")}
            subtitle={t("dashboard.federation.statusBreakdownSub")}
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
                totalLabel={t("dashboard.federation.submissions")}
                emptyLabel={t("dashboard.federation.noMatchFilter")}
              />
            )}
          </Card>
        </div>

        {/* Recent submissions + Pending review queue */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title={t("dashboard.federation.reviewQueue")}
            subtitle={t("dashboard.federation.reviewQueueSub")}
            action={
              <Link
                to="/app/submissions"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("dashboard.federation.viewAllStats")}
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
                  <p className="text-sm font-semibold">{t("dashboard.federation.noMatchFilter")}</p>
                  <p className="text-xs mt-1">{t("dashboard.federation.noMatchFilterSub")}</p>
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
                              {sub.cooperative_name ?? t("dashboard.federation.unknownCooperative")}
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

          <Card
            title={t("dashboard.federation.pendingQueue")}
            subtitle={t("dashboard.federation.pendingQueueSub")}
            action={
              <Link
                to="/app/submissions"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("dashboard.federation.viewAllStats")}
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
                  <p className="text-sm font-semibold">{t("dashboard.federation.noPending")}</p>
                  <p className="text-xs mt-1">{t("dashboard.federation.noPendingSub")}</p>
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
                              {sub.cooperative_name ?? t("dashboard.federation.unknownCooperative")}
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

        {/* Apexes under management */}
        <Card
          title={t("dashboard.federation.apexesUnderMgt")}
          subtitle={t("dashboard.federation.apexesUnderMgtSub")}
          action={
            <Link
              to="/app/apexes"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("dashboard.federation.addApex")}
            </Link>
          }
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">{t("dashboard.federation.colApex")}</th>
                  <th className="px-5 py-3">{t("dashboard.federation.colPath")}</th>
                  <th className="px-5 py-3">{t("dashboard.federation.colCooperatives")}</th>
                  <th className="px-5 py-3">{t("dashboard.federation.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apexesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3">
                        <Skeleton className="h-3 w-28" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-3 w-8" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </td>
                    </tr>
                  ))
                ) : apexes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      <p className="text-sm font-semibold">{t("dashboard.federation.noApexes")}</p>
                      <p className="text-xs mt-1">{t("dashboard.federation.noApexesSub")}</p>
                    </td>
                  </tr>
                ) : (
                  apexes.slice(0, 6).map((apex) => (
                    <tr key={apex.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 font-semibold">{apex.name}</td>
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                        {apex.path ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {apex.sub_groups?.length ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone="success">
                          {t("dashboard.federation.statusActive")}
                        </StatusPill>
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
