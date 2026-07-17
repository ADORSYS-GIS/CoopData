import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { KpiChipGrid } from "@/components/analytics/KpiChipGrid";
import { DormancyLeaderboard } from "@/components/analytics/DormancyLeaderboard";
import { LoanDualBar } from "@/components/analytics/LoanDualBar";
import { SavingsRadialGauges } from "@/components/analytics/SavingsRadialGauges";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { ComplianceStackedBars } from "@/components/analytics/ComplianceStackedBars";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { useBenchmarks } from "@/hooks/analytics/useBenchmarks";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import type { BenchmarkResponse } from "@/hooks/analytics/useBenchmarks";
import { type Role, useUserRole } from "@/lib/auth";
import { useLatestSubmission } from "@/hooks/submissions/useLatestSubmission";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useApexSubmissionKpis } from "@/hooks/submissions/useApexSubmissionKpis";
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
import { useNfTrend } from "@/hooks/analytics/useNfTrend";
import { useSubmissionActivity } from "@/hooks/analytics/useSubmissionActivity";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useMyCooperativeProfile, useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { useFederations } from "@/hooks/federations/useFederations";
import { useApexes } from "@/hooks/apexes/useApexes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Calendar,
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

// Local number formatter — replaces the one from mock-data
function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────
// Cooperative chart data — empty until useMonthlyTrend (Sprint 5)
// ─────────────────────────────────────────────────────────────────────
// NOTE: These charts require a time-series backend endpoint not yet built.
// They will be replaced by real data in Sprint 5 via useMonthlyTrend.
const coopComplianceTrend: { month: string; score: number }[] = [];
const coopMonthlyTrend: { month: string; members: number; savings: number }[] = [];
const coopPerformanceMetrics: {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  desc: string;
}[] = [];

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
    ...cooperatives.map((c) => ({ value: String(c.id), label: c.name })),
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
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: String(currentYear + 1), label: String(currentYear + 1) },
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear - 1), label: String(currentYear - 1) },
    { value: String(currentYear - 2), label: String(currentYear - 2) },
    { value: String(currentYear - 3), label: String(currentYear - 3) },
  ];

  if (role === "ministry") {
    return [
      { id: "year", label: "Reporting Year", options: yearOptions },
      { id: "federation", label: "Federation", options: federationOptions },
      { id: "apex", label: "Apex", options: apexOptions },
      { id: "cooperative", label: "Cooperative", options: coopOptions },
      { id: "region", label: "Region", options: regionOptions },
      { id: "sector", label: "Sector", options: sectorOptions },
    ];
  }
  if (role === "federation") {
    return [
      { id: "year", label: "Reporting Year", options: yearOptions },
      { id: "apex", label: "Apex", options: apexOptions },
      { id: "cooperative", label: "Cooperative", options: coopOptions },
      { id: "region", label: "Region", options: regionOptions },
      { id: "sector", label: "Sector", options: sectorOptions },
    ];
  }
  if (role === "apex") {
    return [
      { id: "year", label: "Reporting Year", options: yearOptions },
      { id: "cooperative", label: "Cooperative", options: coopOptions },
    ];
  }
  return [{ id: "year", label: "Reporting Year", options: yearOptions }];
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
  const navigate = useNavigate();

  // ── Filter state (year drives reportingYear for all hooks) ──
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    year: String(new Date().getFullYear()),
    region: "all",
    sector: "all",
    federationId: "all",
    apexId: "all",
    cooperativeId: "all",
  });
  const currentYear = Number(filterValues.year) || new Date().getFullYear();
  const isCooperative = role === "cooperative";

  // ── Real data hooks (cooperative role) ──
  // latestSubmission is scoped to the selected year so analytics only show
  // data from an approved submission of that exact year.
  const latestSubmission = useLatestSubmission(isCooperative ? currentYear : undefined);
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(
    isCooperative ? latestSubmission?.id : undefined,
  );

  // ── Benchmark data for cooperative insight panel ──
  // Fetch benchmarks for the KPIs that have sector thresholds defined.
  // These calls are only enabled when the user is cooperative role.
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

  // ── 1. Fetch lists for dropdowns (admin roles) ──
  const isMinistry = role === "ministry";
  const isFederation = role === "federation";
  const isApex = role === "apex";

  const federationsData = useFederations().data ?? [];
  const apexesData = useApexes().data ?? [];
  const cooperativesData = useCooperatives().data ?? [];

  const filters = useMemo<FilterConfig[]>(() => {
    if (!role) return [];
    return buildFiltersByRole(role, federationsData, apexesData, cooperativesData);
  }, [role, federationsData, apexesData, cooperativesData]);

  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState<"1D" | "5D" | "1M" | "1Y">("1Y");
  const [compPeriod, setCompPeriod] = useState<"Week" | "Month" | "Quarter" | "Year">("Year");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(2025, 0, 1),
    to: new Date(),
  });

  const defaultYear = String(new Date().getFullYear());
  const activeFilterCount = Object.entries(filterValues).filter(
    ([key, v]) => key !== "year" && v !== "all" && v !== "ytd",
  ).length;

  const handleFilterChange = useCallback((filterId: string, value: string) => {
    // Map internal filterIds to the state keys
    const key =
      filterId === "federation"
        ? "federationId"
        : filterId === "apex"
          ? "apexId"
          : filterId === "cooperative"
            ? "cooperativeId"
            : filterId;
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues({
      year: String(new Date().getFullYear()),
      region: "all",
      sector: "all",
      federationId: "all",
      apexId: "all",
      cooperativeId: "all",
    });
  }, []);

  // ── Real data hooks (ministry/apex roles) ──
  const ministryStats = useMinistryStats(role === "ministry").data;
  const apexStats = useApexStats(role === "apex").data;
  const federationStats = useFederationStats(role === "federation").data;
  const federationSubmissions = useFederationSubmissions(role === "federation").data ?? [];
  const { data: apexSubmissionsData, isLoading: isApexSubmissionsLoading } = useApexSubmissions(
    role === "apex",
  );
  const apexSubmissions = apexSubmissionsData ?? [];

  // ── Analytics data hooks (with dynamic filters!) ──
  const regionComplianceData = useRegionCompliance(!!role, filterValues).data;
  const sectorBreakdownData = useSectorBreakdown(!!role, filterValues).data;

  // For the cooperative role, only fetch chart data when there is an
  // approved submission for the selected year. Without this gate, the
  // backend would return data from ANY year when no submission_id is
  // provided, leaking data from a different year into the selected year view.
  const coopHasApprovedSubmission = isCooperative ? !!latestSubmission : true;

  const { data: myCoopProfile } = useMyCooperativeProfile();

  const monthlyTrendParams = useMemo(() => {
    const baseParams = {
      reportingYear: currentYear,
      region: filterValues.region,
      sector: filterValues.sector,
      federationId: filterValues.federationId,
      // For apex role, the backend already scopes to the apex's cooperatives via
      // resolve_caller_cooperative_ids. We just need to pass the year.
      // If a specific cooperative is selected, scope to that coop only.
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
    };
    if (role === "cooperative" && myCoopProfile) {
      baseParams.cooperativeId = myCoopProfile.id;
    }
    // For apex role, never pass apexId (the backend auto-scopes via auth)
    if (role !== "apex") {
      Object.assign(baseParams, { apexId: filterValues.apexId });
    }
    return baseParams;
  }, [role, currentYear, myCoopProfile, filterValues]);

  // ── NF Statistics (real data from uploaded NF databases) ──
  // We always fetch when role is set so the query key stays stable, but we
  // explicitly override to undefined when no approved submission for the year.
  // This defeats React Query's stale-cache problem: even when `enabled:false`,
  // RQ still returns the last cached value — so we must null it out manually.
  const _nfStatsRaw = useNfStatistics(
    isCooperative,
    monthlyTrendParams,
    !!role && coopHasApprovedSubmission,
  ).data;
  const nfStats = isCooperative && !coopHasApprovedSubmission ? undefined : _nfStatsRaw;

  // ── National Overview (aggregated KPI traffic-light for admin roles) ──
  const nationalOverview = useNationalOverview(
    role === "ministry" || role === "federation" || role === "apex",
    currentYear,
  ).data;

  const { data: _monthlyTrendRaw } = useMonthlyTrend(
    monthlyTrendParams,
    !!role && coopHasApprovedSubmission,
  );
  const monthlyTrendData =
    isCooperative && !coopHasApprovedSubmission ? undefined : _monthlyTrendRaw;

  const { data: submissionActivityData } = useSubmissionActivity(currentYear, !!role);

  const nfTrendParams = useMemo(() => {
    if (role === "cooperative") {
      return { cooperativeId: latestSubmission?.cooperative_id };
    }
    return {};
  }, [role, latestSubmission?.cooperative_id]);
  const { data: _nfTrendRaw } = useNfTrend(nfTrendParams, !!role && coopHasApprovedSubmission);
  const nfTrendData = isCooperative && !coopHasApprovedSubmission ? undefined : _nfTrendRaw;

  // ── Apex deep-dive: per-coop analytics hooks ──
  const hasSelectedCoop = isApex && filterValues.cooperativeId !== "all";
  const selectedCoopId = hasSelectedCoop ? filterValues.cooperativeId : null;

  const deepDiveTrendParams = useMemo(
    () => ({
      reportingYear: currentYear,
      cooperativeId: selectedCoopId ?? undefined,
    }),
    [currentYear, selectedCoopId],
  );

  const { data: deepDiveTrend, isLoading: isDeepDiveTrendLoading } = useMonthlyTrend(
    deepDiveTrendParams,
    !!selectedCoopId,
  );
  const { data: deepDiveNfStats, isLoading: isDeepDiveNfLoading } = useNfStatistics(
    false,
    { ...deepDiveTrendParams, region: "all", sector: "all", federationId: "all", apexId: "all" },
    !!selectedCoopId,
  );

  // Check if there's ANY submission (approved or not) for the selected coop+year
  const deepDiveAnySubmission = useMemo(() => {
    if (!selectedCoopId) return undefined;
    return apexSubmissions.find(
      (s) => s.cooperative_id === selectedCoopId && s.reporting_year === currentYear,
    );
  }, [apexSubmissions, selectedCoopId, currentYear]);

  // Gate all deep-dive data loading on submissions + trend + NF stats
  const deepDiveLoading = isDeepDiveTrendLoading || isDeepDiveNfLoading || isApexSubmissionsLoading;
  const deepDiveHasNoData =
    !!selectedCoopId && !deepDiveLoading && !deepDiveTrend?.months?.length && !deepDiveNfStats;

  const deepDiveMonthly = useMemo(() => {
    if (!deepDiveTrend?.months) return [];
    return deepDiveTrend.months.map((m) => ({
      month: m.month_label,
      savings: Math.round(m.savings / 1000),
      loans: Math.round(m.loans / 1000),
      assets: Math.round(m.assets / 1000),
    }));
  }, [deepDiveTrend]);

  const selectedCoopProfile = useMemo(
    () => cooperativesData.find((c) => c.id === selectedCoopId) ?? null,
    [cooperativesData, selectedCoopId],
  );

  // Find the approved submission for the selected coop + year so we can
  // fetch financial KPIs that match exactly what the cooperative sees.
  const deepDiveSubmission = useMemo(() => {
    if (!selectedCoopId) return undefined;
    const approved = apexSubmissions.filter(
      (s) =>
        s.cooperative_id === selectedCoopId &&
        s.reporting_year === currentYear &&
        s.status.toLowerCase() === "approved",
    );
    if (approved.length === 0) return undefined;
    return [...approved].sort((a, b) => b.reporting_year - a.reporting_year)[0];
  }, [apexSubmissions, selectedCoopId, currentYear]);

  const { data: deepDiveKpis, isLoading: isDeepDiveKpisLoading } = useApexSubmissionKpis(
    deepDiveSubmission?.id,
  );

  // Filter state definition moved UP to top of component so it can feed hooks

  // ── Reactive data ──
  const localGrowthTrend = useMemo(() => {
    // No approved submission for selected year → return empty so charts show
    // no data rather than a misleading flat $0K line.
    if (isCooperative && !coopHasApprovedSubmission) return [];
    if (monthlyTrendData?.months) {
      return monthlyTrendData.months.map((m) => ({
        month: m.month_label,
        savings: Math.round(m.savings / 1000),
        loans: Math.round(m.loans / 1000),
        assets: Math.round(m.assets / 1000),
      }));
    }
    return [
      { month: "Jan", assets: 0, savings: 0, loans: 0 },
      { month: "Feb", assets: 0, savings: 0, loans: 0 },
      { month: "Mar", assets: 0, savings: 0, loans: 0 },
      { month: "Apr", assets: 0, savings: 0, loans: 0 },
      { month: "May", assets: 0, savings: 0, loans: 0 },
      { month: "Jun", assets: 0, savings: 0, loans: 0 },
      { month: "Jul", assets: 0, savings: 0, loans: 0 },
      { month: "Aug", assets: 0, savings: 0, loans: 0 },
      { month: "Sep", assets: 0, savings: 0, loans: 0 },
      { month: "Oct", assets: 0, savings: 0, loans: 0 },
      { month: "Nov", assets: 0, savings: 0, loans: 0 },
      { month: "Dec", assets: 0, savings: 0, loans: 0 },
    ];
  }, [monthlyTrendData, isCooperative, coopHasApprovedSubmission]);

  const filteredGrowthTrend = useMemo(() => {
    const filtered = filterByDateRange(
      localGrowthTrend.map((d) => ({
        ...d,
        date: `2025-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(d.month) + 1}-15`,
      })),
      "date",
      dateRange,
    );
    return filtered;
  }, [dateRange, localGrowthTrend]);

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
    if (!last) return { savings: 0, loans: 0, assets: 0 };
    return {
      savings: last.savings as number,
      loans: last.loans as number,
      assets: last.assets as number,
    };
  }, [periodSlice]);

  // ── Unified Consolidated Network Summary ──
  // Replaces the old ministry/federation/apex/coop separate summaries
  const consolidatedNetworkSummary: { label: string; value: string; sub: string }[] = [
    {
      label: "Network Cooperatives",
      value:
        role === "ministry"
          ? (ministryStats?.total_cooperatives ?? 0).toLocaleString()
          : role === "federation"
            ? (federationStats?.cooperative_count ?? 0).toLocaleString()
            : role === "apex"
              ? (apexStats?.total_cooperatives ?? 0).toLocaleString()
              : myCoopProfile
                ? "1"
                : "—",
      sub: "Total registered in network",
    },
    {
      label: "Total Network Members",
      value: nfStats ? nfStats.membership.total.toLocaleString() : "—",
      sub: "Aggregated from databases",
    },
    {
      label: "Consolidated Assets",
      value: portfolioTotal.assets > 0 ? formatNumber(portfolioTotal.assets) : "—",
      sub: "Balance sheet value",
    },
    {
      label: "Approved Submissions",
      value:
        role === "ministry"
          ? (ministryStats?.approved_count ?? 0).toLocaleString()
          : role === "federation"
            ? (federationStats?.approved_count ?? 0).toLocaleString()
            : role === "apex"
              ? (apexStats?.approved_submissions ?? 0).toLocaleString()
              : (coopStats?.approved_submissions.toString() ?? "—"),
      sub: "Finalized returns",
    },
    {
      label: "Average Capital Adequacy",
      value: nationalOverview?.distributions?.["capital_adequacy_ratio"]
        ? `${Math.round((nationalOverview?.distributions?.["capital_adequacy_ratio"]?.green_pct ?? 0) + (nationalOverview?.distributions?.["capital_adequacy_ratio"]?.amber_pct ?? 0))}%`
        : (kpisData?.kpis.find((k) => k.name === "capital_adequacy_ratio")?.formatted ?? "—"),
      sub: "Target threshold: >10%",
    },
    {
      label: "Average NPL Ratio",
      value: nationalOverview?.distributions?.["npl_ratio"]
        ? `${Math.round(nationalOverview?.distributions?.["npl_ratio"]?.red_pct ?? 0)}% Risk`
        : (kpisData?.kpis.find((k) => k.name === "npl_ratio")?.formatted ?? "—"),
      sub: "Non-performing loans",
    },
  ];

  const filteredMonthlyFinancials = useMemo(() => {
    if (monthlyTrendData?.months) {
      return monthlyTrendData.months.map((m) => ({
        month: m.month_label,
        monthShort: m.month_label,
        savings: Math.round(m.savings / 1000),
        loans: Math.round(m.loans / 1000),
        assets: Math.round(m.assets / 1000),
        variation: Math.round((m.savings / 1000) * 0.1),
        date: `${monthlyTrendData.year}-${String(m.month).padStart(2, "0")}-15`,
      }));
    }
    return [] as {
      month: string;
      monthShort: string;
      savings: number;
      loans: number;
      assets: number;
      variation: number;
      date: string;
    }[];
  }, [monthlyTrendData]);

  const submissionActivityTrend = useMemo(
    () =>
      (submissionActivityData?.months ?? []).map((point) => ({
        month: point.month_label,
        submitted: point.submitted,
        approved: point.approved,
        rejected: point.rejected,
        inReview: point.in_review,
      })),
    [submissionActivityData],
  );

  const membershipTrend = useMemo(
    () =>
      (nfTrendData?.points ?? []).map((point) => ({
        year: String(point.reporting_year),
        members: point.total_members,
        youth: point.youth_members,
        women: point.women_members,
      })),
    [nfTrendData],
  );

  const filteredRegionCompliance = useMemo(() => {
    return regionComplianceData?.regions ?? [];
  }, [regionComplianceData]);

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
    return [];
  }, [role, nfStats]);

  const filteredSectorBreakdown = useMemo(() => {
    return sectorBreakdownData?.sectors ?? [];
  }, [sectorBreakdownData]);

  const filteredPerformers = useMemo(() => {
    return (nationalOverview?.cooperatives ?? [])
      .filter((cooperative) => cooperative.has_data)
      .map((cooperative) => {
        const values = Object.values(cooperative.kpis);
        const greenCount = values.filter((kpi) => kpi.status === "green").length;
        return {
          n: cooperative.name,
          p: cooperative.sector ?? cooperative.institution_type ?? "Unclassified",
          s: values.length > 0 ? Math.round((greenCount / values.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.s - a.s);
  }, [nationalOverview]);

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

  const filteredRegionTrend: { month: string }[] = [];

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

    return kpiMetricsByRole[role];
  }, [role, kpisData, ministryStats, apexStats, federationStats]);

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
          {(() => {
            const yearFilter = filters.find((f) => f.id === "year");
            const otherFilters = filters.filter((f) => f.id !== "year");

            return (
              <>
                {/* Year Dropdown directly in the bar */}
                {yearFilter && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold transition-all hover:bg-muted/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <Calendar className="size-3.5 text-primary" />
                    <span className="text-muted-foreground uppercase whitespace-nowrap">
                      Reporting Year:
                    </span>
                    <Select
                      value={filterValues.year}
                      onValueChange={(val) => handleFilterChange("year", val)}
                    >
                      <SelectTrigger className="h-auto border-none bg-transparent p-0 font-bold text-foreground shadow-none focus:ring-0 [&>svg]:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearFilter.options.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="font-bold cursor-pointer"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* More Filters button (only if there are other filters) */}
                {otherFilters.length > 0 && (
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
                    {showFilters ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                )}

                {/* Active filter pills */}
                {Object.entries(filterValues).map(([key, value]) => {
                  if (key === "year") return null;
                  if (value === "all" || value === "ytd") return null;
                  const filter = filters.find((f) => f.id === key);
                  const option = filter?.options.find((o) => o.value === value);
                  if (!option) return null;
                  const resetValue = key === "year" ? defaultYear : "all";
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1 text-xs font-bold z-10 relative"
                    >
                      <span className="text-[10px] uppercase tracking-wider text-primary/60">
                        {filter?.label}:
                      </span>
                      {option.label}
                      <button
                        onClick={() => handleFilterChange(key, resetValue)}
                        className="hover:bg-primary/20 rounded-full p-0.5 relative z-20"
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
              </>
            );
          })()}

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
              {filters
                .filter((f) => f.id !== "year")
                .map((filter) => (
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

        {hasSelectedCoop ? (
          /* ── Apex: Cooperative Deep Dive Panel ── */
          selectedCoopProfile && (
            <div
              className="space-y-6 scroll-mt-4 animate-in fade-in zoom-in-95 duration-200"
              id="coop-deep-dive"
            >
              {/* Header */}
              <div className="rounded-xl border border-primary/30 bg-primary/4 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-2 rounded-full bg-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Cooperative Deep Dive
                    </p>
                  </div>
                  <h2 className="font-heading text-xl font-bold text-foreground">
                    {selectedCoopProfile.display_name ?? selectedCoopProfile.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="capitalize">
                      {selectedCoopProfile.institution_type ?? "—"}
                    </span>
                    <span>·</span>
                    <span>{selectedCoopProfile.region ?? "—"}</span>
                    <span>·</span>
                    <span className="capitalize">{selectedCoopProfile.sector ?? "—"}</span>
                    {selectedCoopProfile.reg_no && (
                      <>
                        <span>·</span>
                        <span>Reg: {selectedCoopProfile.reg_no}</span>
                      </>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                        selectedCoopProfile.status === "Active"
                          ? "bg-success/10 text-success"
                          : "bg-warning/15 text-warning-foreground"
                      }`}
                    >
                      {selectedCoopProfile.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleFilterChange("cooperative", "all")}
                  className="press-feedback flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shrink-0 shadow-sm"
                >
                  <X className="size-3.5" />
                  Close Deep Dive
                </button>
              </div>

              {/* ── Financial KPI Summary (matches what the cooperative sees) ── */}
              <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Landmark className="size-4 text-primary" />
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      Financial Performance — {currentYear}
                    </h3>
                  </div>
                  {isDeepDiveKpisLoading && (
                    <Loader2 className="size-4 text-muted-foreground animate-spin" />
                  )}
                </div>
                {deepDiveKpis ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border">
                    {[
                      {
                        label: "Total Assets",
                        kpi: "total_assets",
                        icon: "💰",
                        color: "text-primary",
                      },
                      {
                        label: "Gross Loans",
                        kpi: "gross_loan_portfolio",
                        icon: "🏦",
                        color: "text-foreground",
                      },
                      {
                        label: "Member Deposits",
                        kpi: "total_member_deposits",
                        icon: "🏧",
                        color: "text-foreground",
                      },
                      {
                        label: "Net Surplus",
                        kpi: "net_surplus",
                        icon: "📈",
                        color: "text-success",
                      },
                      {
                        label: "NPL Ratio",
                        kpi: "npl_ratio",
                        icon: "⚠️",
                        color: "text-warning-foreground",
                      },
                      {
                        label: "Capital Adequacy",
                        kpi: "capital_adequacy_ratio",
                        icon: "🛡️",
                        color: "text-foreground",
                      },
                    ].map(({ label, kpi, icon, color }) => {
                      const item = deepDiveKpis.kpis.find((k) => k.name === kpi);
                      const statusColor =
                        item?.status === "green"
                          ? "text-success"
                          : item?.status === "amber"
                            ? "text-warning-foreground"
                            : item?.status === "red"
                              ? "text-destructive"
                              : color;
                      return (
                        <div key={kpi} className="px-4 py-4 flex flex-col gap-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <span>{icon}</span>
                            {label}
                          </p>
                          <p className={`font-heading text-xl font-bold num ${statusColor}`}>
                            {item?.formatted ?? "—"}
                          </p>
                          {item?.status && (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                item.status === "green"
                                  ? "text-success"
                                  : item.status === "amber"
                                    ? "text-warning-foreground"
                                    : "text-destructive"
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !isDeepDiveKpisLoading &&
                  !isApexSubmissionsLoading && (
                    <p className="px-5 py-4 text-sm text-muted-foreground">
                      {deepDiveSubmission
                        ? `No financial KPIs available for the ${currentYear} submission.`
                        : `No approved submission found for ${currentYear}.`}
                    </p>
                  )
                )}
              </div>

              {/* Member Demographics — only shown when coop has data for selected year */}
              {deepDiveLoading ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
                  <Loader2 className="size-8 mx-auto mb-3 text-primary opacity-60 animate-spin" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    Loading {currentYear} analytics…
                  </p>
                </div>
              ) : deepDiveHasNoData ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
                  <Calendar className="size-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  {deepDiveAnySubmission ? (
                    <>
                      <p className="text-base font-bold text-muted-foreground">
                        Submission pending approval for {currentYear}
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        {selectedCoopProfile?.display_name ?? selectedCoopProfile?.name} has a
                        submission for {currentYear} but it has not been approved yet. Status:{" "}
                        <span className="font-semibold capitalize">
                          {deepDiveAnySubmission.status}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-bold text-muted-foreground">
                        No submission for {currentYear}
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        {selectedCoopProfile?.display_name ?? selectedCoopProfile?.name} has not
                        submitted a report for the {currentYear} reporting year.
                      </p>
                    </>
                  )}
                  <button
                    onClick={() => handleFilterChange("year", String(currentYear - 1))}
                    className="mt-4 press-feedback text-xs font-bold text-primary hover:underline"
                  >
                    Try {currentYear - 1} instead →
                  </button>
                </div>
              ) : (
                <>
                  {deepDiveNfStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Total Members KPI */}
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="size-8 rounded-lg bg-primary/8 text-primary grid place-items-center">
                            <Users className="size-4" />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Membership Summary
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="font-heading text-2xl font-bold text-foreground num">
                              {deepDiveNfStats.membership.total.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Total Members
                            </p>
                          </div>
                          <div>
                            <p className="font-heading text-2xl font-bold text-success num">
                              {deepDiveNfStats.membership.active.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Active
                            </p>
                          </div>
                          <div>
                            <p className="font-heading text-lg font-bold text-warning-foreground num">
                              {deepDiveNfStats.membership.dormant.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Dormant
                            </p>
                          </div>
                          <div>
                            <p className="font-heading text-lg font-bold text-muted-foreground num">
                              {deepDiveNfStats.membership.exited.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Exited
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {deepDiveNfStats.membership.female_pct.toFixed(0)}%
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                              Women
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {deepDiveNfStats.membership.male_pct.toFixed(0)}%
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                              Men
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {deepDiveNfStats.membership.youth_pct.toFixed(0)}%
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                              Youth
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Gender Doughnut */}
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                          Gender Breakdown
                        </p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  {
                                    name: "Women",
                                    value: deepDiveNfStats.membership.female_pct,
                                    fill: "var(--chart-1)",
                                  },
                                  {
                                    name: "Men",
                                    value: deepDiveNfStats.membership.male_pct,
                                    fill: "var(--chart-2)",
                                  },
                                  {
                                    name: "Other",
                                    value: deepDiveNfStats.membership.other_pct,
                                    fill: "var(--chart-3)",
                                  },
                                ].filter((d) => d.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={62}
                                dataKey="value"
                                strokeWidth={2}
                                stroke="var(--surface)"
                              >
                                {["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"].map(
                                  (c, i) => (
                                    <Cell key={i} fill={c} />
                                  ),
                                )}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                }}
                                formatter={(v: number) => [`${v.toFixed(1)}%`]}
                              />
                              <Legend
                                iconType="circle"
                                iconSize={7}
                                wrapperStyle={{ fontSize: "11px" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Membership Status Doughnut */}
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                          Membership Status
                        </p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  {
                                    name: "Active",
                                    value:
                                      deepDiveNfStats.membership.total > 0
                                        ? Math.round(
                                            (deepDiveNfStats.membership.active /
                                              deepDiveNfStats.membership.total) *
                                              100,
                                          )
                                        : 0,
                                    fill: "var(--success)",
                                  },
                                  {
                                    name: "Dormant",
                                    value:
                                      deepDiveNfStats.membership.total > 0
                                        ? Math.round(
                                            (deepDiveNfStats.membership.dormant /
                                              deepDiveNfStats.membership.total) *
                                              100,
                                          )
                                        : 0,
                                    fill: "var(--chart-3)",
                                  },
                                  {
                                    name: "Exited",
                                    value:
                                      deepDiveNfStats.membership.total > 0
                                        ? Math.round(
                                            (deepDiveNfStats.membership.exited /
                                              deepDiveNfStats.membership.total) *
                                              100,
                                          )
                                        : 0,
                                    fill: "var(--chart-4)",
                                  },
                                ].filter((d) => d.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={62}
                                dataKey="value"
                                strokeWidth={2}
                                stroke="var(--surface)"
                              >
                                {["var(--success)", "var(--chart-3)", "var(--chart-4)"].map(
                                  (c, i) => (
                                    <Cell key={i} fill={c} />
                                  ),
                                )}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                }}
                                formatter={(v: number) => [`${v}%`]}
                              />
                              <Legend
                                iconType="circle"
                                iconSize={7}
                                wrapperStyle={{ fontSize: "11px" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Portfolio Financial Trend (12 months) */}
                  {deepDiveMonthly.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Portfolio Overview
                          </p>
                          <p className="font-heading text-xl font-bold text-foreground mt-1">
                            {formatNumber(deepDiveMonthly[deepDiveMonthly.length - 1]?.assets ?? 0)}
                            K Total Assets
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-1)] inline-block" />
                            Assets
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-2)] inline-block" />
                            Loans
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-3)] inline-block" />
                            Savings
                          </span>
                        </div>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={deepDiveMonthly}
                            margin={{ top: 10, right: 24, left: -12, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="dd-assets" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="dd-loans" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="dd-savings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="4 4"
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="month"
                              stroke="var(--muted-foreground)"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "var(--muted-foreground)" }}
                            />
                            <YAxis
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "var(--muted-foreground)" }}
                              tickFormatter={(v) => formatNumber(v as number)}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: "10px",
                                fontSize: "12px",
                                padding: "10px 14px",
                              }}
                              formatter={(v: number, name: string) => [`${formatNumber(v)}K`, name]}
                            />
                            <Area
                              type="monotone"
                              dataKey="assets"
                              stroke="var(--chart-1)"
                              strokeWidth={2}
                              fill="url(#dd-assets)"
                              dot={{
                                r: 3,
                                fill: "var(--surface)",
                                stroke: "var(--chart-1)",
                                strokeWidth: 2,
                              }}
                              name="Assets"
                            />
                            <Area
                              type="monotone"
                              dataKey="loans"
                              stroke="var(--chart-2)"
                              strokeWidth={2}
                              fill="url(#dd-loans)"
                              dot={{
                                r: 3,
                                fill: "var(--surface)",
                                stroke: "var(--chart-2)",
                                strokeWidth: 2,
                              }}
                              name="Loans"
                            />
                            <Area
                              type="monotone"
                              dataKey="savings"
                              stroke="var(--chart-3)"
                              strokeWidth={2}
                              fill="url(#dd-savings)"
                              dot={{
                                r: 3,
                                fill: "var(--surface)",
                                stroke: "var(--chart-3)",
                                strokeWidth: 2,
                              }}
                              name="Savings"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Loan & Savings Health */}
                  {deepDiveNfStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Loan Status Breakdown */}
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                          Loan Portfolio Health
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="rounded-lg bg-success/8 border border-success/20 p-3">
                            <p className="font-heading text-xl font-bold text-success num">
                              {deepDiveNfStats.loans.total_loans.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-success/70 mt-1">
                              Total Loans
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <p className="font-heading text-xl font-bold text-foreground num">
                              {deepDiveNfStats.loans.performing.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Performing
                            </p>
                          </div>
                          <div className="rounded-lg bg-warning/8 border border-warning/20 p-3">
                            <p className="font-heading text-xl font-bold text-warning-foreground num">
                              {deepDiveNfStats.loans.arrears.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-warning-foreground/70 mt-1">
                              In Arrears
                            </p>
                          </div>
                          <div className="rounded-lg bg-destructive/8 border border-destructive/20 p-3">
                            <p className="font-heading text-xl font-bold text-destructive num">
                              {deepDiveNfStats.loans.written_off.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70 mt-1">
                              Written Off
                            </p>
                          </div>
                        </div>
                        {deepDiveNfStats.loans.total_loans > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                              <span>NPL Rate</span>
                              <span className="font-bold text-foreground">
                                {(
                                  (deepDiveNfStats.loans.arrears /
                                    deepDiveNfStats.loans.total_loans) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-warning transition-all"
                                style={{
                                  width: `${Math.min((deepDiveNfStats.loans.arrears / deepDiveNfStats.loans.total_loans) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Savings Account Health */}
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                          Savings Portfolio Health
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="rounded-lg bg-primary/8 border border-primary/20 p-3">
                            <p className="font-heading text-xl font-bold text-primary num">
                              {deepDiveNfStats.savings.total_accounts.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mt-1">
                              Total Accounts
                            </p>
                          </div>
                          <div className="rounded-lg bg-success/8 border border-success/20 p-3">
                            <p className="font-heading text-xl font-bold text-success num">
                              {deepDiveNfStats.savings.active_accounts.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-success/70 mt-1">
                              Active
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <p className="font-heading text-xl font-bold text-foreground num">
                              {deepDiveNfStats.savings.dormant_accounts.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Dormant
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <p className="font-heading text-xl font-bold text-foreground num">
                              {(deepDiveNfStats.savings.zero_balance_count ?? 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                              Zero Balance
                            </p>
                          </div>
                        </div>
                        {deepDiveNfStats.savings.total_accounts > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                              <span>Account Utilisation</span>
                              <span className="font-bold text-foreground">
                                {(
                                  (deepDiveNfStats.savings.active_accounts /
                                    deepDiveNfStats.savings.total_accounts) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-success transition-all"
                                style={{
                                  width: `${Math.min((deepDiveNfStats.savings.active_accounts / deepDiveNfStats.savings.total_accounts) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        ) : (
          <>
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
                {consolidatedNetworkSummary.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-heading text-2xl font-bold text-foreground num">
                      {item.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{item.sub}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── KPI Hero Row for ALL roles ── */}
            {kpisLoading && isCooperative ? (
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
            ) : filteredKPIs.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {filteredKPIs.slice(0, 6).map((kpi) => {
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
                      key={kpi.label}
                      className="rounded-xl border border-border bg-surface p-4 hover-lift shadow-[var(--shadow-elev-1)] cursor-default"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="size-8 rounded-lg grid place-items-center bg-primary/8 text-primary">
                          <kpi.icon className="size-4" />
                        </div>
                        {kpi.status && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              kpi.status === "green"
                                ? "bg-success/10 text-success"
                                : kpi.status === "red"
                                  ? "bg-destructive/10 text-destructive"
                                  : kpi.status === "amber"
                                    ? "bg-warning/15 text-warning-foreground"
                                    : "bg-muted/15 text-muted-foreground"
                            }`}
                          >
                            {kpi.status}
                          </span>
                        )}
                      </div>
                      <p
                        className={`font-heading text-xl font-bold num leading-none ${statusColor}`}
                      >
                        {kpi.value}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5 leading-tight">
                        {kpi.label.replace(/_/g, " ")}
                      </p>
                      {kpi.change && (
                        <p className="text-[10px] text-muted-foreground mt-1">{kpi.change}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : isCooperative ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                <Activity className="size-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm font-semibold text-muted-foreground">No KPI data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Submit a financial statement to see your computed KPIs here.
                </p>
              </div>
            ) : null}

            {/* ── Savings, Loans & Assets main chart ── */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* ── Premium Area/Line Chart with period selector ── */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
                {!monthlyTrendData?.months?.length &&
                (role === "cooperative" ? !coopHasApprovedSubmission : true) &&
                periodSlice.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                    <Activity className="size-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-semibold">No financial data yet</p>
                    <p className="text-xs mt-1">
                      Submit your monthly financials to see the trends.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Header: stats + period toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Portfolio Overview
                        </p>
                        <p className="font-heading text-2xl font-bold text-foreground num">
                          {role === "cooperative"
                            ? `$${portfolioTotal.savings.toLocaleString()}K`
                            : formatNumber(portfolioTotal.assets)}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-1)] inline-block" />
                            {role === "cooperative" ? "Savings" : "Assets"}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-2)] inline-block" />
                            Loans
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-3 h-0.5 rounded-full bg-[var(--chart-3)] inline-block" />
                            {role === "cooperative" ? "Assets" : "Savings"}
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
                        <AreaChart
                          data={periodSlice}
                          margin={{ top: 10, right: 24, left: -12, bottom: 0 }}
                        >
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
                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="var(--border)"
                            vertical={false}
                          />
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
                            dataKey="assets"
                            name="Assets ($K)"
                            stroke="var(--chart-1)"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            fill="url(#grad-members-new)"
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
                            yAxisId="right"
                            type="monotone"
                            dataKey="savings"
                            name="Savings ($K)"
                            stroke="var(--chart-2)"
                            strokeDasharray="3 3"
                            strokeWidth={2}
                            fill="url(#grad-savings-new)"
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
                            yAxisId="right"
                            type="monotone"
                            dataKey="loans"
                            name="Loans ($K)"
                            stroke="var(--chart-3)"
                            strokeWidth={2}
                            fill="url(#grad-loans-new)"
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
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* Gender & Status Doughnuts (replaces plain 2D pie) */}
              {nfStats && (
                <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] flex flex-col">
                  <GenderStatusDoughnuts data={nfStats.membership} />
                </div>
              )}
            </div>

            {/* ── Composed Chart: Savings, Loans & Deposits ── */}
            <Card
              title="Savings, Loans & Assets"
              subtitle={
                role === "cooperative"
                  ? "Your submitted monthly financial balances"
                  : "Authorized portfolio financial balances"
              }
            >
              {!monthlyTrendData?.months?.length &&
              (role === "cooperative" ? !coopHasApprovedSubmission : true) &&
              filteredMonthlyFinancials.length === 0 ? (
                <div className="flex items-center justify-center text-center text-muted-foreground min-h-[320px]">
                  <div>
                    <Activity className="size-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-semibold">No financial data yet</p>
                    <p className="text-xs mt-1">
                      Submit your monthly financials to see the trends.
                    </p>
                  </div>
                </div>
              ) : (
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
                        <linearGradient id="bar-assets-grad" x1="0" y1="0" x2="0" y2="1">
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
                        itemStyle={{
                          color: "var(--foreground)",
                          fontWeight: 500,
                          lineHeight: "1.8",
                        }}
                        labelStyle={{
                          fontWeight: "700",
                          color: "var(--foreground)",
                          marginBottom: "6px",
                          fontSize: "13px",
                          borderBottom: "1px solid var(--border)",
                          paddingBottom: "6px",
                        }}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString()}K`,
                          name,
                        ]}
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
                        dataKey="assets"
                        fill="url(#bar-assets-grad)"
                        name="Assets"
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
                        dot={{
                          r: 4.5,
                          strokeWidth: 2,
                          fill: "var(--surface)",
                          stroke: "var(--chart-4)",
                        }}
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
              )}
            </Card>

            {/* ── Sector Pie + Youth Stacked Bar (admin/federation/ministry only) ── */}
            {role !== "cooperative" && (
              <div className="grid lg:grid-cols-3 gap-6">
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
                            style={{
                              background: "var(--accent)",
                              opacity: sectorOpacities[i] ?? 0.3,
                            }}
                          />
                          {s.name}
                        </span>
                        <span className="font-bold num text-foreground">{s.value}%</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Card
                  className="lg:col-span-2"
                  title="Youth Participation by Region"
                  subtitle="% of members under 35 years old"
                >
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={youthData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
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
                </Card>
              </div>
            )}

            {/* ── Non-Financial Core Components ── */}
            {nfStats && nfStats.membership.total > 0 && role === "cooperative" && (
              <div className="grid lg:grid-cols-2 gap-6">
                <Card title="Savings Health Metrics" subtitle="Activity and penetration metrics">
                  <div className="py-4">
                    <SavingsRadialGauges data={nfStats.savings} />
                  </div>
                </Card>

                <Card title="Loan Portfolio Composition" subtitle="Volume and value by loan status">
                  <div className="py-4 h-full">
                    <LoanDualBar data={nfStats.loans} />
                  </div>
                </Card>
              </div>
            )}

            {role !== "cooperative" && nationalOverview && (
              <div className="grid lg:grid-cols-2 gap-6">
                <Card
                  title="Regional Financial Distribution"
                  subtitle="Aggregate Assets, Loans & Deposits"
                >
                  <div className="py-4">
                    <RegionalGroupedBar cooperatives={nationalOverview.cooperatives} />
                  </div>
                </Card>

                <Card
                  title="Dormancy Leaderboard"
                  subtitle="Cooperatives ranked by dormancy rate (Watch/Critical)"
                >
                  <div className="py-4">
                    <DormancyLeaderboard
                      data={nationalOverview.cooperatives
                        .filter((c) => c.non_financial.has_data)
                        .map((c) => ({
                          name: c.name,
                          dormancy_pct: c.non_financial.dormancy_pct,
                          active_members_pct: c.non_financial.active_members_pct,
                          total_members: c.non_financial.total_members,
                        }))}
                      maxRows={10}
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* ── Compliance Trend / Region Compliance ── */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card
                title="Membership and Inclusion Trend"
                subtitle="Submitted reporting-period totals for members, youth, and women"
              >
                <div className="h-64">
                  {membershipTrend.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                      <Users className="size-8 opacity-30" />
                      <p className="mt-3 text-sm font-semibold">No reporting-period history yet</p>
                      <p className="mt-1 max-w-xs text-xs">
                        Membership and inclusion trends appear after non-financial data is
                        submitted.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={membershipTrend}
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
                          domain={[0, "dataMax"]}
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          fontFamily="var(--font-sans)"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatNumber(v as number)}
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
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {role === "cooperative" && (
                <Card
                  title="Loan Portfolio Quality"
                  subtitle="Risk distribution from submitted non-financial loan records"
                >
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
                      <span className="text-[20px] font-bold text-success leading-none">
                        {filteredLoanPortfolio.find((item) => item.name === "Performing")?.value ??
                          0}
                        %
                      </span>
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
              )}

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
                </div>
              </Card>
            </div>

            {/* ── Region Compliance Horizontal Bar + Submission Timeliness Area ── */}
            <div className="grid lg:grid-cols-2 gap-6">
              {(role === "cooperative"
                ? coopComplianceTrend.length > 0
                : filteredRegionCompliance.length > 0) && (
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
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                          />
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
              )}
            </div>

            {/* ── Period Comparison + Region Trend (admin only) ── */}
            {role !== "cooperative" && mergedCompData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Current vs Previous Period Comparison Chart ── */}
                <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Portfolio Savings Trend
                      </p>
                      <div className="flex items-center gap-5 mt-2">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-block w-6 h-0.5 rounded-full bg-[var(--chart-1)]" />
                          Submitted savings
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
                          itemStyle={{
                            color: "var(--foreground)",
                            fontWeight: 500,
                            lineHeight: "1.8",
                          }}
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
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Multi-Region Trend (or Coop Monthly Trend) ── */}
                {filteredRegionTrend.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)]">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          {role === "cooperative"
                            ? "Monthly Members & Savings"
                            : "Member Trend by Region"}
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
                              itemStyle={{
                                color: "var(--foreground)",
                                fontWeight: 500,
                                lineHeight: "1.8",
                              }}
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
                              itemStyle={{
                                color: "var(--foreground)",
                                fontWeight: 500,
                                lineHeight: "1.8",
                              }}
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
                )}
              </div>
            )}
            {/* end side-by-side grid */}

            {/* ── Performance Score leaderboard (admin/ministry/federation only) ── */}
            {role !== "cooperative" && nationalOverview ? (
              <div className="space-y-6">
                <TopBottomLeaderboard
                  cooperatives={nationalOverview.cooperatives}
                  sortByKpi="par30"
                />

                <Card
                  title="Detailed Cooperative Compliance Grid"
                  subtitle="Traffic light indicators across key operational KPIs"
                >
                  <div className="p-4 bg-surface rounded-lg">
                    <KpiChipGrid
                      cooperatives={nationalOverview.cooperatives.map((c) => ({
                        name: c.name,
                        region: c.region,
                        kpis: c.kpis,
                      }))}
                      kpiKeys={[
                        "par30",
                        "capital_adequacy_ratio",
                        "npl_ratio",
                        "roa",
                        "roe",
                        "operating_expense_ratio",
                      ]}
                      maxRows={15}
                    />
                  </div>
                </Card>
              </div>
            ) : null}

            {(role === "ministry" || role === "federation" || role === "apex") &&
              nationalOverview && (
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
                      {nationalOverview.non_financial_summary.cooperatives_with_data > 0 && (
                        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                          {[
                            [
                              "Active members",
                              nationalOverview.non_financial_summary.average_active_members_pct,
                            ],
                            [
                              "Savings penetration",
                              nationalOverview.non_financial_summary
                                .average_savings_penetration_pct,
                            ],
                            [
                              "Credit penetration",
                              nationalOverview.non_financial_summary.average_credit_penetration_pct,
                            ],
                            [
                              "FD penetration",
                              nationalOverview.non_financial_summary.average_fd_penetration_pct,
                            ],
                            [
                              "On-time repayment",
                              nationalOverview.non_financial_summary.average_on_time_repayment_pct,
                            ],
                            [
                              "Member dormancy",
                              nationalOverview.non_financial_summary.average_dormancy_pct,
                            ],
                            [
                              "AGM participation",
                              nationalOverview.non_financial_summary.average_agm_participation_pct,
                            ],
                            [
                              "Loans in arrears",
                              nationalOverview.non_financial_summary.average_arrears_rate_pct,
                            ],
                            [
                              "FD early withdrawals",
                              nationalOverview.non_financial_summary
                                .average_fd_early_withdrawal_pct,
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label as string}
                              className="rounded-lg border border-border bg-muted/20 p-3"
                            >
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {label as string}
                              </p>
                              <p className="mt-1 text-lg font-bold text-foreground">
                                {(value as number).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {Object.keys(nationalOverview?.distributions || {}).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No financial data available for aggregation.
                        </p>
                      ) : (
                        <div className="mt-8">
                          <p className="text-sm font-bold text-foreground mb-4">
                            Traffic Light Distribution by KPI
                          </p>
                          <ComplianceStackedBars
                            distributions={nationalOverview?.distributions || {}}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {role === "ministry" && (
              <div className="mt-6">
                <NonFinancialConsolidation />
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};
