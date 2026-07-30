import React, { useState } from "react";
import {
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  MapPin,
  Briefcase,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Percent,
  AlertCircle,
  Building2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useQuestionnaireAnalytics } from "@/hooks/submissions/useQuestionnaire";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { Link } from "@tanstack/react-router";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const REGION_OPTIONS = [
  { value: "all", label: "All Regions" },
  { value: "Manzini", label: "Manzini" },
  { value: "Hhohho", label: "Hhohho" },
  { value: "Shiselweni", label: "Shiselweni" },
  { value: "Lubombo", label: "Lubombo" },
];

const SECTOR_OPTIONS = [
  { value: "all", label: "All Sectors" },
  { value: "Agriculture", label: "Agriculture" },
  { value: "Finance", label: "Finance" },
  { value: "Housing", label: "Housing" },
  { value: "Transport", label: "Transport" },
  { value: "Manufacturing", label: "Manufacturing" },
];

const YEAR_OPTIONS = [
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
];

export const QuestionnaireAnalyticsPage: React.FC = () => {
  const [reportingYear, setReportingYear] = useState("2026");
  const [region, setRegion] = useState("all");
  const [sector, setSector] = useState("all");
  const [cooperativeId, setCooperativeId] = useState("all");

  const { data: cooperatives = [] } = useCooperatives();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuestionnaireAnalytics({
    reporting_year: reportingYear,
    region,
    sector,
    cooperative_id: cooperativeId,
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-SZ", {
      style: "currency",
      currency: "SZL",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat().format(val);
  };

  // Helper to calculate percentages
  const malePercentage =
    stats && stats.total_registered_members > 0
      ? Math.round((stats.total_members_male / stats.total_registered_members) * 100)
      : 0;

  const femalePercentage =
    stats && stats.total_registered_members > 0
      ? Math.round((stats.total_members_female / stats.total_registered_members) * 100)
      : 0;

  const activePercentage =
    stats && stats.total_registered_members > 0
      ? Math.round((stats.total_active_members / stats.total_registered_members) * 100)
      : 0;

  const regionChartData =
    stats && stats.region_counts
      ? Object.entries(stats.region_counts).map(([name, count]) => ({
          name,
          value: count,
        }))
      : [];

  const sectorChartData =
    stats && stats.sector_counts
      ? Object.entries(stats.sector_counts).map(([name, count]) => ({
          name,
          value: count,
        }))
      : [];

  const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#ef4444"];

  return (
    <AppShell
      title="Basic Tier Analytics"
      subtitle="Consolidated supervisory insights for primary cooperatives reporting via dynamic questionnaires."
    >
      <div className="flex flex-col gap-6">
        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="size-3" /> Reporting Year
            </label>
            <select
              value={reportingYear}
              onChange={(e) => setReportingYear(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <MapPin className="size-3" /> Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {REGION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Briefcase className="size-3" /> Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SECTOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Building2 className="size-3" /> Cooperative
            </label>
            <select
              value={cooperativeId}
              onChange={(e) => setCooperativeId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Cooperatives</option>
              {cooperatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <Layers className="size-6 animate-spin mr-2" /> Loading consolidated statistics...
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="size-5" />
            Failed to load analytics: {String(error)}
          </div>
        ) : !stats ? (
          <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-card">
            No dynamic questionnaire response details found for the selected filter criteria.
          </div>
        ) : (
          <>
            {/* Scope Summary Banner */}
            <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <AlertCircle className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>
                  <strong>Data Scope Information:</strong> Consolidated statistics derived from{" "}
                  <strong>
                    {stats.total_reporting_cooperatives} dynamic questionnaire submission(s)
                  </strong>{" "}
                  out of <strong>{cooperatives.length} total registered cooperative(s)</strong> for
                  reporting year <strong>{reportingYear}</strong>.
                </span>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Reporting Rate */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                  <BarChart3 className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Reporting Cooperatives
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {stats.total_reporting_cooperatives} / {cooperatives.length}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  {cooperatives.length > 0
                    ? `${Math.round((stats.total_reporting_cooperatives / cooperatives.length) * 100)}% submission rate`
                    : "0% submission rate"}
                </span>
              </div>

              {/* Card 2: Consolidated Membership */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <Users className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Consolidated Membership
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {formatNumber(stats.total_registered_members)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {activePercentage}% Active Members ({formatNumber(stats.total_active_members)})
                </span>
              </div>

              {/* Card 3: Total Share Capital */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                  <DollarSign className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Share Capital
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(stats.total_share_capital)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Combined equity investments
                </span>
              </div>

              {/* Card 4: Total Savings Value */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                  <DollarSign className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Savings Value
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(stats.total_savings_value)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Consolidated member savings balance
                </span>
              </div>

              {/* Card 5: Outstanding Loans */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-rose-500/10 text-rose-600 rounded-xl">
                  <TrendingDown className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Outstanding Loans
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(stats.total_loans_outstanding)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Consolidated loan book balance
                </span>
              </div>

              {/* Card 6: Net Surplus / Income */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-violet-500/10 text-violet-600 rounded-xl">
                  <TrendingUp className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Net Surplus / Income
                </span>
                <span
                  className={`text-2xl font-bold mt-1 ${stats.total_net_income >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {formatCurrency(stats.total_net_income)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Consolidated operating surplus
                </span>
              </div>
            </div>

            {/* Demographics and Financial Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Demographics Card */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Member Demographics
                </h3>

                {/* Gender split visual */}
                <div className="flex flex-col gap-2 border-b border-border/60 pb-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-blue-600 dark:text-blue-400">
                      Male: {formatNumber(stats.total_members_male)} ({malePercentage}%)
                    </span>
                    <span className="text-pink-600 dark:text-pink-400">
                      Female: {formatNumber(stats.total_members_female)} ({femalePercentage}%)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-pink-100 dark:bg-pink-900/30 overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${malePercentage}%` }} />
                  </div>
                </div>

                {/* Age distribution */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Age Group Distribution
                  </h4>

                  {[
                    {
                      label: "Youth (18 - 25)",
                      value: stats.members_by_age.age_18_25,
                      color: "bg-emerald-500",
                    },
                    {
                      label: "Young Adults (26 - 35)",
                      value: stats.members_by_age.age_26_35,
                      color: "bg-blue-500",
                    },
                    {
                      label: "Adults (36 - 60)",
                      value: stats.members_by_age.age_36_60,
                      color: "bg-indigo-500",
                    },
                    {
                      label: "Seniors (61+)",
                      value: stats.members_by_age.age_61plus,
                      color: "bg-amber-500",
                    },
                  ].map((group) => {
                    const totalAgeMembers =
                      stats.members_by_age.age_18_25 +
                      stats.members_by_age.age_26_35 +
                      stats.members_by_age.age_36_60 +
                      stats.members_by_age.age_61plus;
                    const pct =
                      totalAgeMembers > 0 ? Math.round((group.value / totalAgeMembers) * 100) : 0;
                    return (
                      <div key={group.label} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground font-medium">{group.label}</span>
                          <span className="text-muted-foreground font-bold">
                            {formatNumber(group.value)} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${group.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Balances Card */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" /> Financial Balances
                </h3>

                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Outstanding Loans
                    </span>
                    <span className="text-xl font-bold text-foreground mt-1">
                      {formatCurrency(stats.total_loans_outstanding)}
                    </span>
                  </div>

                  <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Member Savings Value
                    </span>
                    <span className="text-xl font-bold text-foreground mt-1">
                      {formatCurrency(stats.total_savings_value)}
                    </span>
                  </div>

                  <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Borrowed Funds
                    </span>
                    <span className="text-xl font-bold text-foreground mt-1">
                      {formatCurrency(stats.total_borrowed_funds)}
                    </span>
                  </div>

                  <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Operations Income
                    </span>
                    <span className="text-xl font-bold text-foreground mt-1">
                      {formatCurrency(stats.total_income)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border pt-3">
                  <span className="text-muted-foreground">Operating Expenses:</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(stats.total_expenditure)}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Analytics Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Region Pie Chart */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> Geographic Distribution (Regions)
                </h3>
                {regionChartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={regionChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {regionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                    No regional data available
                  </div>
                )}
              </div>

              {/* Sector Bar Chart */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Briefcase className="size-4 text-primary" /> Sectoral Distribution
                </h3>
                {sectorChartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="rgba(229, 231, 235, 0.3)"
                        />
                        <RechartsXAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <RechartsYAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          allowDecimals={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                          cursor={{ fill: "transparent" }}
                        />
                        <Bar
                          dataKey="value"
                          name="Cooperatives"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        >
                          {sectorChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[(index + 2) % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                    No sectoral data available
                  </div>
                )}
              </div>
            </div>

            {/* Reporting Cooperatives Detail List */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground">Reporting Cooperatives Details</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/85 text-muted-foreground uppercase font-bold tracking-wider">
                      <th className="px-5 py-3">Cooperative</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Region</th>
                      <th className="px-5 py-3 text-right">Total Members</th>
                      <th className="px-5 py-3 text-right">Share Capital</th>
                      <th className="px-5 py-3 text-right">Net Surplus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stats.details.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-foreground">
                          {row.cooperative_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full font-bold border ${
                              row.questionnaire_type === "financial"
                                ? "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400"
                                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {row.questionnaire_type === "financial" ? "Financial" : "Non-Financial"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{row.region}</td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          {formatNumber(row.total_members)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold">
                          {formatCurrency(row.total_share_capital)}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-mono font-semibold ${row.net_income >= 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {formatCurrency(row.net_income)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};
export default QuestionnaireAnalyticsPage;
