import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { useFederationSubmissions, useApexSubmissions } from "@/hooks/submissions/useSubmissions";
import { useApexes } from "@/hooks/apexes/useApexes";
import { useFederationStats } from "@/hooks/analytics/useFederationStats";
import { useTranslation } from "react-i18next";

// ─────────────────────────────────────────────────────────────────────
// FEDERATION DASHBOARD — real data only
// Reviews submissions from apexes
// ─────────────────────────────────────────────────────────────────────

export function FederationDashboard() {
  const { t } = useTranslation();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">(
    "all",
  );

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

  const filteredSubmissions = submissions.filter((s) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return ["submitted", "in_review"].includes(s.status);
    if (filterStatus === "approved") return s.status === "approved";
    if (filterStatus === "rejected") return ["rejected", "returned"].includes(s.status);
    return true;
  });

  const statusTone = (status: string): "success" | "warning" | "danger" | "neutral" => {
    if (status === "approved") return "success";
    if (["submitted", "in_review"].includes(status)) return "warning";
    if (["rejected", "returned"].includes(status)) return "danger";
    return "neutral";
  };

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
      title={t("dashboard.federation.title")}
      subtitle={t("dashboard.federation.subtitle")}
      actions={
        <Link
          to="/app/analytics"
          className="press-feedback hidden items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors sm:inline-flex"
        >
          <BarChart3 className="size-4 text-accent" />
          {t("dashboard.federation.viewAllStats")}
        </Link>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Row ── */}
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

        {/* ── Submission Review Queue ── */}
        <Card
          title={t("dashboard.federation.reviewQueue")}
          subtitle={t("dashboard.federation.reviewQueueSub")}
          action={
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
              >
                <option value="all">{t("dashboard.federation.allStatus")}</option>
                <option value="pending">{t("dashboard.federation.pending")}</option>
                <option value="approved">{t("dashboard.federation.approved")}</option>
                <option value="rejected">{t("dashboard.federation.rejectedChangesOption")}</option>
              </select>
            </div>
          }
        >
          {subsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-10 rounded-full" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mb-3 text-success" />
              <p className="text-sm font-semibold">{t("dashboard.federation.noMatchFilter")}</p>
              <p className="text-xs mt-1">{t("dashboard.federation.noMatchFilterSub")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.slice(0, 8).map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 hover-lift"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {sub.reference ?? sub.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {sub.reporting_year}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          statusTone(sub.status) === "success"
                            ? "bg-success/10 text-success"
                            : statusTone(sub.status) === "warning"
                              ? "bg-warning/10 text-warning-foreground"
                              : statusTone(sub.status) === "danger"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {statusLabel[sub.status] ?? sub.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold truncate text-foreground">
                      {sub.cooperative_name ?? "—"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleDateString()
                        : t("dashboard.federation.notSubmitted")}
                    </p>
                  </div>

                  {sub.status === "in_review" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to="/app/submissions/$id"
                        params={{ id: sub.id }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="size-3.5" /> {t("dashboard.federation.reviewBtn")}
                      </Link>
                    </div>
                  )}

                  {sub.status === "approved" && (
                    <div className="flex items-center gap-1.5 text-xs text-success font-semibold shrink-0">
                      <TrendingUp className="size-3.5" />{" "}
                      {t("dashboard.federation.forwardedToMinistry")}
                    </div>
                  )}

                  {["rejected", "returned"].includes(sub.status) && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold shrink-0">
                      <AlertTriangle className="size-3.5" />{" "}
                      {sub.status === "returned"
                        ? t("dashboard.federation.changesRequestedLabel")
                        : t("dashboard.federation.rejectedLabel")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Apexes Under Management ── */}
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
                        <span className="text-xs font-semibold text-success">
                          {t("dashboard.federation.statusActive")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Summary Stats ── */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card
            title={t("dashboard.federation.submissionOverview")}
            subtitle={t("dashboard.federation.submissionOverviewSub")}
          >
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold text-accent num">{submissions.length}</div>
              <div className="text-xs text-muted-foreground">
                <p>{t("dashboard.federation.totalSubmissionsProcessed")}</p>
                <p className="mt-1">
                  {pendingCount} {t("dashboard.federation.pendingReviewCountSub")}
                </p>
                <p className="mt-1">
                  {approvedCount} {t("dashboard.federation.approvedCountSub")}
                </p>
              </div>
            </div>
          </Card>
          <Card
            title={t("dashboard.federation.apexCoverage")}
            subtitle={t("dashboard.federation.registeredApexes")}
          >
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold num">{totalApexes}</div>
              <div className="text-xs text-muted-foreground">
                <p>{t("dashboard.federation.apexesInFed")}</p>
                <p className="mt-1">
                  {totalCoops} {t("dashboard.federation.coopsTotal")}
                </p>
              </div>
            </div>
          </Card>
          <Card
            title={t("dashboard.federation.analyticsCardTitle")}
            subtitle={t("dashboard.federation.analyticsCardSub")}
          >
            <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground gap-3">
              <BarChart3 className="size-8 opacity-40" />
              <p className="text-xs">{t("dashboard.federation.analyticsCardDesc")}</p>
              <Link
                to="/app/analytics"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("dashboard.federation.goToAnalytics")}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
