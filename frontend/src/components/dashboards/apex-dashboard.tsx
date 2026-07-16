import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  COOPERATIVES as INITIAL_COOPERATIVES,
  SUBMISSIONS as INITIAL_SUBMISSIONS,
} from "@/lib/mock-data";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
  Download,
  Filter,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApexStats, useApexSubmissions } from "@/hooks/submissions/useSubmissions";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";

// ─────────────────────────────────────────────────────────────────────
// APEX DASHBOARD
// Creates cooperatives + users under them
// Reviews submissions from cooperatives (approve/reject/request changes)
// If approved, submission goes to Federation
// Has dashboard, analytics, consolidated/individual reports
// ─────────────────────────────────────────────────────────────────────
export function ApexDashboard({
  cooperatives: mockCooperatives,
  setCooperatives,
  submissions: mockSubmissions,
  setSubmissions,
}: {
  cooperatives: typeof INITIAL_COOPERATIVES;
  setCooperatives: React.Dispatch<React.SetStateAction<typeof INITIAL_COOPERATIVES>>;
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
}) {
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "verified" | "rejected">(
    "all",
  );

  const { data: stats, isLoading: statsLoading } = useApexStats();
  const { data: realSubmissions = [], isLoading: subsLoading } = useApexSubmissions();
  const { data: realCooperatives = [] } = useCooperatives();

  void setCooperatives;
  void setSubmissions;

  const pendingCount = stats?.pending_submissions ?? 0;
  const verifiedCount = stats?.approved_submissions ?? 0;
  const rejectedCount = stats?.rejected_submissions ?? 0;
  const totalCoops = stats?.total_cooperatives ?? realCooperatives.length;

  const handleReviewAction = (
    _id: string,
    _coopName: string,
    _action: "Verified" | "Rejected" | "Resubmit",
  ) => {
    toast.info("Review actions are available on the submission detail page");
  };

  const filteredSubmissions = realSubmissions.filter((s) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return ["submitted", "in_review"].includes(s.status);
    if (filterStatus === "verified") return s.status === "approved";
    if (filterStatus === "rejected") return ["rejected", "returned"].includes(s.status);
    return true;
  });

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
      title="Apex Supervision Workspace"
      subtitle="Review cooperative submissions, manage cooperatives & validate data"
      actions={
        <div className="hidden sm:flex items-center gap-2">
          <Link
            to="/app/analytics"
            className="press-feedback inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <BarChart3 className="size-4 text-accent" />
            View all statistics
          </Link>
          <button
            onClick={() => toast.success("Exporting consolidated report...")}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Download className="size-4" />
            Export Report
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <div className="col-span-2 lg:col-span-4 flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <StatCard
                label="Cooperatives Under Apex"
                value={totalCoops.toString()}
                subtitle="Active in your zones"
                icon={Building2}
                tone="accent"
              />
              <StatCard
                label="Pending Review"
                value={pendingCount.toString()}
                subtitle="Awaiting your action"
                icon={Clock}
                tone="warning"
              />
              <StatCard
                label="Approved & Forwarded"
                value={verifiedCount.toString()}
                subtitle="Sent to Federation"
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Rejected / Needs Changes"
                value={rejectedCount.toString()}
                subtitle="Requires intervention"
                icon={XCircle}
                tone="danger"
              />
            </>
          )}
        </div>

        {/* Submission Review Queue */}
        <Card
          title="Submission Review Queue"
          subtitle="Review cooperative submissions — approve to forward to Federation, or request changes"
          action={
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Review</option>
                <option value="verified">Approved</option>
                <option value="rejected">Rejected/Changes</option>
              </select>
            </div>
          }
        >
          {subsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Loader2 className="size-6 mb-3 animate-spin" />
              <p className="text-sm">Loading submissions…</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mb-3 text-success" />
              <p className="text-sm font-semibold">No submissions match this filter</p>
              <p className="text-xs mt-1">Try changing the filter or check back later.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.slice(0, 8).map((sub) => (
                <Link
                  key={sub.id}
                  to="/app/submissions/$id"
                  params={{ id: sub.id }}
                  className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 card-edge hover-lift hover:border-primary/30 transition-all block"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {sub.reference ?? sub.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {sub.reporting_year}
                      </span>
                      <StatusPill tone={statusTone(sub.status)}>
                        {statusLabel(sub.status)}
                      </StatusPill>
                    </div>
                    <h4 className="text-sm font-bold truncate text-foreground">
                      {sub.cooperative_name ?? "—"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleDateString()
                        : "Not submitted"}
                    </p>
                  </div>

                  {sub.status === "submitted" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Review
                      </div>
                    </div>
                  )}

                  {sub.status === "in_review" && (
                    <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                      <TrendingUp className="size-3.5" /> Forwarded to Federation
                    </div>
                  )}

                  {sub.status === "approved" && (
                    <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                      <CheckCircle2 className="size-3.5" /> Approved
                    </div>
                  )}

                  {sub.status === "rejected" && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                      <AlertTriangle className="size-3.5" /> Rejected
                    </div>
                  )}

                  {sub.status === "returned" && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                      <AlertTriangle className="size-3.5" /> Changes Requested
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Cooperatives Under Management */}
        <Card
          title="Cooperatives Under Management"
          subtitle="All cooperatives registered under this Apex organization"
          action={
            <Link
              to="/app/cooperatives"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Add Cooperative
            </Link>
          }
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Cooperative</th>
                  <th className="px-5 py-3">Institution Type</th>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {realCooperatives.length > 0
                  ? realCooperatives.slice(0, 6).map((coop) => (
                      <tr key={coop.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold">{coop.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {coop.institution_type ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{coop.region ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold text-success">Active</span>
                        </td>
                      </tr>
                    ))
                  : mockCooperatives.slice(0, 6).map((coop) => (
                      <tr key={coop.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold">{coop.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{coop.sector}</td>
                        <td className="px-5 py-3 text-muted-foreground">{coop.region}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-xs font-semibold ${
                              coop.status === "Active"
                                ? "text-success"
                                : coop.status === "Suspended"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {coop.status}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Stats Cards — mock data for metrics without real endpoints */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Compliance Rate" subtitle="Cooperatives in good standing">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold text-success">87%</div>
              <div className="text-xs text-muted-foreground">
                <p>7 of {totalCoops} cooperatives verified</p>
                <p className="mt-1 flex items-center gap-1 text-success">
                  <TrendingUp className="size-3" /> +3.2% from last quarter
                </p>
              </div>
            </div>
          </Card>
          <Card title="Submissions This Month" subtitle="Data returns received">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold text-accent">{realSubmissions.length}</div>
              <div className="text-xs text-muted-foreground">
                <p>Total submissions processed</p>
                <p className="mt-1">{pendingCount} still pending review</p>
              </div>
            </div>
          </Card>
          <Card title="Total Membership" subtitle="Across all cooperatives">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold">
                {(mockCooperatives.reduce((sum, c) => sum + c.members, 0) / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Registered cooperative members</p>
                <p className="mt-1 flex items-center gap-1 text-success">
                  <TrendingUp className="size-3" /> +5.8% growth
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
