import { createFileRoute } from "@tanstack/react-router";
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
import {
  GROWTH_TREND,
  REGIONS,
  SECTOR_BREAKDOWN,
  FEDERATIONS,
  APEXES,
  COOPERATIVES,
  formatNumber,
} from "@/lib/mock-data";
import { useAuth, type Role } from "@/lib/auth";
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
} from "lucide-react";
import { format, isAfter, isBefore, parseISO, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — CoopData" }] }),
  component: AnalyticsPage,
});

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
// Cooperative-specific data (replaces national/regional aggregates)
// ─────────────────────────────────────────────────────────────────────
const coopComplianceTrend = [
  { month: "Jan", score: 89.2 },
  { month: "Feb", score: 90.1 },
  { month: "Mar", score: 91.4 },
  { month: "Apr", score: 90.8 },
  { month: "May", score: 92.0 },
  { month: "Jun", score: 91.6 },
  { month: "Jul", score: 93.1 },
  { month: "Aug", score: 92.4 },
  { month: "Sep", score: 93.8 },
  { month: "Oct", score: 92.9 },
  { month: "Nov", score: 94.2 },
  { month: "Dec", score: 92.4 },
];

const coopMembershipHistory = [
  { year: "2021", members: 2840, youth: 980, women: 1520 },
  { year: "2022", members: 2960, youth: 1050, women: 1590 },
  { year: "2023", members: 3080, youth: 1120, women: 1660 },
  { year: "2024", members: 3190, youth: 1210, women: 1720 },
  { year: "2025", members: 3284, youth: 1310, women: 1780 },
];

const coopMonthlyTrend = [
  { month: "Jan", members: 3180, savings: 980 },
  { month: "Feb", members: 3195, savings: 998 },
  { month: "Mar", members: 3210, savings: 1020 },
  { month: "Apr", members: 3225, savings: 1041 },
  { month: "May", members: 3240, savings: 1078 },
  { month: "Jun", members: 3250, savings: 1102 },
  { month: "Jul", members: 3260, savings: 1130 },
  { month: "Aug", members: 3270, savings: 1158 },
  { month: "Sep", members: 3275, savings: 1182 },
  { month: "Oct", members: 3278, savings: 1198 },
  { month: "Nov", members: 3282, savings: 1204 },
  { month: "Dec", members: 3284, savings: 1204 },
];

const coopPerformanceMetrics = [
  { label: "Compliance Score", value: "92.4%", trend: "+1.2%", up: true, desc: "Based on 11 of 12 submissions" },
  { label: "Portfolio Quality", value: "82%", trend: "+3%", up: true, desc: "Performing loans ratio" },
  { label: "Member Growth", value: "+3.3%", trend: "YoY", up: true, desc: "Net new members this year" },
  { label: "Savings Growth", value: "+22.9%", trend: "YoY", up: true, desc: "Year-over-year savings increase" },
  { label: "Submission Rate", value: "91.7%", trend: "+4.2%", up: true, desc: "On-time submission rate" },
  { label: "Capital Adequacy", value: "14.8%", trend: "+1.1%", up: true, desc: "Above 10% regulatory minimum" },
];

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
  { month: "Jan 2025", monthShort: "Jan", savings: 980, loans: 612, deposits: 340, date: "2025-01-15" },
  { month: "Feb 2025", monthShort: "Feb", savings: 998, loans: 631, deposits: 355, date: "2025-02-15" },
  { month: "Mar 2025", monthShort: "Mar", savings: 1020, loans: 655, deposits: 372, date: "2025-03-15" },
  { month: "Apr 2025", monthShort: "Apr", savings: 1041, loans: 678, deposits: 390, date: "2025-04-15" },
  { month: "May 2025", monthShort: "May", savings: 1078, loans: 702, deposits: 412, date: "2025-05-15" },
  { month: "Jun 2025", monthShort: "Jun", savings: 1102, loans: 731, deposits: 438, date: "2025-06-15" },
  { month: "Jul 2025", monthShort: "Jul", savings: 1130, loans: 758, deposits: 460, date: "2025-07-15" },
  { month: "Aug 2025", monthShort: "Aug", savings: 1158, loans: 781, deposits: 482, date: "2025-08-15" },
  { month: "Sep 2025", monthShort: "Sep", savings: 1182, loans: 802, deposits: 501, date: "2025-09-15" },
  { month: "Oct 2025", monthShort: "Oct", savings: 1198, loans: 821, deposits: 520, date: "2025-10-15" },
  { month: "Nov 2025", monthShort: "Nov", savings: 1204, loans: 835, deposits: 538, date: "2025-11-15" },
  { month: "Dec 2025", monthShort: "Dec", savings: 1204, loans: 842, deposits: 555, date: "2025-12-15" },
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

