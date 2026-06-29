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
import { Building2, Users, Wallet, ShieldCheck, Download, BarChart3 } from "lucide-react";
import { toast } from "sonner";

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
          <Card title="Live activity" subtitle="Submission stream across the federation">
            <ActivityFeedList activities={activities} />
          </Card>
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
