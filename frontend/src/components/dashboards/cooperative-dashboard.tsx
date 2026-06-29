import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import {
  SUBMISSIONS as INITIAL_SUBMISSIONS,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
  formatCurrency,
} from "@/lib/mock-data";
import { FinancialStatementUpload } from "@/components/upload/financial-statement-upload";
import { ExcelDatabaseUpload } from "@/components/upload/excel-database-upload";
import type { BalanceSheet } from "@/lib/financial-data";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  ShieldCheck,
  Users,
  Wallet,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  Database,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// COOPERATIVE DASHBOARD — Upload-first, no manual entry
// Upload financial statement (PDF/image) → extract data
// Upload Excel sheets for 5 databases → validate → submit
// Rich visualizations: charts, graphs, KPIs, statistics
// ─────────────────────────────────────────────────────────────────────

// Monochromatic accent palette — single color with graduated opacity
const accentColor = "var(--accent)";
const accentOpacities = [1, 0.72, 0.48, 0.32, 0.18];

const monthlySavings = [
  { month: "Jan", savings: 420, loans: 310, deposits: 180 },
  { month: "Feb", savings: 445, loans: 325, deposits: 195 },
  { month: "Mar", savings: 470, loans: 340, deposits: 210 },
  { month: "Apr", savings: 510, loans: 355, deposits: 225 },
  { month: "May", savings: 540, loans: 370, deposits: 240 },
  { month: "Jun", savings: 580, loans: 390, deposits: 260 },
  { month: "Jul", savings: 610, loans: 405, deposits: 275 },
  { month: "Aug", savings: 640, loans: 420, deposits: 290 },
  { month: "Sep", savings: 670, loans: 435, deposits: 305 },
  { month: "Oct", savings: 695, loans: 450, deposits: 320 },
  { month: "Nov", savings: 720, loans: 465, deposits: 335 },
  { month: "Dec", savings: 750, loans: 480, deposits: 350 },
];

const sectorBreakdown = [
  { name: "Agricultural", value: 42, fill: "var(--accent)" },
  { name: "Savings & Credit", value: 31, fill: "var(--accent)" },
  { name: "Housing", value: 11, fill: "var(--accent)" },
  { name: "Transport", value: 9, fill: "var(--accent)" },
  { name: "Manufacturing", value: 7, fill: "var(--accent)" },
];

const sectorOpacities = [1, 0.78, 0.58, 0.42, 0.28];

const loanPortfolio = [
  { name: "Performing", value: 82, fill: accentColor },
  { name: "Watch List", value: 9, fill: accentColor },
  { name: "Substandard", value: 5, fill: accentColor },
  { name: "Doubtful", value: 3, fill: accentColor },
  { name: "Loss", value: 1, fill: accentColor },
];

const membershipTrend = [
  { year: "2021", members: 7200, youth: 2400, women: 3800 },
  { year: "2022", members: 7800, youth: 2700, women: 4200 },
  { year: "2023", members: 8400, youth: 3100, women: 4500 },
  { year: "2024", members: 8700, youth: 3300, women: 4700 },
  { year: "2025", members: 8910, youth: 3370, women: 4810 },
];

const complianceRadial = [{ name: "Compliance", value: 96.4, fill: accentColor }];

const databaseStatus = [
  { name: "Membership", records: 8910, status: "Current", icon: Users, color: "text-foreground" },
  { name: "Savings", records: 6400, status: "Current", icon: Wallet, color: "text-foreground" },
  {
    name: "Fixed Deposits",
    records: 3200,
    status: "Current",
    icon: TrendingUp,
    color: "text-foreground",
  },
  { name: "Loans", records: 4800, status: "Current", icon: BarChart3, color: "text-foreground" },
  {
    name: "Multi-purpose",
    records: 1500,
    status: "Pending",
    icon: Database,
    color: "text-foreground",
  },
];

