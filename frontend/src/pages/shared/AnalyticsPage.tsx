import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { DateRangePicker, type DateRange } from "@/components/analytics/date-range-picker";
import { NonFinancialConsolidation } from "@/components/analytics/non-financial-consolidation";
import { BenchmarkInsightPanel } from "@/components/analytics/BenchmarkInsightPanel";
import { useBenchmarks } from "@/hooks/analytics/useBenchmarks";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import type { BenchmarkResponse } from "@/hooks/analytics/useBenchmarks";
import { formatNumber, REGIONS, SECTOR_BREAKDOWN } from "@/lib/mock-data";
import { type Role, useUserRole } from "@/lib/auth";
import { useLatestSubmission } from "@/hooks/submissions/useLatestSubmission";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import {
  useCooperativeSubmissions,
  useCooperativeStats,
  useFederationSubmissions,
  useApexSubmissions,
  useApexStats,
} from "@/hooks/submissions/useSubmissions";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import { useFederationStats } from "@/hooks/analytics/useFederationStats";
import { useRegionCompliance } from "@/hooks/analytics/useRegionCompliance";
import { useSectorBreakdown } from "@/hooks/analytics/useSectorBreakdown";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useFederations } from "@/hooks/federations/useFederations";
import { useApexes } from "@/hooks/apexes/useApexes";
import { useCooperatives, useMyCooperativeProfile } from "@/hooks/cooperatives/useCooperatives";
import {
  TrendingUp,
  TrendingDown,
  Users,
  PieChart as PieChartIcon,
  BarChart3,
  SlidersHorizontal,
  Award,
  Filter,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Wallet,
  Building2,
  Landmark,
  Activity,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { format, isAfter, isBefore, parseISO, startOfMonth, endOfMonth } from "date-fns";

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// Monochromatic accent palette for sector distributions
const sectorOpacities = [1, 0.78, 0.58, 0.42, 0.28];

// ─────────────────────────────────────────────────────────────────────
// Cooperative chart data — empty until useMonthlyTrend (Sprint 5)
// ─────────────────────────────────────────────────────────────────────
// NOTE: These charts require a time-series backend endpoint not yet built.
// They will be replaced by real data in Sprint 5 via useMonthlyTrend.
const coopComplianceTrend: { month: string; score: number }[] = [];
const coopMembershipHistory: { year: string; members: number; youth: number; women: number }[] = [];
const coopMonthlyTrend: { month: string; members: number; savings: number }[] = [];
const coopPerformanceMetrics: {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  desc: string;
}[] = [];

// ─────────────────────────────────────────────────────────────────────
// Base mock data (will be filtered/adjusted reactively)
// ─────────────────────────────────────────────────────────────────────

const PERFORMERS = [
  { n: "Sunrise Savings SACCO", s: 98, p: "Finance" },
  { n: "Lakeside Agricultural Union", s: 95, p: "Agriculture" },
  { n: "National Teachers SACCO", s: 94, p: "Finance" },
  { n: "Unity Housing Federation", s: 92, p: "Housing" },
  { n: "Lubombo Dairy Co-op", s: 90, p: "Agriculture" },
  { n: "Highveld Women's Trust", s: 88, p: "Finance" },
  { n: "Eastern Grain Collective", s: 84, p: "Agriculture" },
  { n: "Shiselweni Coffee Growers", s: 78, p: "Agriculture" },
];

const baseMonthlyFinancials = [
  {
    month: "Jan 2025",
    monthShort: "Jan",
    savings: 980,
    loans: 612,
    deposits: 340,
    date: "2025-01-15",
  },
  {
    month: "Feb 2025",
    monthShort: "Feb",
    savings: 998,
    loans: 631,
    deposits: 355,
    date: "2025-02-15",
  },
  {
    month: "Mar 2025",
    monthShort: "Mar",
    savings: 1020,
    loans: 655,
    deposits: 372,
    date: "2025-03-15",
  },
  {
    month: "Apr 2025",
    monthShort: "Apr",
    savings: 1041,
    loans: 678,
    deposits: 390,
    date: "2025-04-15",
  },
  {
    month: "May 2025",
    monthShort: "May",
    savings: 1078,
    loans: 702,
    deposits: 412,
    date: "2025-05-15",
  },
  {
    month: "Jun 2025",
    monthShort: "Jun",
    savings: 1102,
    loans: 731,
    deposits: 438,
    date: "2025-06-15",
  },
  {
    month: "Jul 2025",
    monthShort: "Jul",
    savings: 1130,
    loans: 758,
    deposits: 460,
    date: "2025-07-15",
  },
  {
    month: "Aug 2025",
    monthShort: "Aug",
    savings: 1158,
    loans: 781,
    deposits: 482,
    date: "2025-08-15",
  },
  {
    month: "Sep 2025",
    monthShort: "Sep",
    savings: 1182,
    loans: 802,
    deposits: 501,
    date: "2025-09-15",
  },
  {
    month: "Oct 2025",
    monthShort: "Oct",
    savings: 1198,
    loans: 821,
    deposits: 520,
    date: "2025-10-15",
  },
  {
    month: "Nov 2025",
    monthShort: "Nov",
    savings: 1204,
    loans: 835,
    deposits: 538,
    date: "2025-11-15",
  },
  {
    month: "Dec 2025",
    monthShort: "Dec",
    savings: 1204,
    loans: 842,
    deposits: 555,
    date: "2025-12-15",
  },
];

const baseLoanPortfolio = [
  { name: "Performing", value: 82, fill: "var(--chart-1)" },
  { name: "Watch List", value: 9, fill: "var(--chart-3)" },
  { name: "Substandard", value: 5, fill: "var(--chart-5)" },
  { name: "Doubtful", value: 3, fill: "var(--chart-2)" },
  { name: "Loss", value: 1, fill: "var(--chart-4)" },
];

const baseMembershipGrowth = [
  { year: "2021", members: 1820000, youth: 612000, women: 980000 },
  { year: "2022", members: 1980000, youth: 680000, women: 1070000 },
  { year: "2023", members: 2145000, youth: 748000, women: 1158000 },
  { year: "2024", members: 2284000, youth: 812000, women: 1234000 },
  { year: "2025", members: 2412300, youth: 912000, women: 1303000 },
];

const baseRegionCompliance = [
  { name: "Hhohho", score: 94.1, coops: 3120 },
  { name: "Manzini", score: 91.3, coops: 4480 },
  { name: "Lubombo", score: 93.2, coops: 3138 },
  { name: "Shiselweni", score: 88.7, coops: 2104 },
];

const baseSubmissionTrend = [
  { month: "Jan", monthDate: "2025-01-01", onTime: 92, late: 8 },
  { month: "Feb", monthDate: "2025-02-01", onTime: 89, late: 11 },
  { month: "Mar", monthDate: "2025-03-01", onTime: 94, late: 6 },
  { month: "Apr", monthDate: "2025-04-01", onTime: 91, late: 9 },
  { month: "May", monthDate: "2025-05-01", onTime: 96, late: 4 },
  { month: "Jun", monthDate: "2025-06-01", onTime: 93, late: 7 },
  { month: "Jul", monthDate: "2025-07-01", onTime: 95, late: 5 },
  { month: "Aug", monthDate: "2025-08-01", onTime: 97, late: 3 },
  { month: "Sep", monthDate: "2025-09-01", onTime: 94, late: 6 },
  { month: "Oct", monthDate: "2025-10-01", onTime: 96, late: 4 },
  { month: "Nov", monthDate: "2025-11-01", onTime: 95, late: 5 },
  { month: "Dec", monthDate: "2025-12-01", onTime: 97, late: 3 },
];

// Multi-region member trend — 12 months
const baseRegionTrendData = [
  { month: "Jan", Hhohho: 2800, Manzini: 5800, Lubombo: 1500, Shiselweni: 3200 },
  { month: "Feb", Hhohho: 4900, Manzini: 3100, Lubombo: 4200, Shiselweni: 1200 },
  { month: "Mar", Hhohho: 2200, Manzini: 6500, Lubombo: 2100, Shiselweni: 4500 },
  { month: "Apr", Hhohho: 5800, Manzini: 2800, Lubombo: 5000, Shiselweni: 1800 },
  { month: "May", Hhohho: 1900, Manzini: 7000, Lubombo: 1700, Shiselweni: 5200 },
  { month: "Jun", Hhohho: 6200, Manzini: 3500, Lubombo: 5800, Shiselweni: 900 },
  { month: "Jul", Hhohho: 3000, Manzini: 5200, Lubombo: 2800, Shiselweni: 4000 },
  { month: "Aug", Hhohho: 5500, Manzini: 1800, Lubombo: 6200, Shiselweni: 2200 },
  { month: "Sep", Hhohho: 1500, Manzini: 6800, Lubombo: 1200, Shiselweni: 5500 },
  { month: "Oct", Hhohho: 7000, Manzini: 4000, Lubombo: 4500, Shiselweni: 1400 },
  { month: "Nov", Hhohho: 2500, Manzini: 5600, Lubombo: 3000, Shiselweni: 6000 },
  { month: "Dec", Hhohho: 6000, Manzini: 2200, Lubombo: 6800, Shiselweni: 1000 },
];

// ─────────────────────────────────────────────────────────────────────
// Entity-specific multipliers for filter reactivity
// ─────────────────────────────────────────────────────────────────────

const entityMultiplier: Record<string, number> = {
  all: 1.0,
  // Federations
  fed_1: 0.35, // Manzini Regional Federation
  fed_2: 0.28, // Hhohho Regional Federation
  fed_3: 0.22, // Shiselweni Regional Federation
  fed_4: 0.15, // Lubombo Regional Federation
  // Apexes
  a1: 0.18, // Manzini Apex
  a2: 0.15, // Hhohho Apex
  a3: 0.12, // Shiselweni Apex
  a4: 0.1, // Lubombo Apex
  a5: 0.14, // Northern Apex
  a6: 0.16, // Central Apex
  a7: 0.15, // Eastern Apex
  // Cooperatives
  coop_1: 0.35,
  coop_2: 0.28,
  coop_3: 0.22,
  coop_4: 0.15,
  coop_5: 0.08,
  coop_6: 0.04,
  coop_7: 0.06,
  coop_8: 0.03,
  coop_9: 0.07,
  coop_10: 0.1,
};

const regionMultiplier: Record<string, number> = {
  all: 1.0,
  Manzini: 0.37,
  Hhohho: 0.25,
  Shiselweni: 0.17,
  Lubombo: 0.21,
};

const sectorMultiplier: Record<string, number> = {
  all: 1.0,
  Agriculture: 0.42,
  Finance: 0.31,
  Housing: 0.11,
  Transport: 0.09,
  Manufacturing: 0.07,
};

// ─────────────────────────────────────────────────────────────────────
// Role-aware KPI metrics
// ─────────────────────────────────────────────────────────────────────

const kpiMetricsByRole: Record<
  Role,
  { label: string; value: string; change: string; up: boolean; icon: typeof TrendingUp }[]
> = {
  ministry: [
    { label: "Total Cooperatives", value: "—", change: "—", up: true, icon: Building2 },
    { label: "Total Submissions", value: "—", change: "—", up: true, icon: BarChart3 },
    { label: "Pending Review", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Approved", value: "—", change: "—", up: true, icon: TrendingUp },
    { label: "Rejected", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Approval Rate", value: "—", change: "—", up: true, icon: Target },
  ],
  federation: [
    { label: "Total Apexes", value: "—", change: "—", up: true, icon: Building2 },
    { label: "Total Members", value: "—", change: "—", up: true, icon: Users },
    { label: "Submissions", value: "—", change: "—", up: true, icon: BarChart3 },
    { label: "Pending Review", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Approved", value: "—", change: "—", up: true, icon: TrendingUp },
    { label: "Rejected", value: "—", change: "—", up: false, icon: ShieldCheck },
  ],
  apex: [
    { label: "Cooperatives", value: "—", change: "—", up: true, icon: Building2 },
    { label: "Submissions", value: "—", change: "—", up: true, icon: BarChart3 },
    { label: "Pending Review", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Approved", value: "—", change: "—", up: true, icon: TrendingUp },
    { label: "Rejected", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Approval Rate", value: "—", change: "—", up: true, icon: Target },
  ],
  cooperative: [
    { label: "Total Assets", value: "—", change: "—", up: true, icon: Wallet },
    { label: "Gross Loans", value: "—", change: "—", up: true, icon: TrendingUp },
    { label: "Member Deposits", value: "—", change: "—", up: true, icon: BarChart3 },
    { label: "Net Surplus", value: "—", change: "—", up: true, icon: Activity },
    { label: "NPL Ratio", value: "—", change: "—", up: false, icon: ShieldCheck },
    { label: "Capital Ratio", value: "—", change: "—", up: true, icon: Target },
  ],
};

const titleByRole: Record<Role, string> = {
  ministry: "National Analytics",
  federation: "Federation Analytics",
  apex: "Apex Analytics",
  cooperative: "My Analytics",
};

const subtitleByRole: Record<Role, string> = {
  ministry: "Drill-down national, regional, and sector intelligence with live data sourcing",
  federation: "Analyze performance across apexes and cooperatives under your federation",
  apex: "Analyze performance across cooperatives under your apex organization",
  cooperative: "View your cooperative's performance trends and key metrics",
};

const roleBadge: Record<Role, { label: string; color: string }> = {
  ministry: { label: "Ministry View", color: "bg-primary/10 text-primary" },
  federation: { label: "Federation View", color: "bg-info/10 text-info" },
  apex: { label: "Apex View", color: "bg-accent/10 text-accent" },
  cooperative: { label: "Cooperative View", color: "bg-success/10 text-success" },
};

// Network summary data per role
const networkSummaryByRole: Record<Role, { label: string; value: string; sub: string }[]> = {
  ministry: [
    { label: "Federations", value: "—", sub: "Active national federations" },
    { label: "Cooperatives", value: "—", sub: "Registered cooperatives" },
    { label: "Total Submissions", value: "—", sub: "All time" },
    { label: "Pending Reviews", value: "—", sub: "Awaiting ministry approval" },
    { label: "Approved", value: "—", sub: "Ministry-approved returns" },
    { label: "Rejected", value: "—", sub: "Rejected returns" },
  ],
  federation: [
    { label: "Apexes", value: "—", sub: "Under this federation" },
    { label: "Cooperatives", value: "—", sub: "Total across all apexes" },
    { label: "Submissions", value: "—", sub: "All time" },
    { label: "Pending Reviews", value: "—", sub: "Awaiting federation review" },
    { label: "Approved", value: "—", sub: "Forwarded to ministry" },
    { label: "Rejected", value: "—", sub: "Returned or rejected" },
  ],
  apex: [
    { label: "Cooperatives", value: "—", sub: "Under this apex" },
    { label: "Submissions", value: "—", sub: "All time" },
    { label: "Pending Reviews", value: "—", sub: "Awaiting apex review" },
    { label: "Approved", value: "—", sub: "Forwarded to federation" },
    { label: "Rejected", value: "—", sub: "Returned or rejected" },
    { label: "Approval Rate", value: "—", sub: "Approved / total submissions" },
  ],
  cooperative: [
    { label: "Members", value: "—", sub: "Loading from database" },
    { label: "Total Assets", value: "—", sub: "Balance sheet value" },
    { label: "Reports Submitted", value: "—", sub: "YTD submissions" },
    { label: "Next Deadline", value: "—", sub: "Submission deadline" },
    { label: "Capital Adequacy", value: "—", sub: "Regulatory threshold: 10%" },
    { label: "NPL Ratio", value: "—", sub: "Non-performing loans" },
  ],
};

interface FilterConfig {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

function buildFiltersByRole(
  role: Role,
  federations: { id: string; name: string }[],
  apexes: { id: string; name: string }[],
  cooperatives: { id: string; name: string }[],
): FilterConfig[] {
  const federationOptions = [
    { value: "all", label: "All Federations" },
    ...federations.map((f) => ({ value: String(f.id), label: f.name })),
  ];
  const apexOptions = [
    { value: "all", label: "All Apexes" },
    ...apexes.map((a) => ({ value: String(a.id), label: a.name })),
  ];
  const coopOptions = [
    { value: "all", label: "All Cooperatives" },
    ...cooperatives.slice(0, 10).map((c) => ({ value: String(c.id), label: c.name })),
  ];
  const regionOptions = [
    { value: "all", label: "All Regions" },
    { value: "Manzini", label: "Manzini" },
    { value: "Hhohho", label: "Hhohho" },
    { value: "Shiselweni", label: "Shiselweni" },
    { value: "Lubombo", label: "Lubombo" },
  ];
  const sectorOptions = [
    { value: "all", label: "All Sectors" },
    { value: "Agriculture", label: "Agriculture" },
    { value: "Finance", label: "Finance" },
    { value: "Housing", label: "Housing" },
    { value: "Transport", label: "Transport" },
    { value: "Manufacturing", label: "Manufacturing" },
  ];

  if (role === "ministry") {
    return [
      { id: "federation", label: "Federation", options: federationOptions },
      { id: "apex", label: "Apex", options: apexOptions },
      { id: "cooperative", label: "Cooperative", options: coopOptions },
      { id: "region", label: "Region", options: regionOptions },
      { id: "sector", label: "Sector", options: sectorOptions },
    ];
  }
  if (role === "federation") {
    return [
      { id: "apex", label: "Apex", options: apexOptions },
      { id: "cooperative", label: "Cooperative", options: coopOptions },
      { id: "region", label: "Region", options: regionOptions },
      { id: "sector", label: "Sector", options: sectorOptions },
    ];
  }
  if (role === "apex") {
    return [
      { id: "cooperative", label: "Cooperative", options: coopOptions },
      { id: "region", label: "Region", options: regionOptions },
      { id: "sector", label: "Sector", options: sectorOptions },
    ];
  }
  return [
    {
      id: "period",
      label: "Period",
      options: [
        { value: "ytd", label: "Year to Date" },
        { value: "q1", label: "Q1 2025" },
        { value: "q2", label: "Q2 2025" },
        { value: "q3", label: "Q3 2025" },
        { value: "q4", label: "Q4 2025" },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────
// Helper: compute multiplier from active filters
// ─────────────────────────────────────────────────────────────────────

function getFilterMultiplier(filterValues: Record<string, string>): number {
  let mult = 1.0;
  for (const [key, value] of Object.entries(filterValues)) {
    if (value === "all" || value === "ytd") continue;
    // Prefix the value based on filter type to match entityMultiplier keys
    const prefixedKey =
      key === "federation"
        ? `fed_${value}`
        : key === "apex"
          ? value // apex IDs already have 'a' prefix
          : key === "cooperative"
            ? `coop_${value}`
            : value;
    const m =
      entityMultiplier[prefixedKey] ?? regionMultiplier[value] ?? sectorMultiplier[value] ?? 1.0;
    mult *= m;
  }
  return Math.max(mult, 0.02); // floor at 2% so charts aren't empty
}

function applyMultiplier<T extends Record<string, unknown>>(
  data: T[],
  numericKeys: (keyof T)[],
  multiplier: number,
): T[] {
  return data.map((item) => {
    const updated = { ...item };
    for (const key of numericKeys) {
      if (typeof updated[key] === "number") {
        (updated as Record<string, unknown>)[key as string] = Math.round(
          (updated[key] as number) * multiplier,
        );
      }
    }
    return updated;
  });
}

function filterByDateRange<T extends Record<string, unknown>>(
  data: T[],
  dateKey: string,
  dateRange: DateRange,
): T[] {
  return data.filter((item) => {
    const dateStr = item[dateKey];
    if (typeof dateStr !== "string") return true;
    try {
      const d = parseISO(dateStr);
      return !isBefore(d, startOfMonth(dateRange.from)) && !isAfter(d, endOfMonth(dateRange.to));
    } catch {
      return true;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// Analytics Page Component
// ─────────────────────────────────────────────────────────────────────
export const AnalyticsPage: React.FC = () => {
  const role = useUserRole();

  // ── Real data hooks (cooperative role) ──
  const latestSubmission = useLatestSubmission();
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(
    role === "cooperative" ? latestSubmission?.id : undefined,
  );

  // ── Benchmark data for cooperative insight panel ──
  // Fetch benchmarks for the KPIs that have sector thresholds defined.
  // These calls are only enabled when the user is cooperative role.
  const isCooperative = role === "cooperative";
  const currentYear = new Date().getFullYear();
  const benchmarkPar30 = useBenchmarks(
    { kpiName: "par30", reportingYear: currentYear },
    isCooperative,
  );
  const benchmarkRoa = useBenchmarks({ kpiName: "roa", reportingYear: currentYear }, isCooperative);
  const benchmarkCar = useBenchmarks(
    { kpiName: "capital_adequacy_ratio", reportingYear: currentYear },
    isCooperative,
  );
  const benchmarkLfr = useBenchmarks(
    { kpiName: "liquid_funds_ratio", reportingYear: currentYear },
    isCooperative,
  );
  const benchmarkOer = useBenchmarks(
    { kpiName: "operating_expense_ratio", reportingYear: currentYear },
    isCooperative,
  );
  const benchmarkOss = useBenchmarks(
    { kpiName: "operational_self_sufficiency", reportingYear: currentYear },
    isCooperative,
  );

  const benchmarksForPanel: BenchmarkResponse[] = [
    benchmarkPar30.data,
    benchmarkRoa.data,
    benchmarkCar.data,
    benchmarkLfr.data,
    benchmarkOer.data,
    benchmarkOss.data,
  ].filter((b): b is BenchmarkResponse => b !== undefined && b.sample_count > 0);

  const benchmarksLoading =
    benchmarkPar30.isLoading ||
    benchmarkRoa.isLoading ||
    benchmarkCar.isLoading ||
    benchmarkLfr.isLoading;
  const coopSubmissionsAll = useCooperativeSubmissions(role === "cooperative").data ?? [];
  const coopStats = useCooperativeStats(role === "cooperative").data;

  // ── Real data hooks (ministry/apex roles) ──
  const ministryStats = useMinistryStats(role === "ministry").data;
  const apexStats = useApexStats(role === "apex").data;
  const federationStats = useFederationStats(role === "federation").data;
  const federationSubmissions = useFederationSubmissions(role === "federation").data ?? [];
  const apexSubmissions = useApexSubmissions(role === "apex").data ?? [];

  // ── Analytics data hooks ──
  const regionComplianceData = useRegionCompliance(!!role).data;
  const sectorBreakdownData = useSectorBreakdown(!!role).data;

  // ── NF Statistics (real data from uploaded NF databases) ──
  const nfStats = useNfStatistics(!!role).data;

  // ── National Overview (aggregated KPI traffic-light for admin roles) ──
  const nationalOverview = useNationalOverview(
    role === "ministry" || role === "federation" || role === "apex",
  ).data;

  // ── Real data for filter dropdowns ──
  const { data: federationsData } = useFederations();
  const { data: apexesData } = useApexes();
  const { data: cooperativesData } = useCooperatives();
  const { data: myCoopProfile } = useMyCooperativeProfile();

  // ── Monthly trend data ──
  const monthlyTrendParams = useMemo(() => {
    if (role === "cooperative") {
      return { reportingYear: currentYear, cooperativeId: latestSubmission?.cooperative_id };
    }
    return { reportingYear: currentYear };
  }, [role, currentYear, latestSubmission?.cooperative_id]);
  const { data: monthlyTrendData } = useMonthlyTrend(monthlyTrendParams, !!role);

  // ── Dynamic "At a Glance" summaries keyed by role ──
  const ministerySummary: { label: string; value: string; sub: string }[] = [
    {
      label: "Cooperatives",
      value: ministryStats ? ministryStats.total_cooperatives.toLocaleString() : "—",
      sub: "Registered across all federations",
    },
    {
      label: "Total Submissions",
      value: ministryStats ? ministryStats.total_submissions.toLocaleString() : "—",
      sub: "All time",
    },
    {
      label: "Pending Review",
      value: ministryStats ? ministryStats.pending_review_count.toLocaleString() : "—",
      sub: "Awaiting ministry approval",
    },
    {
      label: "Approved",
      value: ministryStats ? ministryStats.approved_count.toLocaleString() : "—",
      sub: "Ministry-approved returns",
    },
    {
      label: "Rejected",
      value: ministryStats ? ministryStats.rejected_count.toLocaleString() : "—",
      sub: "Rejected returns",
    },
    {
      label: "Approval Rate",
      value:
        ministryStats && ministryStats.total_submissions > 0
          ? `${((ministryStats.approved_count / ministryStats.total_submissions) * 100).toFixed(0)}%`
          : "—",
      sub: "Approved / total submissions",
    },
  ];

  const federationPending = federationSubmissions.filter((s) =>
    ["submitted", "in_review"].includes(s.status),
  ).length;
  const federationApproved = federationSubmissions.filter((s) => s.status === "approved").length;
  const federationRejected = federationSubmissions.filter((s) =>
    ["rejected", "returned"].includes(s.status),
  ).length;

  const federationSummary: { label: string; value: string; sub: string }[] = [
    {
      label: "Submissions",
      value: federationStats
        ? federationStats.submission_count.toLocaleString()
        : federationSubmissions.length.toLocaleString(),
      sub: "All time",
    },
    {
      label: "Pending Reviews",
      value: federationStats
        ? federationStats.pending_review_count.toLocaleString()
        : federationPending.toLocaleString(),
      sub: "Awaiting federation review",
    },
    {
      label: "Approved",
      value: federationStats
        ? federationStats.approved_count.toLocaleString()
        : federationApproved.toLocaleString(),
      sub: "Forwarded to ministry",
    },
    {
      label: "Rejected",
      value: federationStats
        ? federationStats.rejected_count.toLocaleString()
        : federationRejected.toLocaleString(),
      sub: "Returned or rejected",
    },
    {
      label: "Cooperatives",
      value: federationStats ? federationStats.cooperative_count.toLocaleString() : "—",
      sub: "Total across all apexes",
    },
    { label: "Apexes", value: "—", sub: "Under this federation" },
  ];

  const apexPending = apexStats?.pending_submissions ?? 0;
  const apexApproved = apexStats?.approved_submissions ?? 0;
  const apexRejected = apexStats?.rejected_submissions ?? 0;
  const apexCoops = apexStats?.total_cooperatives ?? 0;

  const apexSummary: { label: string; value: string; sub: string }[] = [
    { label: "Cooperatives", value: apexCoops.toLocaleString(), sub: "Under this apex" },
    {
      label: "Submissions",
      value: apexSubmissions.length.toLocaleString(),
      sub: "All time",
    },
    {
      label: "Pending Reviews",
      value: apexPending.toLocaleString(),
      sub: "Awaiting apex review",
    },
    { label: "Approved", value: apexApproved.toLocaleString(), sub: "Forwarded to federation" },
    { label: "Rejected", value: apexRejected.toLocaleString(), sub: "Returned or rejected" },
    {
      label: "Approval Rate",
      value:
        apexSubmissions.length > 0
          ? `${((apexApproved / apexSubmissions.length) * 100).toFixed(0)}%`
          : "—",
      sub: "Approved / total submissions",
    },
  ];

  const coopNetworkSummary: { label: string; value: string; sub: string }[] =
    role === "cooperative"
      ? [
          {
            label: "Members",
            value: kpisData ? "See Database Status" : "—",
            sub: "From membership database",
          },
          {
            label: "Total Assets",
            value: kpisData?.kpis.find((k) => k.name === "total_assets")?.formatted ?? "—",
            sub: "Balance sheet value",
          },
          {
            label: "Reports Submitted",
            value: coopStats ? coopStats.total_submissions.toString() : "—",
            sub: "All submissions on record",
          },
          {
            label: "Approved",
            value: coopStats ? coopStats.approved_submissions.toString() : "—",
            sub: "Ministry-approved returns",
          },
          {
            label: "Capital Adequacy",
            value:
              kpisData?.kpis.find((k) => k.name === "capital_adequacy_ratio")?.formatted ?? "—",
            sub: "Regulatory threshold: 10%",
          },
          {
            label: "NPL Ratio",
            value: kpisData?.kpis.find((k) => k.name === "npl_ratio")?.formatted ?? "—",
            sub: "Non-performing loans",
          },
        ]
      : networkSummaryByRole[role ?? "ministry"];

  const filters = useMemo(() => {
    if (!role) return [];
    return buildFiltersByRole(
      role,
      federationsData ?? [],
      apexesData ?? [],
      cooperativesData ?? [],
    );
  }, [role, federationsData, apexesData, cooperativesData]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    Object.fromEntries(filters.map((f) => [f.id, f.options[0].value])),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState<"1D" | "5D" | "1M" | "1Y">("1Y");
  const [compPeriod, setCompPeriod] = useState<"Week" | "Month" | "Quarter" | "Year">("Year");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(2025, 0, 1),
    to: new Date(),
  });

  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v !== "all" && v !== "ytd",
  ).length;

  const handleFilterChange = useCallback((filterId: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues(Object.fromEntries(filters.map((f) => [f.id, f.options[0].value])));
  }, [filters]);

  // ── Reactive data ──
  const multiplier = useMemo(() => getFilterMultiplier(filterValues), [filterValues]);

  const localGrowthTrend = useMemo(() => {
    if (monthlyTrendData?.months) {
      return monthlyTrendData.months.map((m) => ({
        month: m.month_label,
        savings: Math.round(m.savings / 1000),
        loans: Math.round(m.loans / 1000),
        members: Math.round(m.deposits / 1000),
      }));
    }
    return [
      { month: "Jan", members: 0, savings: 0, loans: 0 },
      { month: "Feb", members: 0, savings: 0, loans: 0 },
      { month: "Mar", members: 0, savings: 0, loans: 0 },
      { month: "Apr", members: 0, savings: 0, loans: 0 },
      { month: "May", members: 0, savings: 0, loans: 0 },
      { month: "Jun", members: 0, savings: 0, loans: 0 },
      { month: "Jul", members: 0, savings: 0, loans: 0 },
      { month: "Aug", members: 0, savings: 0, loans: 0 },
      { month: "Sep", members: 0, savings: 0, loans: 0 },
      { month: "Oct", members: 0, savings: 0, loans: 0 },
      { month: "Nov", members: 0, savings: 0, loans: 0 },
      { month: "Dec", members: 0, savings: 0, loans: 0 },
    ];
  }, [monthlyTrendData]);

  const filteredGrowthTrend = useMemo(() => {
    const filtered = filterByDateRange(
      localGrowthTrend.map((d) => ({
        ...d,
        date: `2025-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(d.month) + 1}-15`,
      })),
      "date",
      dateRange,
    );
    return applyMultiplier(filtered, ["members", "savings", "loans"], multiplier);
  }, [dateRange, localGrowthTrend, multiplier]);

  // Period-sliced data for the Pro Line Chart
  const periodSlice = useMemo(() => {
    const all = filteredGrowthTrend;
    if (period === "1D") return all.slice(-1);
    if (period === "5D") return all.slice(-2);
    if (period === "1M") return all.slice(-3);
    return all; // 1Y
  }, [filteredGrowthTrend, period]);

  // Summary totals for the Pro Line Chart header
  const portfolioTotal = useMemo(() => {
    const last = periodSlice[periodSlice.length - 1];
    if (!last) return { savings: 0, loans: 0, members: 0 };
    return {
      savings: last.savings as number,
      loans: last.loans as number,
      members: last.members as number,
    };
  }, [periodSlice]);

  const filteredMonthlyFinancials = useMemo(() => {
    if (monthlyTrendData?.months) {
      const hasRealData = monthlyTrendData.months.some(
        (m) => m.savings > 0 || m.loans > 0 || m.deposits > 0,
      );
      if (hasRealData) {
        return monthlyTrendData.months.map((m) => ({
          month: m.month_label,
          monthShort: m.month_label,
          savings: Math.round(m.savings / 1000),
          loans: Math.round(m.loans / 1000),
          deposits: Math.round(m.deposits / 1000),
          variation: Math.round((m.savings / 1000) * 0.1),
          date: `${monthlyTrendData.year}-${String(m.month).padStart(2, "0")}-15`,
        }));
      }
    }
    return [] as typeof baseMonthlyFinancials;
  }, [monthlyTrendData]);

  const filteredSubmissionTrend = useMemo(() => {
    const filtered = filterByDateRange(baseSubmissionTrend, "monthDate", dateRange);
    return applyMultiplier(filtered, ["onTime", "late"], multiplier).map((item) => ({
      ...item,
      onTime: Math.min(item.onTime as number, 100),
      late: Math.min(item.late as number, 100),
    }));
  }, [dateRange, multiplier]);

  const filteredMembershipGrowth = useMemo(
    () => applyMultiplier(baseMembershipGrowth, ["members", "youth", "women"], multiplier),
    [multiplier],
  );

  const filteredRegionCompliance = useMemo(() => {
    if (regionComplianceData?.regions && regionComplianceData.regions.length > 0) {
      return regionComplianceData.regions;
    }
    return applyMultiplier(baseRegionCompliance, ["coops"], multiplier);
  }, [multiplier, regionComplianceData]);

  const filteredLoanPortfolio = useMemo(() => {
    // For cooperative role: derive from real NF loan statistics
    if (role === "cooperative" && nfStats) {
      const { loans } = nfStats;
      const total = loans.total_loans;
      if (total > 0) {
        return [
          {
            name: "Performing",
            value: Math.round((loans.performing / total) * 100),
            fill: "var(--chart-1)",
          },
          {
            name: "Watch List (Arrears)",
            value: Math.round((loans.arrears / total) * 100),
            fill: "var(--chart-3)",
          },
          {
            name: "Restructured",
            value: Math.round((loans.restructured / total) * 100),
            fill: "var(--chart-5)",
          },
          {
            name: "Written Off",
            value: Math.round((loans.written_off / total) * 100),
            fill: "var(--chart-4)",
          },
        ].filter((s) => s.value > 0);
      }
      return [];
    }
    // For higher roles: use mock until aggregation endpoint built
    if (multiplier >= 1.0) return baseLoanPortfolio;
    const adjustments: Record<string, number> = {
      Performing: multiplier < 0.3 ? -5 : multiplier < 0.6 ? -2 : 0,
      "Watch List": multiplier < 0.3 ? 3 : multiplier < 0.6 ? 1 : 0,
      Substandard: multiplier < 0.3 ? 1 : 0,
      Doubtful: multiplier < 0.3 ? 1 : 0,
      Loss: multiplier < 0.3 ? 0 : 0,
    };
    return baseLoanPortfolio.map((item) => ({
      ...item,
      value: Math.max(1, item.value + (adjustments[item.name] ?? 0)),
    }));
  }, [role, nfStats, multiplier]);

  const filteredSectorBreakdown = useMemo(() => {
    if (sectorBreakdownData?.sectors && sectorBreakdownData.sectors.length > 0) {
      return sectorBreakdownData.sectors;
    }
    if (multiplier >= 1.0) return SECTOR_BREAKDOWN;
    return SECTOR_BREAKDOWN.map((item) => ({
      ...item,
      value: Math.max(1, Math.round(item.value * (0.5 + multiplier * 0.5))),
      count: Math.round(item.count * multiplier),
    }));
  }, [multiplier, sectorBreakdownData]);

  const filteredPerformers = useMemo(() => {
    if (multiplier >= 1.0) return PERFORMERS;
    return PERFORMERS.map((p) => ({
      ...p,
      s: Math.max(60, Math.round(p.s * (0.85 + multiplier * 0.15))),
    }));
  }, [multiplier]);

  const filteredComplianceScore = useMemo(() => {
    // For cooperative: use Operational Self-Sufficiency from real KPI data
    if (role === "cooperative" && kpisData) {
      const oss = kpisData.kpis.find((k) => k.name === "operational_self_sufficiency");
      if (oss) return Math.min(oss.value, 150); // cap at 150 for radial display
    }
    if (filteredRegionCompliance.length > 0) {
      const avg =
        filteredRegionCompliance.reduce((sum, r) => sum + ((r.score as number) || 0), 0) /
        filteredRegionCompliance.length;
      return Math.round(avg * 10) / 10;
    }
    return null;
  }, [role, kpisData, filteredRegionCompliance]);

  // Merged comparison data: current period savings (no previous-year data available)
  const mergedCompData = useMemo(() => {
    const sliceMap: Record<string, number> = { Week: 2, Month: 4, Quarter: 3, Year: 12 };
    const n = sliceMap[compPeriod] ?? 12;
    return filteredMonthlyFinancials.slice(-n).map((curr) => ({
      month: curr.month,
      "This Period": curr.savings as number,
      "Last Period": 0,
      "This Period Loans": curr.loans as number,
      "Last Period Loans": 0,
    }));
  }, [filteredMonthlyFinancials, compPeriod]);

  // Multi-region trend (scaled by multiplier)
  const filteredRegionTrend = useMemo(
    () =>
      applyMultiplier(
        baseRegionTrendData,
        ["Hhohho", "Manzini", "Lubombo", "Shiselweni"],
        multiplier,
      ),
    [multiplier],
  );

  const filteredKPIs = useMemo(() => {
    if (!role) return [];

    // Cooperative: build from real KPI data, not from the placeholder array
    if (role === "cooperative" && kpisData) {
      const pick = (name: string) => kpisData.kpis.find((k) => k.name === name);
      return [
        {
          label: "Total Assets",
          value: pick("total_assets")?.formatted ?? "—",
          change: "",
          up: true,
          icon: Wallet,
        },
        {
          label: "Gross Loans",
          value: pick("gross_loan_portfolio")?.formatted ?? "—",
          change: "",
          up: true,
          icon: TrendingUp,
        },
        {
          label: "Member Deposits",
          value: pick("total_member_deposits")?.formatted ?? "—",
          change: "",
          up: true,
          icon: BarChart3,
        },
        {
          label: "Net Surplus",
          value: pick("net_surplus")?.formatted ?? "—",
          change: "",
          up: true,
          icon: Activity,
        },
        {
          label: "NPL Ratio",
          value: pick("npl_ratio")?.formatted ?? "—",
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Capital Adequacy",
          value: pick("capital_adequacy_ratio")?.formatted ?? "—",
          change: "",
          up: true,
          icon: Target,
        },
      ];
    }

    // Non-cooperative roles: build from real stats data
    if (role === "ministry" && ministryStats) {
      const total = ministryStats.total_submissions;
      return [
        {
          label: "Total Cooperatives",
          value: ministryStats.total_cooperatives.toLocaleString(),
          change: "",
          up: true,
          icon: Building2,
        },
        {
          label: "Total Submissions",
          value: total.toLocaleString(),
          change: "",
          up: true,
          icon: BarChart3,
        },
        {
          label: "Pending Review",
          value: ministryStats.pending_review_count.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approved",
          value: ministryStats.approved_count.toLocaleString(),
          change: "",
          up: true,
          icon: TrendingUp,
        },
        {
          label: "Rejected",
          value: ministryStats.rejected_count.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approval Rate",
          value: total > 0 ? `${((ministryStats.approved_count / total) * 100).toFixed(0)}%` : "—",
          change: "",
          up: true,
          icon: Target,
        },
      ];
    }
    if (role === "apex" && apexStats) {
      const total =
        apexStats.pending_submissions +
        apexStats.approved_submissions +
        apexStats.rejected_submissions;
      return [
        {
          label: "Cooperatives",
          value: apexStats.total_cooperatives.toLocaleString(),
          change: "",
          up: true,
          icon: Building2,
        },
        {
          label: "Submissions",
          value: total.toLocaleString(),
          change: "",
          up: true,
          icon: BarChart3,
        },
        {
          label: "Pending Review",
          value: apexStats.pending_submissions.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approved",
          value: apexStats.approved_submissions.toLocaleString(),
          change: "",
          up: true,
          icon: TrendingUp,
        },
        {
          label: "Rejected",
          value: apexStats.rejected_submissions.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approval Rate",
          value:
            total > 0 ? `${((apexStats.approved_submissions / total) * 100).toFixed(0)}%` : "—",
          change: "",
          up: true,
          icon: Target,
        },
      ];
    }
    if (role === "federation" && federationStats) {
      const total = federationStats.submission_count;
      return [
        {
          label: "Cooperatives",
          value: federationStats.cooperative_count.toLocaleString(),
          change: "",
          up: true,
          icon: Building2,
        },
        {
          label: "Submissions",
          value: total.toLocaleString(),
          change: "",
          up: true,
          icon: BarChart3,
        },
        {
          label: "Pending Review",
          value: federationStats.pending_review_count.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approved",
          value: federationStats.approved_count.toLocaleString(),
          change: "",
          up: true,
          icon: TrendingUp,
        },
        {
          label: "Rejected",
          value: federationStats.rejected_count.toLocaleString(),
          change: "",
          up: false,
          icon: ShieldCheck,
        },
        {
          label: "Approval Rate",
          value:
            total > 0 ? `${((federationStats.approved_count / total) * 100).toFixed(0)}%` : "—",
          change: "",
          up: true,
          icon: Target,
        },
      ];
    }

    const baseKPIs = kpiMetricsByRole[role];
    if (multiplier >= 1.0) return baseKPIs;
    // Adjust KPI values based on multiplier
    return baseKPIs.map((kpi) => {
      if (kpi.label.includes("Compliance") || kpi.label.includes("NPL")) {
        return { ...kpi, value: kpi.value }; // Keep compliance/NPL as-is
      }
      // For monetary values, adjust
      if (kpi.value.startsWith("$")) {
        const numStr = kpi.value.replace(/[$,%]/g, "");
        const suffix = kpi.value.includes("M")
          ? "M"
          : kpi.value.includes("B")
            ? "B"
            : kpi.value.includes("K")
              ? "K"
              : "";
        const numVal = parseFloat(numStr);
        if (!isNaN(numVal)) {
          const adjusted = numVal * Math.max(multiplier, 0.1);
          return { ...kpi, value: `$${adjusted.toFixed(1)}${suffix}` };
        }
      }
      if (kpi.value.includes(",")) {
        const numVal = parseInt(kpi.value.replace(/,/g, ""), 10);
        if (!isNaN(numVal)) {
          return { ...kpi, value: Math.round(numVal * Math.max(multiplier, 0.1)).toLocaleString() };
        }
      }
      return kpi;
    });
  }, [role, multiplier, kpisData, ministryStats, apexStats, federationStats]);

  const genderData = useMemo(() => {
    if (nfStats) {
      return [
        {
          name: "Women",
          value: Math.round(nfStats.membership.female_pct * 10) / 10,
          fill: "var(--chart-1)",
        },
        {
          name: "Men",
          value: Math.round(nfStats.membership.male_pct * 10) / 10,
          fill: "var(--chart-2)",
        },
        {
          name: "Non-binary / Undisclosed",
          value: Math.round(nfStats.membership.other_pct * 10) / 10,
          fill: "var(--chart-3)",
        },
      ];
    }
    return [
      { name: "Women", value: 0, fill: "var(--chart-1)" },
      { name: "Men", value: 0, fill: "var(--chart-2)" },
      { name: "Non-binary / Undisclosed", value: 0, fill: "var(--chart-3)" },
    ];
  }, [nfStats]);

  const youthData = useMemo(() => {
    if (nfStats) {
      // Single bar: your cooperative's youth vs adult split
      return [
        { name: "Youth (<35)", youth: Math.round(nfStats.membership.youth_pct), adult: 0 },
        { name: "Co-op avg", youth: 0, adult: Math.round(nfStats.membership.adult_pct) },
      ];
    }
    return [{ name: "Youth (<35)", youth: 0, adult: 0 }];
  }, [nfStats]);

  if (!role) return null;

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-6">
        {/* ── Role Badge ── */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${roleBadge[role].color}`}
          >
            <span className="size-1.5 rounded-full bg-current opacity-70" />
            {roleBadge[role].label}
          </span>
          <span className="text-xs text-muted-foreground">
            Live data · Updated{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`press-feedback inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              activeFilterCount > 0
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Filter className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {/* Active filter pills */}
          {Object.entries(filterValues).map(([key, value]) => {
            if (value === "all" || value === "ytd") return null;
            const filter = filters.find((f) => f.id === key);
            const option = filter?.options.find((o) => o.value === value);
            if (!option) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1 text-xs font-bold"
              >
                <span className="text-[10px] uppercase tracking-wider text-primary/60">
                  {filter?.label}:
                </span>
                {option.label}
                <button
                  onClick={() => handleFilterChange(key, "all")}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="press-feedback text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear all
            </button>
          )}

          <div className="flex-1" />

          {/* Date Range Picker */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* ── Expanded Filters Panel ── */}
        {showFilters && (
          <Card className="border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <h3 className="font-heading font-bold text-sm text-foreground">Filter Analytics</h3>
              </div>
              <button
                onClick={() => setShowFilters(false)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filters.map((filter) => (
                <div key={filter.id}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {filter.label}
                  </label>
                  <select
                    value={filterValues[filter.id] || "all"}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                  >
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Network Summary ── */}
        <Card
          title={
            role === "ministry"
              ? "National Network Overview"
              : role === "federation"
                ? "Federation Network Summary"
                : role === "apex"
                  ? "Apex Network Summary"
                  : "Your Cooperative At a Glance"
          }
          subtitle="Key operational indicators for the current period"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {(role === "cooperative"
              ? coopNetworkSummary
              : role === "ministry"
                ? ministerySummary
                : role === "federation"
                  ? federationSummary
                  : role === "apex"
                    ? apexSummary
                    : networkSummaryByRole[role]
            ).map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-heading text-2xl font-bold text-foreground num">{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{item.sub}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Role-Specific KPI Hero Row ── */}
        {role === "cooperative" && kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface p-4 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="size-8 rounded-lg bg-muted" />
                  <div className="h-3 w-10 rounded bg-muted" />
                </div>
                <div className="h-6 w-16 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : role === "cooperative" && kpisData && kpisData.kpis.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpisData.kpis.slice(0, 6).map((kpi) => {
              const statusColor =
                kpi.status === "green"
                  ? "text-success"
                  : kpi.status === "red"
                    ? "text-destructive"
                    : kpi.status === "amber"
                      ? "text-warning-foreground"
                      : "text-muted-foreground";
              return (
                <div
                  key={kpi.name}
                  className="rounded-xl border border-border bg-surface p-4 hover-lift shadow-[var(--shadow-elev-1)] cursor-default"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="size-8 rounded-lg grid place-items-center bg-primary/8 text-primary">
                      <Activity className="size-4" />
                    </div>
                    {kpi.status && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          kpi.status === "green"
                            ? "bg-success/10 text-success"
                            : kpi.status === "red"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/15 text-warning-foreground"
                        }`}
                      >
                        {kpi.status}
                      </span>
                    )}
                  </div>
                  <p className={`font-heading text-xl font-bold num leading-none ${statusColor}`}>
                    {kpi.formatted}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5 leading-tight">
                    {kpi.name.replace(/_/g, " ")}
                  </p>
                  {kpi.benchmark !== undefined && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Benchmark: {kpi.unit === "percent" ? `${kpi.benchmark}%` : kpi.benchmark}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : role === "cooperative" ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Activity className="size-8 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm font-semibold text-muted-foreground">No KPI data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Submit a financial statement to see your computed KPIs here.
            </p>
          </div>
        ) : null}

        {/* ── Benchmark Insight Panel (cooperative only) ── */}
        {role === "cooperative" && (
          <BenchmarkInsightPanel
            kpis={kpisData?.kpis ?? []}
            benchmarks={benchmarksForPanel}
            isLoading={kpisLoading || benchmarksLoading}
          />
        )}

        {/* ── Secondary KPI Insight Cards (real data) ── */}
        {(() => {
          const totalMembers =
            role === "cooperative"
              ? (nfStats?.membership.total ?? null)
              : nationalOverview
                ? nationalOverview.total_cooperatives
                : null;
          const totalMembersLabel =
            role === "cooperative" ? "Members in your cooperative" : "Registered cooperatives";
          const sectorCount =
            filteredSectorBreakdown.length > 0 ? filteredSectorBreakdown.length : null;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={TrendingUp}
                label="YoY Growth"
                value="—"
                subtitle="No year-over-year data"
                tone="success"
              />
              <StatCard
                icon={Users}
                label={role === "cooperative" ? "Total Members" : "Total Cooperatives"}
                value={
                  totalMembers != null
                    ? role === "cooperative" && totalMembers >= 1000
                      ? `${(totalMembers / 1000).toFixed(1)}K`
                      : totalMembers.toLocaleString()
                    : "—"
                }
                subtitle={totalMembersLabel}
                tone="primary"
              />
              <StatCard
                icon={PieChartIcon}
                label="Sector Diversity"
                value={sectorCount != null ? `${sectorCount} sectors` : "—"}
                subtitle="Active industry groups"
                tone="info"
              />
              <StatCard
                icon={BarChart3}
                label="Avg Compliance"
                value={filteredComplianceScore != null ? `${filteredComplianceScore}%` : "—"}
                subtitle={
                  role === "ministry"
                    ? "National average"
                    : role === "federation"
                      ? "Federation average"
                      : role === "apex"
                        ? "Apex average"
                        : "Your cooperative"
                }
                tone="accent"
              />
            </div>
          );
        })()}

        {/* ── Pro Line Chart + 3D Pie ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Premium Area/Line Chart with period selector ── */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
            {/* Header: stats + period toggle */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Portfolio Overview
                </p>
                <p className="font-heading text-2xl font-bold text-foreground num">
                  {role === "cooperative"
                    ? `$${portfolioTotal.savings.toLocaleString()}K`
                    : formatNumber(portfolioTotal.members)}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 rounded-full bg-[var(--chart-1)] inline-block" />
                    {role === "cooperative" ? "Savings" : "Members"}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 rounded-full bg-[var(--chart-2)] inline-block" />
                    Loans
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 rounded-full bg-[var(--chart-3)] inline-block" />
                    {role === "cooperative" ? "Deposits" : "Savings"}
                  </span>
                </div>
              </div>
              {/* Period selector */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
                {(["1D", "5D", "1M", "1Y"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                      period === p
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* Chart */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={periodSlice} margin={{ top: 10, right: 24, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-members-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-savings-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-loans-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    yAxisId="left"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => formatNumber(v as number)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => `$${v}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      padding: "10px 14px",
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                    itemStyle={{ color: "var(--foreground)", fontWeight: 500 }}
                    labelStyle={{
                      fontWeight: "700",
                      color: "var(--foreground)",
                      marginBottom: "6px",
                      fontSize: "13px",
                    }}
                    cursor={{
                      stroke: "var(--muted-foreground)",
                      strokeWidth: 1,
                      strokeDasharray: "4 3",
                    }}
                  />
                  {/* Reference line at last period */}
                  {periodSlice.length > 0 && (
                    <ReferenceLine
                      yAxisId="left"
                      x={periodSlice[periodSlice.length - 1]?.month}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="members"
                    name="Members"
                    stroke="var(--chart-1)"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    fill="url(#grad-members-new)"
                    dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-1)" }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                      fill: "var(--chart-1)",
                    }}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="savings"
                    name="Savings ($K)"
                    stroke="var(--chart-2)"
                    strokeDasharray="3 3"
                    strokeWidth={2}
                    fill="url(#grad-savings-new)"
                    dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-2)" }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                      fill: "var(--chart-2)",
                    }}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="loans"
                    name="Loans ($K)"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    fill="url(#grad-loans-new)"
                    dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-3)" }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                      fill: "var(--chart-3)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gender Participation — 2D Doughnut */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Gender Participation
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {role === "cooperative" ? "Your cooperative breakdown" : "Aggregate breakdown"}
              </p>
            </div>
            <div className="relative flex-1 flex items-center justify-center">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={82}
                      paddingAngle={3}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {genderData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "8px 12px",
                        boxShadow: "var(--shadow-elev-2)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value) => [`${value}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-heading text-xl font-bold text-foreground num leading-none">
                  {nfStats ? `${Math.round(nfStats.membership.female_pct * 10) / 10}%` : "—"}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                  Women
                </span>
              </div>
            </div>
            <ul className="space-y-2 border-t border-border pt-3 mt-2">
              {genderData.map((g) => (
                <li key={g.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-sm shrink-0" style={{ background: g.fill }} />
                    {g.name}
                  </span>
                  <span className="font-heading font-bold num text-foreground">{g.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Composed Chart: Savings, Loans & Deposits ── */}
        <Card
          title="Savings, Loans & Deposits"
          subtitle={
            role === "cooperative"
              ? "Your monthly financial breakdown & variation"
              : "Aggregate monthly financial breakdown & variation"
          }
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredMonthlyFinancials}
                margin={{ top: 16, right: 24, left: -10, bottom: 0 }}
                barGap={3}
                barCategoryGap="28%"
              >
                <defs>
                  {/* Gradient fills for bars */}
                  <linearGradient id="bar-savings-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="bar-loans-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="bar-deposits-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.65} />
                  </linearGradient>
                  {/* Soft area behind variation line */}
                  <linearGradient id="variation-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                  opacity={0.6}
                />
                <XAxis
                  dataKey="monthShort"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  fontFamily="var(--font-sans)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  fontFamily="var(--font-sans)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `$${v}K`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="var(--chart-4)"
                  fontSize={11}
                  fontFamily="var(--font-sans)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--chart-4)", fontSize: 11 }}
                  tickFormatter={(v) => `$${v}K`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontFamily: "var(--font-sans)",
                    padding: "12px 16px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  }}
                  itemStyle={{ color: "var(--foreground)", fontWeight: 500, lineHeight: "1.8" }}
                  labelStyle={{
                    fontWeight: "700",
                    color: "var(--foreground)",
                    marginBottom: "6px",
                    fontSize: "13px",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "6px",
                  }}
                  formatter={(value: number, name: string) => [`$${value.toLocaleString()}K`, name]}
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "11px",
                    fontFamily: "var(--font-sans)",
                    color: "var(--muted-foreground)",
                    paddingTop: "12px",
                  }}
                  iconType="circle"
                  iconSize={8}
                />
                {/* Grouped side-by-side bars with gradient fills */}
                <Bar
                  yAxisId="left"
                  dataKey="savings"
                  fill="url(#bar-savings-grad)"
                  name="Savings"
                  barSize={14}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="loans"
                  fill="url(#bar-loans-grad)"
                  name="Loans"
                  barSize={14}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="deposits"
                  fill="url(#bar-deposits-grad)"
                  name="Deposits"
                  barSize={14}
                  radius={[3, 3, 0, 0]}
                />
                {/* Soft area fill beneath variation line */}
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="variation"
                  stroke="none"
                  fill="url(#variation-area-grad)"
                  name="_variation-fill"
                  legendType="none"
                  tooltipType="none"
                />
                {/* Variation trend line with hollow dots */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="variation"
                  stroke="var(--chart-4)"
                  strokeWidth={2.5}
                  name="Net Variation"
                  dot={{ r: 4.5, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-4)" }}
                  activeDot={{
                    r: 7,
                    strokeWidth: 2.5,
                    stroke: "var(--chart-4)",
                    fill: "var(--surface)",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Sector Pie + Youth Stacked Bar ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sector Capital Share — 2D Doughnut (or simple card for cooperative) */}
          {role === "cooperative" ? (
            (() => {
              const sectorName = myCoopProfile?.institution_type ?? null;
              const coopSector = sectorName
                ? filteredSectorBreakdown.find(
                    (s) => s.name?.toLowerCase() === sectorName.toLowerCase(),
                  )
                : null;
              const capitalShare = coopSector ? `${coopSector.value}%` : "—";
              const coopCount = coopSector
                ? ((coopSector as unknown as { count?: number }).count ?? "—")
                : "—";
              return (
                <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Your Sector
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cooperative classification
                    </p>
                  </div>
                  <div className="my-6 flex flex-col items-center">
                    <div className="size-16 rounded-full bg-accent/10 grid place-items-center">
                      <BarChart3 className="size-7 text-accent" />
                    </div>
                    <p className="font-heading text-2xl font-bold text-foreground mt-4">
                      {sectorName ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {myCoopProfile?.name ?? "—"}
                    </p>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Capital share</span>
                      <span className="font-bold num text-foreground">{capitalShare}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Sector avg. compliance</span>
                      <span className="font-bold num text-foreground">
                        {filteredComplianceScore != null ? `${filteredComplianceScore}%` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Cooperatives in sector</span>
                      <span className="font-bold num text-foreground">
                        {typeof coopCount === "number" ? coopCount.toLocaleString() : coopCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sector Capital Share
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Share of portfolio by sector
                </p>
              </div>
              <div className="relative flex-1 flex items-center justify-center">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={filteredSectorBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={82}
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {filteredSectorBreakdown.map((_, i) => (
                          <Cell
                            key={i}
                            fill="var(--accent)"
                            fillOpacity={sectorOpacities[i] ?? 0.3}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontFamily: "var(--font-sans)",
                          padding: "8px 12px",
                          boxShadow: "var(--shadow-elev-2)",
                        }}
                        itemStyle={{ color: "var(--foreground)" }}
                        formatter={(value: number) => [`${value}%`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-heading text-xl font-bold text-foreground num leading-none">
                    {filteredSectorBreakdown.length}
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                    Sectors
                  </span>
                </div>
              </div>
              <ul className="space-y-1.5 border-t border-border pt-3 mt-2">
                {filteredSectorBreakdown.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ background: "var(--accent)", opacity: sectorOpacities[i] ?? 0.3 }}
                      />
                      {s.name}
                    </span>
                    <span className="font-bold num text-foreground">{s.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Card
            className="lg:col-span-2"
            title={role === "cooperative" ? "Youth Participation" : "Youth Participation by Region"}
            subtitle={
              role === "cooperative"
                ? "Youth vs adult member composition"
                : "% of members under 35 years old"
            }
          >
            {role === "cooperative" ? (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Your Co-op",
                        youth: nfStats ? Math.round(nfStats.membership.youth_pct) : 0,
                        adult: nfStats ? Math.round(nfStats.membership.adult_pct) : 0,
                      },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "8px 12px",
                        boxShadow: "var(--shadow-elev-2)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      labelStyle={{
                        fontWeight: "600",
                        color: "var(--foreground)",
                        marginBottom: "4px",
                      }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Bar
                      dataKey="youth"
                      fill="var(--accent)"
                      fillOpacity={1}
                      radius={[0, 0, 0, 0]}
                      barSize={28}
                      name="Youth (< 35)"
                    />
                    <Bar
                      dataKey="adult"
                      fill="var(--accent)"
                      fillOpacity={0.3}
                      radius={[0, 6, 6, 0]}
                      barSize={28}
                      name="Adult (35+)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={youthData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "8px 12px",
                        boxShadow: "var(--shadow-elev-2)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      labelStyle={{
                        fontWeight: "600",
                        color: "var(--foreground)",
                        marginBottom: "4px",
                      }}
                    />
                    <Bar
                      dataKey="youth"
                      stackId="a"
                      fill="var(--chart-1)"
                      barSize={20}
                      name="Youth (< 35)"
                    />
                    <Bar
                      dataKey="adult"
                      stackId="a"
                      fill="var(--muted)"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                      name="Adult (35+)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* ── Non-Financial Indicator Cards ── */}
        {nfStats && nfStats.membership.total > 0 && (
          <div className="grid lg:grid-cols-4 gap-6">
            <Card title="Savings Penetration" subtitle="% of members with savings accounts">
              <div className="flex flex-col items-center justify-center py-4">
                <span className="font-heading text-3xl font-bold text-foreground num">
                  {nfStats.savings.savings_penetration_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {nfStats.savings.active_accounts.toLocaleString()} active savers /{" "}
                  {nfStats.membership.total.toLocaleString()} members
                </span>
                <div className="w-full mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${Math.min(nfStats.savings.savings_penetration_pct, 100)}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card title="Credit Penetration" subtitle="% of members with active loans">
              <div className="flex flex-col items-center justify-center py-4">
                <span className="font-heading text-3xl font-bold text-foreground num">
                  {nfStats.loans.credit_penetration_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {nfStats.loans.members_with_loans.toLocaleString()} borrowers /{" "}
                  {nfStats.membership.total.toLocaleString()} members
                </span>
                <div className="w-full mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--chart-2)]"
                    style={{ width: `${Math.min(nfStats.loans.credit_penetration_pct, 100)}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card title="FD Penetration" subtitle="% of members with fixed deposits">
              <div className="flex flex-col items-center justify-center py-4">
                <span className="font-heading text-3xl font-bold text-foreground num">
                  {nfStats.fixed_deposits.fd_penetration_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {nfStats.fixed_deposits.members_with_fds.toLocaleString()} depositors /{" "}
                  {nfStats.membership.total.toLocaleString()} members
                </span>
                <div className="w-full mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--chart-3)]"
                    style={{
                      width: `${Math.min(nfStats.fixed_deposits.fd_penetration_pct, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </Card>

            <Card title="Repayment Discipline" subtitle="% of loans repaid on time">
              <div className="flex flex-col items-center justify-center py-4">
                <span
                  className={`font-heading text-3xl font-bold num ${
                    nfStats.loans.on_time_repayment_pct >= 75
                      ? "text-emerald-600"
                      : nfStats.loans.on_time_repayment_pct >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {nfStats.loans.on_time_repayment_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {nfStats.loans.performing.toLocaleString()} performing /{" "}
                  {nfStats.loans.active_loans.toLocaleString()} active
                </span>
                <div className="w-full mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      nfStats.loans.on_time_repayment_pct >= 75
                        ? "bg-emerald-500"
                        : nfStats.loans.on_time_repayment_pct >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(nfStats.loans.on_time_repayment_pct, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Membership Horizontal Bar + Loan Portfolio Pie + Compliance Radial ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            title={role === "cooperative" ? "Membership Composition" : "Membership Growth"}
            subtitle={
              role === "cooperative"
                ? "Your cooperative's member breakdown from NF data"
                : "5-year trend with demographics"
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    role === "cooperative"
                      ? nfStats && nfStats.membership.total > 0
                        ? [
                            {
                              year: "Current",
                              members: nfStats.membership.total,
                              youth: nfStats.membership.under_18 + nfStats.membership.age_18_35,
                              women: nfStats.membership.female,
                            },
                          ]
                        : coopMembershipHistory
                      : filteredMembershipGrowth
                  }
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax"]}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      role === "cooperative" ? v.toLocaleString() : `${(v / 1000000).toFixed(1)}M`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="year"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      padding: "8px 12px",
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "4px",
                    }}
                    formatter={(value: number) => [formatNumber(value)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {role === "cooperative" ? (
                    <>
                      <Bar
                        dataKey="women"
                        fill="var(--accent)"
                        fillOpacity={1}
                        radius={[0, 3, 3, 0]}
                        name="Women"
                        barSize={10}
                      />
                      <Bar
                        dataKey="youth"
                        fill="var(--accent)"
                        fillOpacity={0.6}
                        radius={[0, 3, 3, 0]}
                        name="Youth"
                        barSize={10}
                      />
                      <Bar
                        dataKey="members"
                        fill="var(--accent)"
                        fillOpacity={0.3}
                        radius={[0, 3, 3, 0]}
                        name="Total"
                        barSize={10}
                      />
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="women"
                        fill="var(--chart-1)"
                        radius={[0, 3, 3, 0]}
                        name="Women"
                        barSize={10}
                      />
                      <Bar
                        dataKey="youth"
                        fill="var(--chart-3)"
                        radius={[0, 3, 3, 0]}
                        name="Youth"
                        barSize={10}
                      />
                      <Bar
                        dataKey="members"
                        fill="var(--chart-2)"
                        radius={[0, 3, 3, 0]}
                        name="Total"
                        barSize={10}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Loan Portfolio Quality" subtitle="Risk distribution">
            <div className="relative h-52 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredLoanPortfolio}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {filteredLoanPortfolio.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      padding: "8px 12px",
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "4px",
                    }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[20px] font-bold text-success leading-none">82%</span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                  Performing
                </span>
              </div>
            </div>
            <ul className="space-y-2 border-t border-border pt-3 mt-1">
              {filteredLoanPortfolio.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2.5 rounded-sm shrink-0"
                      style={{ background: item.fill }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold num text-foreground">{item.value}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Compliance Score"
            subtitle={
              role === "cooperative" ? "Your current rating" : "Aggregate compliance rating"
            }
          >
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="85%"
                  barSize={10}
                  data={[
                    {
                      name: "Compliance",
                      value: filteredComplianceScore ?? 0,
                      fill: "var(--chart-1)",
                    },
                  ]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    fill="var(--chart-1)"
                    background={{ fill: "var(--muted)", opacity: 0.15 }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-4">
              <p className="font-heading text-4xl font-bold text-foreground num">
                {filteredComplianceScore != null ? `${filteredComplianceScore}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Compliance score</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <ArrowDownRight className="size-3.5 text-warning-foreground" />
                <span className="text-xs font-semibold text-warning-foreground">-0.4 pts</span>
                <span className="text-xs text-muted-foreground">vs last quarter</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Region Compliance Horizontal Bar + Submission Timeliness Area ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card
            title={
              role === "cooperative"
                ? "Your Compliance Trend"
                : role === "ministry"
                  ? "Regional Compliance Comparison"
                  : role === "federation"
                    ? "Regional Compliance in Your Federation"
                    : "Regional Compliance Overview"
            }
            subtitle={
              role === "cooperative"
                ? "Monthly compliance score over the year"
                : "Compliance score by region"
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {role === "cooperative" ? (
                  <AreaChart
                    data={coopComplianceTrend}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="coop-comp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[85, 100]}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "8px 12px",
                        boxShadow: "var(--shadow-elev-2)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      labelStyle={{
                        fontWeight: "600",
                        color: "var(--foreground)",
                        marginBottom: "4px",
                      }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#coop-comp)"
                      dot={{
                        r: 3,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--accent)",
                      }}
                      name="Compliance"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={filteredRegionCompliance}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[80, 100]}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "8px 12px",
                        boxShadow: "var(--shadow-elev-2)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      labelStyle={{
                        fontWeight: "600",
                        color: "var(--foreground)",
                        marginBottom: "4px",
                      }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Bar
                      dataKey="score"
                      fill="var(--chart-1)"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      name="Compliance %"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Submission Timeliness" subtitle="% of on-time vs late submissions">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredSubmissionTrend}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      padding: "8px 12px",
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{
                      fontWeight: "600",
                      color: "var(--foreground)",
                      marginBottom: "4px",
                    }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: "11px",
                      fontFamily: "var(--font-sans)",
                      color: "var(--muted-foreground)",
                    }}
                  />
                  <Area
                    dataKey="onTime"
                    fill="var(--chart-1)"
                    fillOpacity={0.06}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    name="On Time"
                  />
                  <Area
                    dataKey="late"
                    fill="var(--chart-4)"
                    fillOpacity={0.06}
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    name="Late"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Period Comparison + Region Trend side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Current vs Previous Period Comparison Chart ── */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Portfolio Savings — Period Comparison
                </p>
                <div className="flex items-center gap-5 mt-2">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block w-6 h-0.5 rounded-full bg-[var(--chart-1)]" />
                    This Period
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg width="24" height="4" className="shrink-0">
                      <line
                        x1="0"
                        y1="2"
                        x2="24"
                        y2="2"
                        stroke="var(--chart-4)"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                      />
                    </svg>
                    Last Period
                  </span>
                </div>
              </div>
              {/* Period selector */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
                {(["Week", "Month", "Quarter", "Year"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCompPeriod(p)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                      compPeriod === p
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* Chart */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mergedCompData}
                  margin={{ top: 10, right: 24, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="comp-curr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="comp-prev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="var(--border)"
                    vertical={false}
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="month"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => `$${v}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      padding: "12px 16px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                    }}
                    itemStyle={{ color: "var(--foreground)", fontWeight: 500, lineHeight: "1.8" }}
                    labelStyle={{
                      fontWeight: "700",
                      color: "var(--foreground)",
                      marginBottom: "6px",
                      fontSize: "13px",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: "6px",
                    }}
                    formatter={(value: number, name: string) => [`$${value}K`, name]}
                    cursor={{
                      stroke: "var(--muted-foreground)",
                      strokeWidth: 1,
                      strokeDasharray: "4 3",
                    }}
                  />
                  {/* Current period — solid with visible dots */}
                  <Area
                    type="monotone"
                    dataKey="This Period"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#comp-curr)"
                    dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-1)" }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                      fill: "var(--chart-1)",
                    }}
                  />
                  {/* Previous period — dashed with visible dots */}
                  <Area
                    type="monotone"
                    dataKey="Last Period"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="url(#comp-prev)"
                    dot={{
                      r: 3.5,
                      strokeWidth: 2,
                      fill: "var(--surface)",
                      stroke: "var(--chart-4)",
                    }}
                    activeDot={{
                      r: 5.5,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                      fill: "var(--chart-4)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Multi-Region Trend (or Coop Monthly Trend) ── */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {role === "cooperative" ? "Monthly Members & Savings" : "Member Trend by Region"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {role === "cooperative"
                    ? "Your cooperative's monthly trend"
                    : "Jan – Dec 2025 · Across all regions"}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                Jan 1 – Dec 31
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {role === "cooperative" ? (
                  <AreaChart
                    data={coopMonthlyTrend}
                    margin={{ top: 10, right: 24, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="coop-members" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="coop-savings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="var(--border)"
                      vertical={false}
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="left"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                      tickFormatter={(v) => `$${v}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "12px 16px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                      }}
                      itemStyle={{ color: "var(--foreground)", fontWeight: 500, lineHeight: "1.8" }}
                      labelStyle={{
                        fontWeight: "700",
                        color: "var(--foreground)",
                        marginBottom: "6px",
                        fontSize: "13px",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "6px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        fontFamily: "var(--font-sans)",
                        paddingTop: "12px",
                      }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="members"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#coop-members)"
                      dot={{
                        r: 3,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--accent)",
                      }}
                      name="Members"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="savings"
                      stroke="var(--success)"
                      strokeWidth={2}
                      fill="url(#coop-savings)"
                      dot={{
                        r: 3,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--success)",
                      }}
                      name="Savings ($K)"
                    />
                  </AreaChart>
                ) : (
                  <AreaChart
                    data={filteredRegionTrend}
                    margin={{ top: 10, right: 24, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="region-h" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="region-m" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="region-l" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="region-s" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="var(--border)"
                      vertical={false}
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      fontSize={11}
                      fontFamily="var(--font-sans)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                      tickFormatter={(v) => formatNumber(v as number)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        padding: "12px 16px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                      }}
                      itemStyle={{ color: "var(--foreground)", fontWeight: 500, lineHeight: "1.8" }}
                      labelStyle={{
                        fontWeight: "700",
                        color: "var(--foreground)",
                        marginBottom: "6px",
                        fontSize: "13px",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "6px",
                      }}
                      cursor={{
                        stroke: "var(--muted-foreground)",
                        strokeWidth: 1,
                        strokeDasharray: "4 3",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        fontFamily: "var(--font-sans)",
                        paddingTop: "12px",
                      }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Area
                      dataKey="Hhohho"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#region-h)"
                      type="monotone"
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--chart-1)",
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: "var(--chart-1)",
                      }}
                    />
                    <Area
                      dataKey="Manzini"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#region-m)"
                      type="monotone"
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--chart-2)",
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: "var(--chart-2)",
                      }}
                    />
                    <Area
                      dataKey="Lubombo"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      fill="url(#region-l)"
                      type="monotone"
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--chart-3)",
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: "var(--chart-3)",
                      }}
                    />
                    <Area
                      dataKey="Shiselweni"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      fill="url(#region-s)"
                      type="monotone"
                      dot={{
                        r: 4,
                        strokeWidth: 2,
                        fill: "var(--surface)",
                        stroke: "var(--chart-4)",
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: "var(--chart-4)",
                      }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* end side-by-side grid */}

        {/* ── Performance Score (leaderboard for admin, metrics for cooperative) ── */}
        {role === "cooperative" ? (
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Your Performance Metrics</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Key performance indicators from your latest submission
                </p>
              </div>
              {latestSubmission && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  FY {latestSubmission.reporting_year}
                </span>
              )}
            </div>
            {kpisLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-surface p-5 animate-pulse space-y-2">
                    <div className="h-2.5 w-20 rounded bg-muted" />
                    <div className="h-7 w-16 rounded bg-muted" />
                    <div className="h-2 w-24 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : kpisData && kpisData.kpis.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
                {kpisData.kpis.slice(0, 6).map((kpi) => (
                  <div key={kpi.name} className="bg-surface p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {kpi.name.replace(/_/g, " ")}
                    </p>
                    <p
                      className={`font-heading text-2xl font-bold num mt-2 ${
                        kpi.status === "green"
                          ? "text-success"
                          : kpi.status === "red"
                            ? "text-destructive"
                            : kpi.status === "amber"
                              ? "text-warning-foreground"
                              : "text-foreground"
                      }`}
                    >
                      {kpi.formatted}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {kpi.benchmark !== undefined && (
                        <span className="text-[11px] text-muted-foreground">
                          Benchmark:{" "}
                          {kpi.unit === "percent" ? `${kpi.benchmark}%` : String(kpi.benchmark)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
                <Activity className="size-10 opacity-30" />
                <div>
                  <p className="text-sm font-semibold">No performance data yet</p>
                  <p className="text-xs mt-1">
                    Submit a financial statement to see your KPIs here.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Performance Score — Top Cooperatives
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Composite score based on compliance, portfolio quality, and member engagement
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                FY 2025
              </span>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[3rem_1fr_auto_6rem_4rem] items-center gap-4 px-6 py-3 bg-muted/30 border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                #
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cooperative
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Sector
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                Performance
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Score
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {filteredPerformers.map((c, i) => {
                const scorePct = c.s;
                const isTop = scorePct >= 90;
                const isMid = scorePct >= 80 && scorePct < 90;
                const barColor = isTop
                  ? "var(--success)"
                  : isMid
                    ? "var(--chart-3)"
                    : "var(--destructive)";
                const bgBadge = isTop
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : isMid
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400";
                const rankColors = [
                  "bg-yellow-400 text-yellow-900",
                  "bg-slate-300 text-slate-700",
                  "bg-amber-600 text-amber-100",
                ];
                return (
                  <div
                    key={c.n}
                    className="grid grid-cols-[3rem_1fr_auto_6rem_4rem] items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Rank badge */}
                    <div className="flex justify-center">
                      {i < 3 ? (
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black shadow-sm ${rankColors[i]}`}
                        >
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Name + progress bar */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug">
                        {c.n}
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden w-full max-w-[280px]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${scorePct}%`,
                            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Sector badge */}
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                      {c.p}
                    </span>

                    {/* Score bar visual */}
                    <div className="flex items-center justify-center">
                      <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${scorePct}%`,
                            background: barColor,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>

                    {/* Score number */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-lg text-sm font-black num ${bgBadge}`}
                      >
                        {c.s}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(role === "ministry" || role === "federation" || role === "apex") && nationalOverview && (
          <div className="mt-6">
            <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <p className="text-sm font-bold text-foreground">National KPI Overview</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Traffic-light distribution across {nationalOverview.total_cooperatives}{" "}
                  cooperatives
                  {nationalOverview.cooperatives_with_data > 0 &&
                    ` (${nationalOverview.cooperatives_with_data} with data)`}
                </p>
              </div>
              <div className="p-6">
                {Object.keys(nationalOverview.distributions).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No financial data available for aggregation.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(nationalOverview.distributions).map(([kpiName, dist]) => (
                      <div
                        key={kpiName}
                        className="rounded-lg border border-border bg-muted/20 p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                          {kpiName.replace(/_/g, " ")}
                        </p>
                        <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-border">
                          {dist.green_count > 0 && (
                            <div
                              className="h-full bg-success"
                              style={{ width: `${dist.green_pct}%` }}
                            />
                          )}
                          {dist.amber_count > 0 && (
                            <div
                              className="h-full bg-warning"
                              style={{ width: `${dist.amber_pct}%` }}
                            />
                          )}
                          {dist.red_count > 0 && (
                            <div
                              className="h-full bg-danger"
                              style={{ width: `${dist.red_pct}%` }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px]">
                          <span className="text-success font-bold">{dist.green_count}G</span>
                          <span className="text-warning font-bold">{dist.amber_count}A</span>
                          <span className="text-danger font-bold">{dist.red_count}R</span>
                          {dist.no_data_count > 0 && (
                            <span className="text-muted-foreground">{dist.no_data_count}N/A</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Institution comparison table */}
              {nationalOverview.cooperatives.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-6 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Institution Comparison
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t border-border bg-muted/30">
                          <th className="px-4 py-2 text-left font-bold text-muted-foreground">
                            Cooperative
                          </th>
                          <th className="px-4 py-2 text-left font-bold text-muted-foreground">
                            Region
                          </th>
                          <th className="px-4 py-2 text-left font-bold text-muted-foreground">
                            Sector
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-muted-foreground">
                            Data
                          </th>
                          {Object.keys(nationalOverview.distributions)
                            .slice(0, 6)
                            .map((kpi) => (
                              <th
                                key={kpi}
                                className="px-3 py-2 text-center font-bold text-muted-foreground"
                              >
                                {kpi.replace(/_/g, " ")}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nationalOverview.cooperatives.map((coop) => (
                          <tr
                            key={coop.cooperative_id}
                            className="border-t border-border hover:bg-muted/10"
                          >
                            <td className="px-4 py-2 font-medium text-foreground max-w-[180px] truncate">
                              {coop.name}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {coop.region ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {coop.sector ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {coop.has_data ? (
                                <span className="text-success">✓</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            {Object.keys(nationalOverview.distributions)
                              .slice(0, 6)
                              .map((kpi) => {
                                const kpiVal = coop.kpis[kpi];
                                return (
                                  <td key={kpi} className="px-3 py-2 text-center">
                                    {kpiVal ? (
                                      <span
                                        className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          kpiVal.status === "green"
                                            ? "bg-success/15 text-success"
                                            : kpiVal.status === "amber"
                                              ? "bg-warning/15 text-warning"
                                              : "bg-danger/15 text-danger"
                                        }`}
                                      >
                                        {kpiVal.formatted}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {role === "ministry" && (
          <div className="mt-6">
            <NonFinancialConsolidation />
          </div>
        )}
      </div>
    </AppShell>
  );
};
