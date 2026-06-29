import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  COOPERATIVES as INITIAL_COOPERATIVES,
  SUBMISSIONS as INITIAL_SUBMISSIONS,
} from "@/lib/mock-data";
import {
  Building2,
  Clock,
  ClipboardCheck,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  AlertTriangle,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// APEX DASHBOARD
// Creates cooperatives + users under them
// Reviews submissions from cooperatives (approve/reject/request changes)
// If approved, submission goes to Federation
// Has dashboard, analytics, consolidated/individual reports
// ─────────────────────────────────────────────────────────────────────
export function ApexDashboard({
  cooperatives,
  setCooperatives,
  submissions,
  setSubmissions,
}: {
  cooperatives: typeof INITIAL_COOPERATIVES;
  setCooperatives: React.Dispatch<React.SetStateAction<typeof INITIAL_COOPERATIVES>>;
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
}) {
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "verified" | "rejected">("all");

  const pendingCount = submissions.filter((s) => s.status === "Pending Review").length;
  const verifiedCount = submissions.filter((s) => s.status === "Verified").length;
  const rejectedCount = submissions.filter(
    (s) => s.status === "Rejected" || s.status === "Resubmit",
  ).length;

  const handleReviewAction = (
    id: string,
    coopName: string,
    action: "Verified" | "Rejected" | "Resubmit",
  ) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: action } : s)),
    );
    const actionLabel =
      action === "Verified"
        ? "Approved & forwarded to Federation"
        : action === "Rejected"
          ? "Rejected"
          : "Changes requested";
    toast.success(`${actionLabel} for ${coopName}`);
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return s.status === "Pending Review";
    if (filterStatus === "verified") return s.status === "Verified";
    if (filterStatus === "rejected") return s.status === "Rejected" || s.status === "Resubmit";
    return true;
  });

  return (
    <AppShell
      title="Apex Supervision Workspace"
      subtitle="Hhohho & Lubombo Apex · Review cooperative submissions, manage cooperatives & validate data"
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
          <StatCard
            label="Cooperatives Under Apex"
            value={cooperatives.length.toString()}
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
          {filteredSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mb-3 text-success" />
              <p className="text-sm font-semibold">No submissions match this filter</p>
              <p className="text-xs mt-1">Try changing the filter or check back later.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 card-edge hover-lift"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {sub.reference}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {sub.type}
                      </span>
                      <StatusPill
                        tone={
                          sub.status === "Verified"
                            ? "success"
                            : sub.status === "Pending Review"
                              ? "warning"
                              : sub.status === "Rejected"
                                ? "danger"
                                : "info"
                        }
                      >
                        {sub.status}
                      </StatusPill>
                    </div>
                    <h4 className="text-sm font-bold truncate text-foreground">
                      {sub.coopName}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Submitted by {sub.submittedBy} · {sub.submittedOn}
                    </p>
                  </div>

                  {sub.status === "Pending Review" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReviewAction(sub.id, sub.coopName, "Verified")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="size-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReviewAction(sub.id, sub.coopName, "Resubmit")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-all inline-flex items-center gap-1"
                      >
                        <MessageSquare className="size-3.5" /> Request Changes
                      </button>
                      <button
                        onClick={() => handleReviewAction(sub.id, sub.coopName, "Rejected")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/95 transition-all inline-flex items-center gap-1"
                      >
                        <XCircle className="size-3.5" /> Reject
                      </button>
                    </div>
                  )}

                  {sub.status === "Verified" && (
                    <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                      <TrendingUp className="size-3.5" /> Forwarded to Federation
                    </div>
                  )}

                  {(sub.status === "Rejected" || sub.status === "Resubmit") && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                      <AlertTriangle className="size-3.5" /> {sub.status === "Rejected" ? "Rejected" : "Changes Requested"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cooperatives Under Management */}
        <Card
          title="Cooperatives Under Management"
          subtitle="All cooperatives registered under this Apex organization"
          action={
            <button
              onClick={() => toast.info("Navigate to Cooperatives page to add new cooperative...")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Add Cooperative
            </button>
          }
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Reg. No.</th>
                  <th className="px-5 py-3">Cooperative</th>
                  <th className="px-5 py-3">Sector</th>
                  <th className="px-5 py-3 text-right">Members</th>
                  <th className="px-5 py-3 text-right">Capital Base</th>
                  <th className="px-5 py-3">Compliance</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cooperatives.slice(0, 6).map((coop) => (
                  <tr key={coop.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{coop.regNo}</td>
                    <td className="px-5 py-3 font-semibold">{coop.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{coop.sector}</td>
                    <td className="px-5 py-3 text-right num">{coop.members.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold num">
                      ${(coop.portfolio / 1_000_000).toFixed(1)}M
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill
                        tone={
                          coop.compliance === "Verified"
                            ? "success"
                            : coop.compliance === "Pending"
                              ? "warning"
                              : coop.compliance === "Under Review"
                                ? "info"
                                : "danger"
                        }
                      >
                        {coop.compliance}
                      </StatusPill>
                    </td>
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

        {/* Quick Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Compliance Rate" subtitle="Cooperatives in good standing">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold text-success">87%</div>
              <div className="text-xs text-muted-foreground">
                <p>7 of {cooperatives.length} cooperatives verified</p>
                <p className="mt-1 flex items-center gap-1 text-success">
                  <TrendingUp className="size-3" /> +3.2% from last quarter
                </p>
              </div>
            </div>
          </Card>
          <Card title="Submissions This Month" subtitle="Data returns received">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold text-accent">{submissions.length}</div>
              <div className="text-xs text-muted-foreground">
                <p>Total submissions processed</p>
                <p className="mt-1">{pendingCount} still pending review</p>
              </div>
            </div>
          </Card>
          <Card title="Total Membership" subtitle="Across all cooperatives">
            <div className="flex items-center gap-4 pt-2">
              <div className="text-4xl font-bold">
                {(cooperatives.reduce((sum, c) => sum + c.members, 0) / 1000).toFixed(1)}K
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