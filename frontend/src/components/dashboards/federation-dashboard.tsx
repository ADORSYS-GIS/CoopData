import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  SUBMISSIONS as INITIAL_SUBMISSIONS,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
  COOPERATIVES as INITIAL_COOPERATIVES,
  formatNumber,
  formatCurrency,
} from "@/lib/mock-data";
import {
  TimeRange,
  TrendChart,
  SectorBreakdown,
  RegionsHeatGrid,
  ActivityFeedList,
  TopTable,
} from "@/components/dashboards/shared-charts";
import {
  Building2,
  Users,
  Wallet,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// FEDERATION DASHBOARD
// Reviews submissions from apexes, creates apexes + users
// Has dashboard, analytics, consolidated/individual reports
// ─────────────────────────────────────────────────────────────────────
export function FederationDashboard({
  submissions,
  setSubmissions,
  activities,
  setActivities,
}: {
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
  activities: typeof INITIAL_ACTIVITY_FEED;
  setActivities: React.Dispatch<React.SetStateAction<typeof INITIAL_ACTIVITY_FEED>>;
}) {
  const pendingCount = submissions.filter((s) => s.status === "Pending Review").length;
  const verifiedCount = submissions.filter((s) => s.status === "Verified").length;
  const rejectedCount = submissions.filter(
    (s) => s.status === "Rejected" || s.status === "Resubmit",
  ).length;

  const handleAction = (id: string, name: string, status: "Verified" | "Rejected" | "Resubmit") => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    setActivities([
      {
        id: "f" + (activities.length + 1),
        initials: "FED",
        type: "submission",
        title: "Submission Audited",
        detail: `${name} return set to ${status}`,
        time: "Just now",
        tone: status === "Verified" ? ("success" as const) : ("warning" as const),
      },
      ...activities,
    ]);
    toast.success(`Submission return for ${name} marked as ${status.toUpperCase()}!`);
  };

  return (
    <AppShell
      title="Federation Workspace"
      subtitle="Manzini Regional Federation · Review data declarations, resolve flags, and guide compliance"
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/app/analytics"
            className="press-feedback hidden items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors sm:inline-flex"
          >
            <BarChart3 className="size-4 text-accent" />
            View all statistics
          </Link>
          <button
            onClick={() => {
              toast.success("Preparing PDF download for federation report...");
            }}
            className="hidden items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            <Download className="size-4" />
            Generate report
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Building2}
            label="Federation cooperatives"
            value={formatNumber(4480)}
            subtitle="+2.8% vs last year"
            tone="accent"
          />
          <StatCard
            icon={Users}
            label="Active members"
            value={formatNumber(891200)}
            subtitle="54.1% women · 37.8% youth"
            tone="success"
          />
          <StatCard
            icon={Wallet}
            label="Loan portfolio"
            value={formatCurrency(842100000)}
            subtitle="1.4% NPL non-performing"
            tone="warning"
          />
          <StatCard
            icon={ShieldCheck}
            label="Compliance score"
            value="91.3"
            subtitle="+1.2 pts federation median"
            tone="info"
          />
        </div>

        {/* Trend + Sector Breakdown */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Membership growth"
            subtitle="Monthly active members across your federation — 2025"
            action={<TimeRange />}
          >
            <TrendChart />
          </Card>
          <Card title="Sector distribution" subtitle="Share of registered cooperatives by sector">
            <SectorBreakdown />
          </Card>
        </div>

        {/* Validation Center + Activity Feed */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Validation Center"
            subtitle="Analyze incoming cooperative returns and cross-reference financial metrics"
          >
            <div className="space-y-4 pt-2">
              {submissions.filter((s) => s.status === "Pending Review").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <CheckCircle2 className="size-8 mb-2 text-success" />
                  <p className="text-sm font-semibold">Inbox Cleared</p>
                  <p className="text-xs">All submitted reports have been validated.</p>
                </div>
              ) : (
                submissions
                  .filter((s) => s.status === "Pending Review")
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 card-edge hover-lift"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {sub.reference}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            {sub.type}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold truncate text-foreground">
                          {sub.coopName}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Submitted by {sub.submittedBy} · {sub.submittedOn}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Verified")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Resubmit")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-all"
                        >
                          Need Changes
                        </button>
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Rejected")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/95 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>

          <Card title="Live activity" subtitle="Submission stream across your federation">
            <ActivityFeedList activities={activities} />
          </Card>
        </div>

        {/* Regional Penetration + Support */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Regional penetration"
            subtitle="Cooperative density and compliance by region"
          >
            <RegionsHeatGrid />
          </Card>

          <Card
            title="Cooperative Support"
            subtitle="Active assistance requests and system compliance tickets"
          >
            <ul className="space-y-3 pt-2">
              <li className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Lubombo Dairy Coop</span>
                  <StatusPill tone="warning">Open</StatusPill>
                </div>
                <p className="text-muted-foreground leading-snug">
                  "Cannot upload auditor certificate v2. File format error message is displayed."
                </p>
                <button
                  onClick={() => toast.success("Notification sent to Cooperative support line.")}
                  className="mt-2 text-accent font-bold hover:underline"
                >
                  Contact Manager
                </button>
              </li>
              <li className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Apex Savings Union</span>
                  <StatusPill tone="success">Resolved</StatusPill>
                </div>
                <p className="text-muted-foreground leading-snug">
                  "Offline submission sync queue is showing duplicates."
                </p>
                <p className="mt-1 text-[10px] text-success">Synced successfully 1h ago</p>
              </li>
            </ul>
          </Card>
        </div>

        {/* Top Performing Cooperatives */}
        <Card
          title="Top performing cooperatives"
          subtitle="Ranked by member growth and capital base — last 30 days"
          action={
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => toast.info("Opening filter pane...")}
                className="rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-muted"
              >
                Filter
              </button>
              <button
                onClick={() => toast.success("Exporting cooperatives to CSV...")}
                className="rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-muted"
              >
                Export CSV
              </button>
            </div>
          }
        >
          <TopTable cooperatives={INITIAL_COOPERATIVES} />
        </Card>
      </div>
    </AppShell>
  );
}