// Previous-period financials (last year) for comparison chart
const basePrevPeriodFinancials = [
  { month: "Jan", savings: 620, loans: 420, members: 180000 },
  { month: "Feb", savings: 1380, loans: 890, members: 310000 },
  { month: "Mar", savings: 480, loans: 310, members: 140000 },
  { month: "Apr", savings: 1500, loans: 950, members: 340000 },
  { month: "May", savings: 390, loans: 240, members: 120000 },
  { month: "Jun", savings: 1280, loans: 820, members: 280000 },
  { month: "Jul", savings: 700, loans: 450, members: 200000 },
  { month: "Aug", savings: 1600, loans: 1020, members: 360000 },
  { month: "Sep", savings: 320, loans: 200, members: 110000 },
  { month: "Oct", savings: 1420, loans: 910, members: 320000 },
  { month: "Nov", savings: 560, loans: 370, members: 165000 },
  { month: "Dec", savings: 1700, loans: 1100, members: 380000 },
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
  a4: 0.10, // Lubombo Apex
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
  coop_10: 0.10,
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

const kpiMetricsByRole: Record<Role, { label: string; value: string; change: string; up: boolean; icon: typeof TrendingUp }[]> = {
  ministry: [
    { label: "Total Portfolio", value: "$2.05B", change: "+8.2%", up: true, icon: Landmark },
    { label: "Active Coops", value: "11,420", change: "+3.1%", up: true, icon: Building2 },
    { label: "National Compliance", value: "92.4%", change: "-0.4%", up: false, icon: ShieldCheck },
    { label: "YoY Growth", value: "+7.2%", change: "+1.1%", up: true, icon: TrendingUp },
    { label: "Total Members", value: "2.4M", change: "+4.8%", up: true, icon: Users },
    { label: "Avg Loan Yield", value: "14.2%", change: "+0.8%", up: true, icon: Target },
  ],
  federation: [
    { label: "Federation Portfolio", value: "$842M", change: "+6.4%", up: true, icon: Wallet },
    { label: "Active Coops", value: "4,480", change: "+2.8%", up: true, icon: Building2 },
    { label: "Compliance Rate", value: "91.3%", change: "+1.2%", up: true, icon: ShieldCheck },
    { label: "YoY Growth", value: "+6.8%", change: "+0.9%", up: true, icon: TrendingUp },
    { label: "Total Members", value: "891K", change: "+3.7%", up: true, icon: Users },
    { label: "Avg Loan Yield", value: "13.8%", change: "+0.5%", up: true, icon: Target },
  ],
  apex: [
    { label: "Apex Portfolio", value: "$312M", change: "+5.1%", up: true, icon: Wallet },
    { label: "Active Coops", value: "1,240", change: "+2.2%", up: true, icon: Building2 },
    { label: "Compliance Rate", value: "93.2%", change: "+2.1%", up: true, icon: ShieldCheck },
    { label: "YoY Growth", value: "+4.9%", change: "+0.6%", up: true, icon: TrendingUp },
    { label: "Total Members", value: "497K", change: "+3.2%", up: true, icon: Users },
    { label: "Avg Loan Yield", value: "12.9%", change: "+0.3%", up: true, icon: Target },
  ],
  cooperative: [
    { label: "Total Assets", value: "$6.4M", change: "+8.2%", up: true, icon: Wallet },
    { label: "Total Savings", value: "$4.2M", change: "+5.1%", up: true, icon: TrendingUp },
    { label: "Loan Portfolio", value: "$3.5M", change: "+3.7%", up: true, icon: BarChart3 },
    { label: "Net Surplus", value: "$420K", change: "+12.4%", up: true, icon: Activity },
    { label: "NPL Ratio", value: "1.2%", change: "-0.3%", up: false, icon: ShieldCheck },
    { label: "Capital Ratio", value: "14.8%", change: "+1.1%", up: true, icon: Target },
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
    { label: "Federations", value: "4", sub: "Active national federations" },
    { label: "Apexes", value: "7", sub: "Regional apex bodies" },
    { label: "Cooperatives", value: "11,420", sub: "Registered cooperatives" },
    { label: "Total Members", value: "2.4M", sub: "Active members nationwide" },
    { label: "Submitted Reports", value: "8,912", sub: "YTD financial submissions" },
    { label: "Pending Reviews", value: "142", sub: "Awaiting ministry approval" },
  ],
  federation: [
    { label: "Apexes Under Fed.", value: "3", sub: "Reporting to your federation" },
    { label: "Cooperatives", value: "4,480", sub: "Under your federation" },
    { label: "Total Members", value: "891K", sub: "Active members" },
    { label: "Submitted Reports", value: "3,240", sub: "YTD financial submissions" },
    { label: "Pending Reviews", value: "48", sub: "Awaiting federation review" },
    { label: "Non-Compliant", value: "18", sub: "Coops below 80% threshold" },
  ],
  apex: [
    { label: "Cooperatives", value: "1,240", sub: "Under your apex" },
    { label: "Total Members", value: "497K", sub: "Active members" },
    { label: "Submitted Reports", value: "1,104", sub: "YTD financial submissions" },
    { label: "Pending Reviews", value: "21", sub: "Awaiting apex review" },
    { label: "Top Compliance", value: "97.2%", sub: "Highest-scoring coop" },
    { label: "Non-Compliant", value: "7", sub: "Coops below 80% threshold" },
  ],
  cooperative: [
    { label: "Members", value: "3,284", sub: "Active as of today" },
    { label: "Total Assets", value: "$6.4M", sub: "Balance sheet value" },
    { label: "Reports Submitted", value: "11", sub: "YTD of 12 required" },
    { label: "Next Deadline", value: "Aug 31", sub: "Q3 2025 submission" },
    { label: "Compliance Score", value: "92.4%", sub: "Your current rating" },
    { label: "NPL Ratio", value: "1.2%", sub: "Non-performing loans" },
  ],
};

interface FilterConfig {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

const FILTERS_BY_ROLE: Record<Role, FilterConfig[]> = {
  ministry: [
    {
      id: "federation",
      label: "Federation",
      options: [{ value: "all", label: "All Federations" }, ...FEDERATIONS.map((f) => ({ value: f.id, label: f.name }))],
    },
    {
      id: "apex",
      label: "Apex",
      options: [{ value: "all", label: "All Apexes" }, ...APEXES.map((a) => ({ value: a.id, label: a.name }))],
    },
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }, ...COOPERATIVES.slice(0, 10).map((c) => ({ value: c.id, label: c.name }))],
    },
    {
      id: "region",
      label: "Region",
      options: [
        { value: "all", label: "All Regions" },
        { value: "Manzini", label: "Manzini" },
        { value: "Hhohho", label: "Hhohho" },
        { value: "Shiselweni", label: "Shiselweni" },
        { value: "Lubombo", label: "Lubombo" },
      ],
    },
    {
      id: "sector",
      label: "Sector",
      options: [
        { value: "all", label: "All Sectors" },
        { value: "Agriculture", label: "Agriculture" },
        { value: "Finance", label: "Finance" },
        { value: "Housing", label: "Housing" },
        { value: "Transport", label: "Transport" },
        { value: "Manufacturing", label: "Manufacturing" },
      ],
    },
  ],
  federation: [
    {
      id: "apex",
      label: "Apex",
      options: [{ value: "all", label: "All Apexes" }, ...APEXES.map((a) => ({ value: a.id, label: a.name }))],
    },
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }, ...COOPERATIVES.slice(0, 10).map((c) => ({ value: c.id, label: c.name }))],
    },
    {
      id: "region",
      label: "Region",
      options: [
        { value: "all", label: "All Regions" },
        { value: "Manzini", label: "Manzini" },
        { value: "Hhohho", label: "Hhohho" },
        { value: "Shiselweni", label: "Shiselweni" },
        { value: "Lubombo", label: "Lubombo" },
      ],
    },
    {
      id: "sector",
      label: "Sector",
      options: [
        { value: "all", label: "All Sectors" },
        { value: "Agriculture", label: "Agriculture" },
        { value: "Finance", label: "Finance" },
        { value: "Housing", label: "Housing" },
        { value: "Transport", label: "Transport" },
      ],
    },
  ],
  apex: [
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }, ...COOPERATIVES.slice(0, 10).map((c) => ({ value: c.id, label: c.name }))],
    },
    {
      id: "region",
      label: "Region",
      options: [
        { value: "all", label: "All Regions" },
        { value: "Manzini", label: "Manzini" },
        { value: "Hhohho", label: "Hhohho" },
        { value: "Shiselweni", label: "Shiselweni" },
        { value: "Lubombo", label: "Lubombo" },
      ],
    },
    {
      id: "sector",
      label: "Sector",
      options: [
        { value: "all", label: "All Sectors" },
        { value: "Agriculture", label: "Agriculture" },
        { value: "Finance", label: "Finance" },
        { value: "Housing", label: "Housing" },
      ],
    },
  ],
  cooperative: [
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
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Helper: compute multiplier from active filters
// ─────────────────────────────────────────────────────────────────────

function getFilterMultiplier(filterValues: Record<string, string>): number {
  let mult = 1.0;
  for (const [key, value] of Object.entries(filterValues)) {
    if (value === "all" || value === "ytd") continue;
    // Prefix the value based on filter type to match entityMultiplier keys
    const prefixedKey = key === "federation" ? `fed_${value}`
      : key === "apex" ? value // apex IDs already have 'a' prefix
      : key === "cooperative" ? `coop_${value}`
      : value;
    const m = entityMultiplier[prefixedKey] ?? regionMultiplier[value] ?? sectorMultiplier[value] ?? 1.0;
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

const SPARKLINE_GROWTH = [
  { value: 10 }, { value: 12 }, { value: 11 }, { value: 14 }, { value: 13 }, { value: 16 }, { value: 15 }, { value: 18 }
];
const SPARKLINE_MEMBERS = [
  { value: 100 }, { value: 105 }, { value: 112 }, { value: 110 }, { value: 118 }, { value: 124 }, { value: 130 }, { value: 135 }
];
const SPARKLINE_SECTORS = [
  { value: 4 }, { value: 5 }, { value: 5 }, { value: 6 }, { value: 6 }, { value: 7 }, { value: 7 }, { value: 8 }
];
const SPARKLINE_COMPLIANCE = [
  { value: 91 }, { value: 92 }, { value: 91.5 }, { value: 93 }, { value: 92.8 }, { value: 92.4 }, { value: 93.1 }, { value: 92.4 }
];

// ─────────────────────────────────────────────────────────────────────
// Analytics Page Component
// ─────────────────────────────────────────────────────────────────────
function AnalyticsPage() {
  const { role } = useAuth();
  const filters = FILTERS_BY_ROLE[role];
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

  const activeFilterCount = Object.values(filterValues).filter((v) => v !== "all" && v !== "ytd").length;

  const handleFilterChange = useCallback((filterId: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues(Object.fromEntries(filters.map((f) => [f.id, f.options[0].value])));
  }, [filters]);

  // ── Reactive data ──
  const multiplier = useMemo(() => getFilterMultiplier(filterValues), [filterValues]);

  const localGrowthTrend = useMemo(() => [
    { month: "Jan", members: 2100000, savings: 1100, loans: 580 },
    { month: "Feb", members: 2250000, savings: 780, loans: 620 },
    { month: "Mar", members: 1850000, savings: 950, loans: 820 },
    { month: "Apr", members: 1550000, savings: 1300, loans: 680 },
    { month: "May", members: 1750000, savings: 980, loans: 380 },
    { month: "Jun", members: 1650000, savings: 650, loans: 420 },
    { month: "Jul", members: 1480000, savings: 880, loans: 520 },
    { month: "Aug", members: 1420000, savings: 720, loans: 560 },
    { month: "Sep", members: 1050000, savings: 1120, loans: 560 },
    { month: "Oct", members: 1050000, savings: 800, loans: 720 },
    { month: "Nov", members: 1250000, savings: 730, loans: 540 },
    { month: "Dec", members: 1100000, savings: 750, loans: 560 },
  ], []);

  const filteredGrowthTrend = useMemo(() => {
    const filtered = filterByDateRange(
      localGrowthTrend.map((d) => ({ ...d, date: `2025-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(d.month) + 1}-15` })),
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
    return { savings: last.savings as number, loans: last.loans as number, members: last.members as number };
  }, [periodSlice]);


  const filteredMonthlyFinancials = useMemo(() => {
    const filtered = filterByDateRange(baseMonthlyFinancials, "date", dateRange);
    const multiplied = applyMultiplier(filtered, ["savings", "loans", "deposits"], multiplier);
    return multiplied.map((item, idx) => {
      // Smooth, elegant seasonal wave with realistic peaks in May/Nov and troughs in Aug/Dec
      const customVariations = [650, 580, 720, 850, 920, 780, 610, 520, 690, 830, 950, 480];
      return {
        ...item,
        variation: Math.round(customVariations[idx % customVariations.length] * multiplier),
      };
    });
  }, [dateRange, multiplier]);

  const filteredSubmissionTrend = useMemo(() => {
    const filtered = filterByDateRange(baseSubmissionTrend, "monthDate", dateRange);
    return applyMultiplier(filtered, ["onTime", "late"], multiplier).map((item) => ({
      ...item,
      onTime: Math.min((item.onTime as number), 100),
      late: Math.min((item.late as number), 100),
    }));
  }, [dateRange, multiplier]);

  const filteredMembershipGrowth = useMemo(
    () => applyMultiplier(baseMembershipGrowth, ["members", "youth", "women"], multiplier),
    [multiplier],
  );

  const filteredRegionCompliance = useMemo(
    () => applyMultiplier(baseRegionCompliance, ["coops"], multiplier),
    [multiplier],
  );

  const filteredLoanPortfolio = useMemo(() => {
    // Adjust portfolio quality based on entity selection
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
  }, [multiplier]);

  const filteredSectorBreakdown = useMemo(() => {
    if (multiplier >= 1.0) return SECTOR_BREAKDOWN;
    return SECTOR_BREAKDOWN.map((item) => ({
      ...item,
      value: Math.max(1, Math.round(item.value * (0.5 + multiplier * 0.5))),
      count: Math.round(item.count * multiplier),
    }));
  }, [multiplier]);

  const filteredPerformers = useMemo(() => {
    if (multiplier >= 1.0) return PERFORMERS;
    return PERFORMERS.map((p) => ({
      ...p,
      s: Math.max(60, Math.round(p.s * (0.85 + multiplier * 0.15))),
    }));
  }, [multiplier]);

  const filteredComplianceScore = useMemo(() => {
    const base = 92.4;
    if (multiplier >= 1.0) return base;
    return Math.max(75, Math.round((base * (0.9 + multiplier * 0.1)) * 10) / 10);
  }, [multiplier]);

  // Merged comparison data: current period savings vs previous year
  const mergedCompData = useMemo(() => {
    const sliceMap: Record<string, number> = { Week: 2, Month: 4, Quarter: 3, Year: 12 };
    const n = sliceMap[compPeriod] ?? 12;
    return filteredMonthlyFinancials.slice(-n).map((curr, i) => ({
      month: curr.month,
      "This Period": curr.savings as number,
      "Last Period": Math.round((basePrevPeriodFinancials.slice(-n)[i]?.savings ?? 0) * Math.max(multiplier, 0.3)),
      "This Period Loans": curr.loans as number,
      "Last Period Loans": Math.round((basePrevPeriodFinancials.slice(-n)[i]?.loans ?? 0) * Math.max(multiplier, 0.3)),
    }));
  }, [filteredMonthlyFinancials, compPeriod, multiplier]);

  // Multi-region trend (scaled by multiplier)
  const filteredRegionTrend = useMemo(
    () => applyMultiplier(baseRegionTrendData, ["Hhohho", "Manzini", "Lubombo", "Shiselweni"], multiplier),
    [multiplier],
  );

  const filteredKPIs = useMemo(() => {
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
        const suffix = kpi.value.includes("M") ? "M" : kpi.value.includes("B") ? "B" : kpi.value.includes("K") ? "K" : "";
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
  }, [role, multiplier]);

  const genderData = [
    { name: "Women", value: multiplier >= 1.0 ? 54.1 : Math.round((54.1 * (0.95 + multiplier * 0.05)) * 10) / 10, fill: "var(--chart-1)" },
    { name: "Men", value: multiplier >= 1.0 ? 38.4 : Math.round((38.4 * (0.95 + multiplier * 0.05)) * 10) / 10, fill: "var(--chart-2)" },
    { name: "Non-binary / Undisclosed", value: multiplier >= 1.0 ? 7.5 : Math.round((7.5 * (1.1 - multiplier * 0.1)) * 10) / 10, fill: "var(--chart-3)" },
  ];

  const youthData = REGIONS.map((r) => ({
    name: r.name,
    youth: Math.round(25 + r.growth * 4 * (0.9 + multiplier * 0.1)),
    adult: Math.round(70 - r.growth * 2 * (0.9 + multiplier * 0.1)),
  }));

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-6">
        {/* ── Role Badge ── */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${roleBadge[role].color}`}>
            <span className="size-1.5 rounded-full bg-current opacity-70" />
            {roleBadge[role].label}
          </span>
          <span className="text-xs text-muted-foreground">Live data · Updated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
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
                <span className="text-[10px] uppercase tracking-wider text-primary/60">{filter?.label}:</span>
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
                <h3 className="font-heading font-bold text-sm text-foreground">
                  Filter Analytics
                </h3>
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
            role === "ministry" ? "National Network Overview"
            : role === "federation" ? "Federation Network Summary"
            : role === "apex" ? "Apex Network Summary"
            : "Your Cooperative At a Glance"
          }
          subtitle="Key operational indicators for the current period"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {networkSummaryByRole[role].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="font-heading text-2xl font-bold text-foreground num">{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{item.sub}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Role-Specific KPI Hero Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {filteredKPIs.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-border bg-surface p-4 hover-lift shadow-[var(--shadow-elev-1)] group cursor-default"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="size-8 rounded-lg grid place-items-center bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors">
                  <metric.icon className="size-4" />
                </div>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                  metric.up ? "text-success" : "text-destructive"
                }`}>
                  {metric.up
                    ? <ArrowUpRight className="size-3" />
                    : <ArrowDownRight className="size-3" />
                  }
                  {metric.change}
                </span>
              </div>
              <p className="font-heading text-xl font-bold text-foreground num leading-none">{metric.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5 leading-tight">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* ── Secondary KPI Insight Cards with Sparklines ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="YoY Growth"
            value={multiplier >= 1.0 ? "+12.4%" : `+${(12.4 * (0.7 + multiplier * 0.3)).toFixed(1)}%`}
            subtitle="vs same period last year"
            tone="success"
          >
            <div className="h-10 w-[calc(100%+2.5rem)] mt-4 -mx-5 -mb-5 opacity-85">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SPARKLINE_GROWTH} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spark-growth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--success)" strokeWidth={1.5} fill="url(#spark-growth)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>
          <StatCard
            icon={Users}
            label="Total Members"
            value={multiplier >= 1.0 ? "2.4M" : `${(2.4 * Math.max(multiplier, 0.1)).toFixed(1)}M`}
            subtitle="Active cooperative members"
            tone="primary"
          >
            <div className="h-10 w-[calc(100%+2.5rem)] mt-4 -mx-5 -mb-5 opacity-85">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SPARKLINE_MEMBERS} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spark-members" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={1.5} fill="url(#spark-members)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>
          <StatCard
            icon={PieChartIcon}
            label="Sector Diversity"
            value={multiplier >= 1.0 ? "8 sectors" : `${Math.max(3, Math.round(8 * multiplier))} sectors`}
            subtitle="Active industry groups"
            tone="info"
          >
            <div className="h-10 w-[calc(100%+2.5rem)] mt-4 -mx-5 -mb-5 opacity-85">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SPARKLINE_SECTORS} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spark-sectors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--info)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--info)" strokeWidth={1.5} fill="url(#spark-sectors)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>
          <StatCard
            icon={BarChart3}
            label="Avg Compliance"
            value={`${filteredComplianceScore}%`}
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
          >
            <div className="h-10 w-[calc(100%+2.5rem)] mt-4 -mx-5 -mb-5 opacity-85">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SPARKLINE_COMPLIANCE} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spark-compliance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={1.5} fill="url(#spark-compliance)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>
        </div>

        {/* ── Pro Line Chart + 3D Pie ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Premium Area/Line Chart with period selector ── */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
            {/* Header: stats + period toggle */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Portfolio Overview</p>
                <p className="font-heading text-2xl font-bold text-foreground num">
                  {role === "cooperative" ? `$${portfolioTotal.savings.toLocaleString()}K` : formatNumber(portfolioTotal.members)}
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
                    labelStyle={{ fontWeight: "700", color: "var(--foreground)", marginBottom: "6px", fontSize: "13px" }}
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
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
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" }}
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
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-2)" }}
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
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-3)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gender Participation — 2D Doughnut */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gender Participation</p>
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
                <span className="font-heading text-xl font-bold text-foreground num leading-none">54.1%</span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">Women</span>
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
              <ComposedChart data={filteredMonthlyFinancials} margin={{ top: 16, right: 24, left: -10, bottom: 0 }} barGap={3} barCategoryGap="28%">
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.6} />
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
                  labelStyle={{ fontWeight: "700", color: "var(--foreground)", marginBottom: "6px", fontSize: "13px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}
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
                <Bar yAxisId="left" dataKey="savings" fill="url(#bar-savings-grad)" name="Savings" barSize={14} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="loans" fill="url(#bar-loans-grad)" name="Loans" barSize={14} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="deposits" fill="url(#bar-deposits-grad)" name="Deposits" barSize={14} radius={[3, 3, 0, 0]} />
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
                  activeDot={{ r: 7, strokeWidth: 2.5, stroke: "var(--chart-4)", fill: "var(--surface)" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Sector Pie + Youth Stacked Bar ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sector Capital Share — 2D Doughnut (or simple card for cooperative) */}
          {role === "cooperative" ? (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Sector</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cooperative classification</p>
              </div>
              <div className="my-6 flex flex-col items-center">
                <div className="size-16 rounded-full bg-accent/10 grid place-items-center">
                  <BarChart3 className="size-7 text-accent" />
                </div>
                <p className="font-heading text-2xl font-bold text-foreground mt-4">Agricultural</p>
                <p className="text-sm text-muted-foreground mt-1">Financial SACCOs sector</p>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capital share</span>
                  <span className="font-bold num text-foreground">42%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sector avg. compliance</span>
                  <span className="font-bold num text-foreground">91.8%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cooperatives in sector</span>
                  <span className="font-bold num text-foreground">5,394</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sector Capital Share</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Share of portfolio by sector</p>
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
                        <Cell key={i} fill="var(--accent)" fillOpacity={sectorOpacities[i] ?? 0.3} />
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
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">Sectors</span>
              </div>
            </div>
            <ul className="space-y-1.5 border-t border-border pt-3 mt-2">
              {filteredSectorBreakdown.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-sm shrink-0" style={{ background: "var(--accent)", opacity: sectorOpacities[i] ?? 0.3 }} />
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
            subtitle={role === "cooperative" ? "Youth vs adult member composition" : "% of members under 35 years old"}
          >
            {role === "cooperative" ? (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[{ name: "Your Co-op", youth: 39.9, adult: 60.1 }]}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} width={70} />
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
                      labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Bar dataKey="youth" fill="var(--accent)" fillOpacity={1} radius={[0, 0, 0, 0]} barSize={28} name="Youth (< 35)" />
                    <Bar dataKey="adult" fill="var(--accent)" fillOpacity={0.3} radius={[0, 6, 6, 0]} barSize={28} name="Adult (35+)" />
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
                      labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
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

        {/* ── Membership Horizontal Bar + Loan Portfolio Pie + Compliance Radial ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card title={role === "cooperative" ? "Membership Growth" : "Membership Growth"} subtitle={role === "cooperative" ? "Your cooperative's 5-year trend" : "5-year trend with demographics"}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={role === "cooperative" ? coopMembershipHistory : filteredMembershipGrowth}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, "dataMax"]} stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tickFormatter={(v) => role === "cooperative" ? v.toLocaleString() : `${(v / 1000000).toFixed(1)}M`} />
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
                    labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                    formatter={(value: number) => [formatNumber(value)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {role === "cooperative" ? (
                    <>
                      <Bar dataKey="women" fill="var(--accent)" fillOpacity={1} radius={[0, 3, 3, 0]} name="Women" barSize={10} />
                      <Bar dataKey="youth" fill="var(--accent)" fillOpacity={0.6} radius={[0, 3, 3, 0]} name="Youth" barSize={10} />
                      <Bar dataKey="members" fill="var(--accent)" fillOpacity={0.3} radius={[0, 3, 3, 0]} name="Total" barSize={10} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="women" fill="var(--chart-1)" radius={[0, 3, 3, 0]} name="Women" barSize={10} />
                      <Bar dataKey="youth" fill="var(--chart-3)" radius={[0, 3, 3, 0]} name="Youth" barSize={10} />
                      <Bar dataKey="members" fill="var(--chart-2)" radius={[0, 3, 3, 0]} name="Total" barSize={10} />
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
                    labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[20px] font-bold text-success leading-none">82%</span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1">Performing</span>
              </div>
            </div>
            <ul className="space-y-2 border-t border-border pt-3 mt-1">
              {filteredLoanPortfolio.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-sm shrink-0" style={{ background: item.fill }} />
                    {item.name}
                  </span>
                  <span className="font-bold num text-foreground">{item.value}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Compliance Score" subtitle={
            role === "cooperative" ? "Your current rating" : "Aggregate compliance rating"
          }>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="85%" barSize={10} data={[{ name: "Compliance", value: filteredComplianceScore, fill: "var(--chart-1)" }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={10} fill="var(--chart-1)" background={{ fill: "var(--muted)", opacity: 0.15 }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-4">
              <p className="font-heading text-4xl font-bold text-foreground num">{filteredComplianceScore}%</p>
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
            subtitle={role === "cooperative" ? "Monthly compliance score over the year" : "Compliance score by region"}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {role === "cooperative" ? (
                  <AreaChart data={coopComplianceTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="coop-comp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} />
                    <YAxis domain={[85, 100]} stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
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
                      labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Area type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} fill="url(#coop-comp)" dot={{ r: 3, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--accent)" }} name="Compliance" />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={filteredRegionCompliance}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={[80, 100]} stroke="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
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
                      labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Bar dataKey="score" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={24} name="Compliance %" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Submission Timeliness"
            subtitle="% of on-time vs late submissions"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredSubmissionTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: "var(--muted-foreground)" }} />
                  <Area dataKey="onTime" fill="var(--chart-1)" fillOpacity={0.06} stroke="var(--chart-1)" strokeWidth={2} name="On Time" />
                  <Area dataKey="late" fill="var(--chart-4)" fillOpacity={0.06} stroke="var(--chart-4)" strokeWidth={2} name="Late" />
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
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Portfolio Savings — Period Comparison</p>
              <div className="flex items-center gap-5 mt-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block w-6 h-0.5 rounded-full bg-[var(--chart-1)]" />
                  This Period
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <svg width="24" height="4" className="shrink-0"><line x1="0" y1="2" x2="24" y2="2" stroke="var(--chart-4)" strokeWidth="2" strokeDasharray="5 3" /></svg>
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
              <AreaChart data={mergedCompData} margin={{ top: 10, right: 24, left: -10, bottom: 0 }}>
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
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.6} />
                <XAxis dataKey="month" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${v}K`} />
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
                  labelStyle={{ fontWeight: "700", color: "var(--foreground)", marginBottom: "6px", fontSize: "13px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}
                  formatter={(value: number, name: string) => [`$${value}K`, name]}
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
                />
                {/* Current period — solid with visible dots */}
                <Area
                  type="monotone"
                  dataKey="This Period"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#comp-curr)"
                  dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-1)" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" }}
                />
                {/* Previous period — dashed with visible dots */}
                <Area
                  type="monotone"
                  dataKey="Last Period"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  fill="url(#comp-prev)"
                  dot={{ r: 3.5, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-4)" }}
                  activeDot={{ r: 5.5, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-4)" }}
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
                {role === "cooperative" ? "Your cooperative's monthly trend" : "Jan – Dec 2025 · Across all regions"}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              Jan 1 – Dec 31
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {role === "cooperative" ? (
                <AreaChart data={coopMonthlyTrend} margin={{ top: 10, right: 24, left: -10, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.6} />
                  <XAxis dataKey="month" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                  <YAxis yAxisId="left" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${v}K`} />
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
                    labelStyle={{ fontWeight: "700", color: "var(--foreground)", marginBottom: "6px", fontSize: "13px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-sans)", paddingTop: "12px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="members" stroke="var(--accent)" strokeWidth={2} fill="url(#coop-members)" dot={{ r: 3, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--accent)" }} name="Members" />
                  <Area yAxisId="right" type="monotone" dataKey="savings" stroke="var(--success)" strokeWidth={2} fill="url(#coop-savings)" dot={{ r: 3, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--success)" }} name="Savings ($K)" />
                </AreaChart>
              ) : (
                <AreaChart data={filteredRegionTrend} margin={{ top: 10, right: 24, left: -10, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.6} />
                  <XAxis dataKey="month" fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                  <YAxis fontSize={11} fontFamily="var(--font-sans)" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatNumber(v as number)} />
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
                    labelStyle={{ fontWeight: "700", color: "var(--foreground)", marginBottom: "6px", fontSize: "13px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-sans)", paddingTop: "12px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area dataKey="Hhohho" stroke="var(--chart-1)" strokeWidth={2} fill="url(#region-h)" type="monotone" dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-1)" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" }} />
                  <Area dataKey="Manzini" stroke="var(--chart-2)" strokeWidth={2} fill="url(#region-m)" type="monotone" dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-2)" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-2)" }} />
                  <Area dataKey="Lubombo" stroke="var(--chart-3)" strokeWidth={2} fill="url(#region-l)" type="monotone" dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-3)" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-3)" }} />
                  <Area dataKey="Shiselweni" stroke="var(--chart-4)" strokeWidth={2} fill="url(#region-s)" type="monotone" dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-4)" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-4)" }} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        </div>{/* end side-by-side grid */}

        {/* ── Performance Score (leaderboard for admin, metrics for cooperative) ── */}
        {role === "cooperative" ? (
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <p className="text-sm font-bold text-foreground">Your Performance Metrics</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Key performance indicators for your cooperative</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
              {coopPerformanceMetrics.map((m) => (
                <div key={m.label} className="bg-surface p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className="font-heading text-2xl font-bold text-foreground num mt-2">{m.value}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-xs font-semibold ${m.up ? "text-success" : "text-warning-foreground"}`}>
                      {m.up ? "↑" : "↓"} {m.trend}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{m.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
          {/* Section Header */}
          <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground">Performance Score — Top Cooperatives</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Composite score based on compliance, portfolio quality, and member engagement</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              FY 2025
            </span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[3rem_1fr_auto_6rem_4rem] items-center gap-4 px-6 py-3 bg-muted/30 border-b border-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cooperative</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Sector</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Performance</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Score</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filteredPerformers.map((c, i) => {
              const scorePct = c.s;
              const isTop = scorePct >= 90;
              const isMid = scorePct >= 80 && scorePct < 90;
              const barColor = isTop ? "var(--success)" : isMid ? "var(--chart-3)" : "var(--destructive)";
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
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black shadow-sm ${rankColors[i]}`}>
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
                    <p className="text-sm font-semibold text-foreground truncate leading-snug">{c.n}</p>
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
      </div>
    </AppShell>
  );
}