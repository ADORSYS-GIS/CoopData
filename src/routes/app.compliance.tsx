import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ShieldCheck,
  Clock,
  FileX,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  XCircle,
  Target,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { ALERTS, REGIONS } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/compliance")({
  head: () => ({ meta: [{ title: "Compliance — CoopData" }] }),
  component: CompliancePage,
});

const VALIDATION_FAILURES = [
  { reason: "Missing financial statements", count: 18, pct: 43 },
  { reason: "Incorrect member count reported", count: 12, pct: 29 },
  { reason: "Outdated reporting period", count: 7, pct: 17 },
  { reason: "Duplicate submission reference", count: 3, pct: 7 },
  { reason: "Invalid currency format", count: 2, pct: 5 },
];

const MONTHLY_TREND = [
  { month: "January", score: 88.2, change: null },
  { month: "February", score: 89.1, change: "+0.9" },
  { month: "March", score: 90.4, change: "+1.3" },
  { month: "April", score: 89.8, change: "-0.6" },
  { month: "May", score: 91.6, change: "+1.8" },
  { month: "June", score: 92.4, change: "+0.8" },
];

function CompliancePage() {
  return (
    <AppShell
      title="Compliance Monitoring"
      subtitle="Live oversight of missing returns, validation failures, and escalated cases across all regions"
    >
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ShieldCheck}
            label="National Score"
            value="92.4"
            subtitle="pts · national average"
            tone="success"
          />
          <StatCard
            icon={Clock}
            label="Late Submissions"
            value="248"
            subtitle="↑ 18 vs last month"
            tone="warning"
          />
          <StatCard
            icon={FileX}
            label="Validation Failures"
            value="42"
            subtitle="↓ 5 resolved"
            tone="danger"
          />
          <StatCard
            icon={AlertTriangle}
            label="Open Cases"
            value="118"
            subtitle="Pending intervention"
            tone="primary"
          />
        </div>

        {/* Alerts + Region Scores */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Active Compliance Alerts"
            subtitle="Cases requiring immediate intervention or review"
            edge="danger"
          >
            <ul className="divide-y divide-border -my-2">
              {[...ALERTS, ...ALERTS].map((a, i) => {
                const tone =
                  a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info";
                const iconBg = "bg-muted text-muted-foreground";
                return (
                  <li
                    key={i}
                    className="py-3.5 flex items-center gap-4 group hover:bg-muted/20 -mx-5 px-5 transition-colors cursor-pointer"
                    onClick={() => toast.info(`Opening case: ${a.title}`)}
                  >
                    <div className={`size-9 rounded-xl grid place-items-center shrink-0 ${iconBg}`}>
                      <AlertTriangle className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {a.coop} · Due {a.deadline}
                      </p>
                    </div>
                    <StatusPill tone={tone}>{a.severity.toUpperCase()}</StatusPill>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Region Scores */}
          <Card
            title="Regional Scores"
            subtitle="Compliance percentage by administrative region"
            edge="success"
          >
            <ul className="space-y-5">
              {REGIONS.map((r) => {
                const color =
                  r.compliance >= 95
                    ? "var(--success)"
                    : r.compliance >= 85
                      ? "var(--warning)"
                      : "var(--destructive)";
                const textColor =
                  r.compliance >= 95
                    ? "text-success"
                    : r.compliance >= 85
                      ? "text-warning-foreground"
                      : "text-destructive";
                const bgTint =
                  r.compliance >= 95
                    ? "bg-success/5"
                    : r.compliance >= 85
                      ? "bg-warning/5"
                      : "bg-destructive/5";
                return (
                  <li key={r.code} className={`rounded-xl p-3.5 ${bgTint} border border-border`}>
                    <div className="flex items-center justify-between text-sm mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <Target className="size-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{r.name}</span>
                      </div>
                      <span className={`font-heading font-bold num ${textColor}`}>
                        {r.compliance}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${r.compliance}%`, background: color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Failure Breakdown + Monthly Trend */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card
            title="Common Validation Failures"
            subtitle="Top rejection reasons across all submissions"
            edge="danger"
          >
            <ul className="space-y-4">
              {VALIDATION_FAILURES.map((f) => (
                <li key={f.reason}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-foreground">{f.reason}</span>
                    <span className="text-xs font-mono text-muted-foreground">{f.count} cases</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${f.pct}%`, background: "var(--accent)" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total validation failures this cycle
              </span>
              <span className="text-sm font-heading font-bold text-destructive num">42</span>
            </div>
          </Card>

          <Card
            title="Monthly Compliance Trend"
            subtitle="National aggregate score — last 6 months"
            edge="accent"
          >
            <div className="space-y-1">
              {MONTHLY_TREND.map((m, i) => {
                const isLatest = i === MONTHLY_TREND.length - 1;
                return (
                  <div
                    key={m.month}
                    className={`flex items-center justify-between py-3.5 border-b border-border last:border-0 hover:bg-muted/20 -mx-5 px-5 transition-colors ${
                      isLatest ? "bg-accent/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isLatest && <span className="size-2 rounded-full bg-accent animate-pulse" />}
                      <span
                        className={`text-sm font-medium ${isLatest ? "text-foreground font-semibold" : "text-foreground"}`}
                      >
                        {m.month}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-heading font-bold num ${isLatest ? "text-accent" : "text-foreground"}`}
                      >
                        {m.score}%
                      </span>
                      {m.change && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                            m.change.startsWith("+") ? "text-success" : "text-destructive"
                          }`}
                        >
                          {m.change.startsWith("+") ? (
                            <TrendingUp className="size-3" />
                          ) : (
                            <TrendingDown className="size-3" />
                          )}
                          {m.change}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">6-month average</span>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-foreground num">
                    {(
                      MONTHLY_TREND.reduce((a, b) => a + b.score, 0) / MONTHLY_TREND.length
                    ).toFixed(1)}
                    %
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-success">
                    <TrendingUp className="size-3" />
                    +4.2
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
