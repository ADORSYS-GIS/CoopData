import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  KPI as MOCK_KPI,
  COOPERATIVES as INITIAL_COOPERATIVES,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
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
  Download,
  BarChart3,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useMinistrySubmissions } from "@/hooks/submissions/useSubmissions";

// ─────────────────────────────────────────────────────────────────────
// MINISTRY DASHBOARD
// Full national oversight: all federations, apexes, cooperatives
// Can create federations + users, view everything, export reports
// ─────────────────────────────────────────────────────────────────────
export function MinistryDashboard({
  cooperatives,
  activities,
}: {
  cooperatives: typeof INITIAL_COOPERATIVES;
  activities: typeof INITIAL_ACTIVITY_FEED;
}) {
  const { data: realSubmissions = [], isLoading: subsLoading } = useMinistrySubmissions();

  const pendingSubmissions = realSubmissions.filter(
    (s) => s.status === "in_review" && s.current_tier === "ministry",
  );

  return (
    <AppShell
      title="National Cooperative Intelligence"
      subtitle="Real-time oversight · Ministry of Commerce & Cooperative Development"
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
              toast.success("Preparing PDF download for national registry snapshot...");
            }}
            className="hidden items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            <Download className="size-4" />
            Generate national report
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <KPIGrid />

        {/* Validation Center + Live Activity */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Validation Center"
            subtitle="Review and finalize incoming submissions forwarded by the Federation"
          >
            <div className="space-y-4 pt-2">
              {subsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Loader2 className="size-6 mb-3 animate-spin text-accent" />
                  <p className="text-sm">Loading submissions…</p>
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <CheckCircle2 className="size-8 mb-2 text-success" />
                  <p className="text-sm font-semibold">Inbox Cleared</p>
                  <p className="text-xs">All submitted reports have been finalized.</p>
                </div>
              ) : (
                pendingSubmissions.map((sub) => (
                  <Link
                    key={sub.id}
                    to="/app/submissions/$id"
                    params={{ id: sub.id }}
                    className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 card-edge hover-lift hover:border-primary/30 transition-all block cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          {sub.reference ?? sub.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                          {sub.reporting_year}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold truncate text-foreground">
                        {sub.cooperative_name ?? "—"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Submitted on{" "}
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all inline-flex items-center gap-1">
                        <Clock className="size-3.5" /> Review
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
          <Card title="Live activity" subtitle="Submission stream across the federation">
            <ActivityFeedList activities={activities} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Membership growth"
            subtitle="Monthly active members across all cooperatives — 2025"
            action={<TimeRange />}
          >
            <TrendChart />
          </Card>
          <Card title="Sector distribution" subtitle="Share of registered cooperatives by sector">
            <SectorBreakdown />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Regional penetration"
            subtitle="Cooperative density and compliance by region"
          >
            <RegionsHeatGrid />
          </Card>
          <div />
        </div>

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
          <TopTable cooperatives={cooperatives} />
        </Card>
      </div>
    </AppShell>
  );
}

function KPIGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={Building2}
        label="Total cooperatives"
        value={formatNumber(MOCK_KPI.totalCoops)}
        subtitle={`+${(MOCK_KPI.growthYoY * 100).toFixed(1)}% vs last year`}
        tone="accent"
      />
      <StatCard
        icon={Users}
        label="Active members"
        value={formatNumber(MOCK_KPI.totalMembers)}
        subtitle={`${(MOCK_KPI.womenShare * 100).toFixed(1)}% women · ${(MOCK_KPI.youthShare * 100).toFixed(1)}% youth`}
        tone="success"
      />
      <StatCard
        icon={Wallet}
        label="Loan portfolio"
        value={formatCurrency(MOCK_KPI.loanPortfolio)}
        subtitle="1.2% NPL non-performing"
        tone="warning"
      />
      <StatCard
        icon={ShieldCheck}
        label="Compliance score"
        value={MOCK_KPI.complianceScore.toFixed(1)}
        subtitle={`${MOCK_KPI.complianceTrend.toFixed(1)} pts national median`}
        tone="info"
      />
    </div>
  );
}
