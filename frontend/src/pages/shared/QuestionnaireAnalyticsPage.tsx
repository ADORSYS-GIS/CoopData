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
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useQuestionnaireAnalytics } from "@/hooks/submissions/useQuestionnaire";
import { Link } from "@tanstack/react-router";

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
];

export const QuestionnaireAnalyticsPage: React.FC = () => {
  const [reportingYear, setReportingYear] = useState("2026");
  const [region, setRegion] = useState("all");
  const [sector, setSector] = useState("all");

  const { data: stats, isLoading, error } = useQuestionnaireAnalytics({
    reporting_year: reportingYear,
    region,
    sector,
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
  const malePercentage = stats && stats.total_registered_members > 0
    ? Math.round((stats.total_members_male / stats.total_registered_members) * 100)
    : 0;

  const femalePercentage = stats && stats.total_registered_members > 0
    ? Math.round((stats.total_members_female / stats.total_registered_members) * 100)
    : 0;

  const activePercentage = stats && stats.total_registered_members > 0
    ? Math.round((stats.total_active_members / stats.total_registered_members) * 100)
    : 0;

  return (
    <AppShell
      title="Basic Tier Analytics"
      subtitle="Consolidated supervisory insights for primary cooperatives reporting via dynamic questionnaires."
    >
      <div className="flex flex-col gap-6">

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
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
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                  <BarChart3 className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Reporting Cooperatives
                </span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {stats.total_reporting_cooperatives}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  With approved or submitted questionnaires
                </span>
              </div>

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

              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <div className="absolute right-3 top-3 p-2 bg-violet-500/10 text-violet-600 rounded-xl">
                  <TrendingUp className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Net Surplus / Income
                </span>
                <span className={`text-2xl font-bold mt-1 ${stats.total_net_income >= 0 ? "text-emerald-600" : "text-destructive"}`}>
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
                    <span className="text-blue-600 dark:text-blue-400">Male: {formatNumber(stats.total_members_male)} ({malePercentage}%)</span>
                    <span className="text-pink-600 dark:text-pink-400">Female: {formatNumber(stats.total_members_female)} ({femalePercentage}%)</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-pink-100 dark:bg-pink-900/30 overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${malePercentage}%` }} />
                  </div>
                </div>

                {/* Age distribution */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Age Group Distribution</h4>
                  
                  {[
                    { label: "Youth (18 - 25)", value: stats.members_by_age.age_18_25, color: "bg-emerald-500" },
                    { label: "Young Adults (26 - 35)", value: stats.members_by_age.age_26_35, color: "bg-blue-500" },
                    { label: "Adults (36 - 60)", value: stats.members_by_age.age_36_60, color: "bg-indigo-500" },
                    { label: "Seniors (61+)", value: stats.members_by_age.age_61plus, color: "bg-amber-500" },
                  ].map((group) => {
                    const totalAgeMembers =
                      stats.members_by_age.age_18_25 +
                      stats.members_by_age.age_26_35 +
                      stats.members_by_age.age_36_60 +
                      stats.members_by_age.age_61plus;
                    const pct = totalAgeMembers > 0 ? Math.round((group.value / totalAgeMembers) * 100) : 0;
                    return (
                      <div key={group.label} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground font-medium">{group.label}</span>
                          <span className="text-muted-foreground font-bold">{formatNumber(group.value)} ({pct}%)</span>
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
                  <span className="font-semibold text-foreground">{formatCurrency(stats.total_expenditure)}</span>
                </div>
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
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold border ${
                            row.questionnaire_type === "financial"
                              ? "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400"
                              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {row.questionnaire_type === "financial" ? "Financial" : "Non-Financial"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {row.region}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          {formatNumber(row.total_members)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold">
                          {formatCurrency(row.total_share_capital)}
                        </td>
                        <td className={`px-5 py-3.5 text-right font-mono font-semibold ${row.net_income >= 0 ? "text-emerald-600" : "text-destructive"}`}>
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