export function CooperativeDashboard({
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
  const [showFinancialUpload, setShowFinancialUpload] = useState(false);
  const [extractedFinancialData, setExtractedFinancialData] = useState<BalanceSheet | null>(null);

  const profile = {
    name: "Lubombo Dairy Cooperative",
    regNo: "COP-2015-00214",
    region: "Lubombo",
    sector: "Agricultural Unions",
  };

  return (
    <AppShell
      title="Cooperative Workspace"
      subtitle={`${profile.name} · Upload data, track submissions, view analytics`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/app/analytics"
            className="press-feedback hidden items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors sm:inline-flex"
          >
            <BarChart3 className="size-4 text-accent" />
            View all statistics
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Compliance Score"
            value="96.4%"
            subtitle="In good standing"
            icon={ShieldCheck}
            tone="success"
          />
          <StatCard
            label="Members"
            value="8,910"
            subtitle="54% women · 38% youth"
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="Total Capital"
            value="$6.4M"
            subtitle="Savings + deposits"
            icon={Wallet}
            tone="accent"
          />
          <StatCard
            label="Returns Filed"
            value="4"
            subtitle="All approved"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        {/* ── Upload Section ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Financial Statement Upload */}
          <Card
            title="Financial Statement"
            subtitle="Upload PDF or image — we extract the data"
            action={
              showFinancialUpload ? undefined : (
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Upload className="size-4" /> Upload Statement
                </button>
              )
            }
          >
            {showFinancialUpload ? (
              <FinancialStatementUpload
                onDataExtracted={(data) => {
                  setExtractedFinancialData(data);
                  toast.success("Financial data extracted! Review your analytics below.");
                }}
                onClose={() => setShowFinancialUpload(false)}
              />
            ) : extractedFinancialData ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
                <CheckCircle2 className="size-5 text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Financial statement processed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Data extracted and applied. Charts below reflect your latest figures.
                  </p>
                </div>
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Upload className="size-3.5" /> Upload New
                </button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="size-14 rounded-2xl bg-accent/10 grid place-items-center mx-auto mb-4">
                  <FileSpreadsheet className="size-7 text-accent" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Upload your financial statement
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Upload a PDF or image of your audited balance sheet. We'll extract all account
                  codes and figures automatically — no manual entry needed.
                </p>
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Upload className="size-4" /> Upload Statement
                </button>
              </div>
            )}
          </Card>

          {/* Excel Database Upload */}
          <Card
            title="Database Excel Sheets"
            subtitle="Upload Excel files for each database — we validate automatically"
          >
            <ExcelDatabaseUpload
              onUploadComplete={(dbType, result) => {
                toast.success(`${dbType} database: ${result.validRows} records validated`);
              }}
            />
          </Card>
        </div>

        {/* ── Database Status Grid ── */}
        <Card title="Database Status" subtitle="Current state of your 5 cooperative databases">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {databaseStatus.map((db) => (
              <div
                key={db.name}
                className="rounded-xl border border-border bg-surface p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <db.icon className={`size-4 ${db.color}`} />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      db.status === "Current"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning-foreground"
                    }`}
                  >
                    {db.status}
                  </span>
                </div>
                <p className="font-heading text-lg font-bold text-foreground num">
                  {db.records.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{db.name} records</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Charts Row 1: Savings/Loans/Deposits Stacked Bar + Membership Trend ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Savings, Loans & Deposits"
            subtitle="Monthly trend — stacked view"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlySavings}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                    formatter={(value: number) => [`$${value}K`]}
                  />
                  <Bar
                    dataKey="savings"
                    stackId="a"
                    fill={accentColor}
                    fillOpacity={1}
                    radius={[0, 0, 0, 0]}
                    name="Savings"
                  />
                  <Bar
                    dataKey="loans"
                    stackId="a"
                    fill={accentColor}
                    fillOpacity={0.6}
                    radius={[0, 0, 0, 0]}
                    name="Loans"
                  />
                  <Bar
                    dataKey="deposits"
                    stackId="a"
                    fill={accentColor}
                    fillOpacity={0.35}
                    radius={[4, 4, 0, 0]}
                    name="Deposits"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Loan Portfolio Quality" subtitle="Risk distribution">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loanPortfolio}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {loanPortfolio.map((_, i) => (
                      <Cell key={i} fill={accentColor} fillOpacity={accentOpacities[i] ?? 0.2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 border-t border-border pt-3 mt-1">
              {loanPortfolio.map((item, i) => (
                <li key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2.5 rounded-sm shrink-0"
                      style={{ background: accentColor, opacity: accentOpacities[i] ?? 0.2 }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold num text-foreground">{item.value}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* ── Charts Row 2: Membership Horizontal Bar + Sector Pie + Compliance Radial ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card title="Membership Growth" subtitle="5-year trend with demographics">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={membershipTrend}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="year"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="women"
                    fill={accentColor}
                    fillOpacity={0.5}
                    radius={[0, 4, 4, 0]}
                    name="Women"
                    barSize={14}
                  />
                  <Bar
                    dataKey="youth"
                    fill={accentColor}
                    fillOpacity={0.3}
                    radius={[0, 4, 4, 0]}
                    name="Youth"
                    barSize={14}
                  />
                  <Bar
                    dataKey="members"
                    fill={accentColor}
                    fillOpacity={1}
                    radius={[0, 4, 4, 0]}
                    name="Total"
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Sector Distribution" subtitle="Portfolio allocation by sector">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorBreakdown} dataKey="value" nameKey="name" outerRadius={80}>
                    {sectorBreakdown.map((_, i) => (
                      <Cell
                        key={i}
                        fill={sectorBreakdown[i].fill}
                        fillOpacity={sectorOpacities[i]}
                      />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Compliance Score" subtitle="Current rating">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  data={complianceRadial}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    fill={accentColor}
                    background={{ fill: "var(--muted)" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-4">
              <p className="font-heading text-4xl font-bold text-foreground num">96.4%</p>
              <p className="text-xs text-muted-foreground mt-1">Compliance score</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <ArrowUpRight className="size-3.5 text-success" />
                <span className="text-xs font-semibold text-success">+2.1 pts</span>
                <span className="text-xs text-muted-foreground">vs last quarter</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Statistics Grid Cards ── */}
        <Card
          title="Key Financial Metrics"
          subtitle="Extracted from your latest financial statement"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Assets", value: "$6.4M", change: "+8.2%", up: true },
              { label: "Total Savings", value: "$4.2M", change: "+5.1%", up: true },
              { label: "Loan Portfolio", value: "$3.5M", change: "+3.7%", up: true },
              { label: "Net Surplus", value: "$420K", change: "+12.4%", up: true },
              { label: "NPL Ratio", value: "1.2%", change: "-0.3%", up: false },
              { label: "Capital Ratio", value: "14.8%", change: "+1.1%", up: true },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-border bg-surface p-4 hover:shadow-sm transition-shadow"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {metric.label}
                </p>
                <p className="font-heading text-xl font-bold text-foreground num">{metric.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  {metric.up ? (
                    <ArrowUpRight className="size-3 text-success" />
                  ) : (
                    <ArrowDownRight className="size-3 text-success" />
                  )}
                  <span
                    className={`text-xs font-semibold ${metric.up ? "text-success" : "text-success"}`}
                  >
                    {metric.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Submission History ── */}
        <Card title="Submission History" subtitle="Track review cycle statuses on your filings">
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Filed On</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions
                  .filter((s) => s.coopName === profile.name)
                  .slice(0, 5)
                  .map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/25 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {sub.reference}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-foreground">{sub.type}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {sub.submittedOn}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            sub.status === "Verified"
                              ? "bg-success/10 text-success"
                              : sub.status === "Pending Review"
                                ? "bg-warning/10 text-warning-foreground"
                                : sub.status === "Rejected"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-info/10 text-info"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
