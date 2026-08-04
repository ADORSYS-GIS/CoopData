import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useNationalOverview, CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { Card } from "@/components/app-shell";
import {
  SearchableCombobox,
  type ComboboxOption,
  type ComboboxGroup,
} from "@/components/ui/searchable-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Search,
  Users,
  Percent,
  Coins,
  ShieldAlert,
  Globe,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface CooperativeComparisonProps {
  reportingYear: number;
}

interface ComparableKpi {
  key: string;
  label: string;
  unit: string;
  isNf: boolean;
  group: "balances" | "ratios" | "non_financial";
  description: string;
}

// Group definitions for KPIs
function buildKpiGroups(t: TFunction) {
  return {
    balances: {
      label: t("analytics.comparisonGroupBalances"),
      icon: Coins,
      colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    },
    ratios: {
      label: t("analytics.comparisonGroupRatios"),
      icon: Percent,
      colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
    },
    non_financial: {
      label: t("analytics.comparisonGroupNonFinancial"),
      icon: Users,
      colorClass: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    },
  };
}

// Complete KPI List (Financial + Non-Financial) with group classifications
function buildComparableKpis(t: TFunction): ComparableKpi[] {
  return [
    // --- Financial Balances ---
    {
      key: "total_assets",
      label: t("analytics.comparisonKpiTotalAssets"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescTotalAssets"),
    },
    {
      key: "gross_loan_portfolio",
      label: t("analytics.comparisonKpiGrossLoanPortfolio"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescGrossLoanPortfolio"),
    },
    {
      key: "net_loan_portfolio",
      label: t("analytics.comparisonKpiNetLoanPortfolio"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescNetLoanPortfolio"),
    },
    {
      key: "total_member_deposits",
      label: t("analytics.comparisonKpiTotalMemberDeposits"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescTotalMemberDeposits"),
    },
    {
      key: "total_equity",
      label: t("analytics.comparisonKpiTotalEquity"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescTotalEquity"),
    },
    {
      key: "net_surplus",
      label: t("analytics.comparisonKpiNetSurplus"),
      unit: "SZL",
      isNf: false,
      group: "balances",
      description: t("analytics.comparisonDescNetSurplus"),
    },

    // --- Financial Ratios & Risk ---
    {
      key: "capital_adequacy_ratio",
      label: t("analytics.comparisonKpiCapitalAdequacyRatio"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescCapitalAdequacyRatio"),
    },
    {
      key: "liquid_funds_ratio",
      label: t("analytics.comparisonKpiLiquidFundsRatio"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescLiquidFundsRatio"),
    },
    {
      key: "npl_ratio",
      label: t("analytics.comparisonKpiNplRatio"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescNplRatio"),
    },
    {
      key: "par30",
      label: t("analytics.comparisonKpiPar30"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescPar30"),
    },
    {
      key: "par90",
      label: t("analytics.comparisonKpiPar90"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescPar90"),
    },
    {
      key: "loan_loss_coverage",
      label: t("analytics.comparisonKpiLoanLossCoverage"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescLoanLossCoverage"),
    },
    {
      key: "roa",
      label: t("analytics.comparisonKpiRoa"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescRoa"),
    },
    {
      key: "roe",
      label: t("analytics.comparisonKpiRoe"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescRoe"),
    },
    {
      key: "operating_expense_ratio",
      label: t("analytics.comparisonKpiOperatingExpenseRatio"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescOperatingExpenseRatio"),
    },
    {
      key: "operational_self_sufficiency",
      label: t("analytics.comparisonKpiOperationalSelfSufficiency"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescOperationalSelfSufficiency"),
    },
    {
      key: "net_interest_margin",
      label: t("analytics.comparisonKpiNetInterestMargin"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescNetInterestMargin"),
    },
    {
      key: "deposits_to_loans",
      label: t("analytics.comparisonKpiDepositsToLoans"),
      unit: "%",
      isNf: false,
      group: "ratios",
      description: t("analytics.comparisonDescDepositsToLoans"),
    },

    // --- Non-Financial Metrics ---
    {
      key: "total_members",
      label: t("analytics.comparisonKpiTotalMembers"),
      unit: "count",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescTotalMembers"),
    },
    {
      key: "active_members_pct",
      label: t("analytics.comparisonKpiActiveMembersPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescActiveMembersPct"),
    },
    {
      key: "savings_penetration_pct",
      label: t("analytics.comparisonKpiSavingsPenetrationPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescSavingsPenetrationPct"),
    },
    {
      key: "credit_penetration_pct",
      label: t("analytics.comparisonKpiCreditPenetrationPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescCreditPenetrationPct"),
    },
    {
      key: "fd_penetration_pct",
      label: t("analytics.comparisonKpiFdPenetrationPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescFdPenetrationPct"),
    },
    {
      key: "on_time_repayment_pct",
      label: t("analytics.comparisonKpiOnTimeRepaymentPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescOnTimeRepaymentPct"),
    },
    {
      key: "dormancy_pct",
      label: t("analytics.comparisonKpiDormancyPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescDormancyPct"),
    },
    {
      key: "agm_participation_pct",
      label: t("analytics.comparisonKpiAgmParticipationPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescAgmParticipationPct"),
    },
    {
      key: "arrears_rate_pct",
      label: t("analytics.comparisonKpiArrearsRatePct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescArrearsRatePct"),
    },
    {
      key: "fd_early_withdrawal_pct",
      label: t("analytics.comparisonKpiFdEarlyWithdrawalPct"),
      unit: "%",
      isNf: true,
      group: "non_financial",
      description: t("analytics.comparisonDescFdEarlyWithdrawalPct"),
    },
  ];
}

export function CooperativeComparison({ reportingYear }: CooperativeComparisonProps) {
  const { t } = useTranslation();
  const { role, user } = useAuth();
  const isCoopUser = role === "cooperative";

  const kpiGroups = useMemo(() => buildKpiGroups(t), [t]);
  const comparableKpis = useMemo(() => buildComparableKpis(t), [t]);

  // 1. Fetch national overview containing all cooperatives and their KPIs
  const { data: overview, isLoading } = useNationalOverview({ reportingYear });

  const cooperatives = useMemo(() => {
    return overview?.cooperatives ?? [];
  }, [overview]);

  // Cooperatives with valid submission data
  const cooperativesWithData = useMemo(() => {
    return cooperatives.filter((c) => c.has_data);
  }, [cooperatives]);

  // Helper to extract a value for a KPI from a cooperative row
  const getCoopKpiValue = (coop: CoopKpiRow | Record<string, unknown>, kpi: ComparableKpi) => {
    if (!coop) return 0;
    if (kpi.isNf) {
      return (
        ((coop as Record<string, unknown>)["non_financial"] as Record<string, number>)?.[kpi.key] ??
        0
      );
    }
    return (
      ((coop as Record<string, unknown>)["kpis"] as Record<string, { value: number }>)?.[kpi.key]
        ?.value ?? 0
    );
  };

  // Determine initial selected cooperative
  const defaultCoopId = useMemo(() => {
    if (isCoopUser && user?.cooperationId) {
      return user.cooperationId;
    }
    return cooperativesWithData[0]?.cooperative_id ?? "all";
  }, [isCoopUser, user, cooperativesWithData]);

  const [selectedCoopId, setSelectedCoopId] = useState<string>("");
  const [compareTargetId, setCompareTargetId] = useState<string>("national_average");
  const [selectedKpi, setSelectedKpi] = useState<string>("capital_adequacy_ratio");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  // Keep state synced with default when data loads
  React.useEffect(() => {
    if (defaultCoopId && defaultCoopId !== "all" && !selectedCoopId) {
      setSelectedCoopId(defaultCoopId);
    }
  }, [defaultCoopId, selectedCoopId]);

  const activeCoopId = selectedCoopId || defaultCoopId;

  // Selected cooperative details
  const selectedCoop = useMemo(() => {
    return cooperatives.find((c) => c.cooperative_id === activeCoopId);
  }, [cooperatives, activeCoopId]);

  // Available regions derived from data
  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    cooperativesWithData.forEach((c) => {
      if (c.region) regions.add(c.region);
    });
    return Array.from(regions).sort();
  }, [cooperativesWithData]);

  // Selected target details (National Average, Regional Average, or Coop B)
  const compareTarget = useMemo(() => {
    if (compareTargetId === "national_average") {
      return {
        name: t("analytics.nationalAverage"),
        isAverage: true,
        isRegional: false,
        region: null as string | null,
      };
    }
    if (compareTargetId.startsWith("region_avg_")) {
      const region = compareTargetId.replace("region_avg_", "");
      return {
        name: t("analytics.regionAvg", { region }),
        isAverage: true,
        isRegional: true,
        region,
      };
    }
    const coop = cooperatives.find((c) => c.cooperative_id === compareTargetId);
    return coop
      ? { ...coop, isAverage: false, isRegional: false, region: coop.region ?? null }
      : {
          name: t("analytics.nationalAverage"),
          isAverage: true,
          isRegional: false,
          region: null as string | null,
        };
  }, [cooperatives, compareTargetId, t]);

  // Dynamic system averages for comparable KPIs (national)
  const systemAverages = useMemo(() => {
    const averages: Record<string, number> = {};
    comparableKpis.forEach((kpi) => {
      const validValues = cooperativesWithData
        .map((c) => getCoopKpiValue(c, kpi))
        .filter((val): val is number => val !== undefined && !isNaN(val));
      averages[kpi.key] =
        validValues.length > 0
          ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
          : 0;
    });
    return averages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativesWithData]);

  // Regional averages keyed by region name → kpi key → average value
  const regionalAverages = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    availableRegions.forEach((region) => {
      const regionCoops = cooperativesWithData.filter((c) => c.region === region);
      const kpiAverages: Record<string, number> = {};
      comparableKpis.forEach((kpi) => {
        const vals = regionCoops
          .map((c) => getCoopKpiValue(c, kpi))
          .filter((v): v is number => v !== undefined && !isNaN(v));
        kpiAverages[kpi.key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      });
      result[region] = kpiAverages;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativesWithData, availableRegions]);

  // Helper to get comparison value for a KPI based on selected compare target
  const getCompareValue = (kpiKey: string): number => {
    if (compareTarget.isRegional && compareTarget.region) {
      return regionalAverages[compareTarget.region]?.[kpiKey] ?? 0;
    }
    if (compareTarget.isAverage) {
      return systemAverages[kpiKey] ?? 0;
    }
    const kpiInfo = comparableKpis.find((k) => k.key === kpiKey);
    if (!kpiInfo) return 0;
    return getCoopKpiValue(compareTarget, kpiInfo);
  };

  // Formatting helper
  const formatValue = (val: number, unit: string) => {
    if (unit === "%") {
      return `${val.toFixed(2)}%`;
    }
    if (unit === "count") {
      return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (val >= 1_000_000) {
      return `SZL ${(val / 1_000_000).toFixed(2)}M`;
    }
    if (val >= 1_000) {
      return `SZL ${(val / 1_000).toFixed(1)}K`;
    }
    return `SZL ${val.toFixed(2)}`;
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!selectedCoop || !selectedCoop.has_data) return [];
    const kpiInfo = comparableKpis.find((k) => k.key === selectedKpi);
    if (!kpiInfo) return [];
    const coopVal = getCoopKpiValue(selectedCoop, kpiInfo);
    const targetVal = getCompareValue(selectedKpi);
    return [
      { name: selectedCoop.name, Value: coopVal, color: "#3b82f6" },
      { name: compareTarget.name, Value: targetVal, color: "#10b981" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoop, selectedKpi, compareTarget, systemAverages, regionalAverages]);

  const activeKpiInfo = useMemo(() => {
    return comparableKpis.find((k) => k.key === selectedKpi);
  }, [selectedKpi, comparableKpis]);

  // Filtered KPIs for matrix table (search + group filter)
  const filteredKpis = useMemo(() => {
    return comparableKpis.filter((kpi) => {
      const matchesSearch =
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = activeGroupFilter === null || kpi.group === activeGroupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [searchQuery, activeGroupFilter, comparableKpis]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-medium tracking-wide">
          {t("analytics.assemblingPerformanceStats")}
        </span>
      </div>
    );
  }

  // Handle case where no cooperatives have data
  if (cooperativesWithData.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 opacity-60 mb-3" />
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {t("analytics.noBenchmarkingData")}
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          {t("analytics.noBenchmarkingDataDesc", { year: reportingYear })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title={t("analytics.benchmarkingTitle")}
        subtitle={t("analytics.benchmarkingSubtitle", { year: reportingYear })}
        info={t("analytics.benchmarkingInfo")}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* ── Cooperative cible ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> {t("analytics.targetCooperative")}
            </label>
            <SearchableCombobox
              value={activeCoopId}
              onChange={(val) => val && setSelectedCoopId(val)}
              options={cooperativesWithData.map((c) => ({
                value: c.cooperative_id,
                label: c.name,
                description: c.region ?? t("analytics.unknownRegion"),
                icon: <MapPin className="size-3 text-blue-400" />,
              }))}
              placeholder={t("analytics.chooseCooperativePlaceholder")}
              searchPlaceholder={t("analytics.searchCooperative")}
              emptyMessage={t("analytics.noCooperativeFound")}
              disabled={isCoopUser}
            />
          </div>

          {/* ── Pair de comparaison ───────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ArrowRightLeft className="size-3.5 text-emerald-500" />{" "}
              {t("analytics.comparisonPeer")}
            </label>
            <SearchableCombobox
              value={compareTargetId}
              onChange={(val) => val && setCompareTargetId(val)}
              options={[
                {
                  value: "national_average",
                  label: t("analytics.nationalAverageAll"),
                  description: t("analytics.nationalAverageDesc"),
                  group: "averages",
                  icon: <Globe className="size-3 text-emerald-500" />,
                },
                ...availableRegions.map((region) => ({
                  value: `region_avg_${region}`,
                  label: t("analytics.regionAverage", { region }),
                  description: t("analytics.regionAverageDesc"),
                  group: "averages",
                  icon: <MapPin className="size-3 text-emerald-400" />,
                })),
                ...cooperativesWithData
                  .filter((c) => c.cooperative_id !== activeCoopId)
                  .map((c) => ({
                    value: c.cooperative_id,
                    label: c.name,
                    description: c.region ?? t("analytics.unknownRegion"),
                    group: "cooperatives",
                    icon: <Users className="size-3 text-blue-400" />,
                  })),
              ]}
              groups={[
                {
                  key: "averages",
                  label: t("analytics.averagesGroup"),
                  icon: <Globe className="size-3" />,
                },
                {
                  key: "cooperatives",
                  label: t("analytics.cooperativesGroup"),
                  icon: <Users className="size-3" />,
                },
              ]}
              placeholder={t("analytics.selectTargetPlaceholder")}
              searchPlaceholder={t("analytics.searchComparison")}
              emptyMessage={t("analytics.noComparisonFound")}
            />
          </div>

          {/* ── Ratio / Métrique de focus ─────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Percent className="size-3.5 text-indigo-500" /> {t("analytics.focusRatioMetric")}
            </label>
            <SearchableCombobox
              value={selectedKpi}
              onChange={(val) => val && setSelectedKpi(val)}
              options={comparableKpis.map((kpi) => ({
                value: kpi.key,
                label: kpi.label,
                description: kpi.description,
                group: kpi.group,
                icon:
                  kpi.group === "balances" ? (
                    <Coins className="size-3 text-blue-400" />
                  ) : kpi.group === "ratios" ? (
                    <Percent className="size-3 text-indigo-400" />
                  ) : (
                    <Users className="size-3 text-emerald-400" />
                  ),
              }))}
              groups={[
                {
                  key: "balances",
                  label: t("analytics.comparisonGroupBalances"),
                  icon: <Coins className="size-3" />,
                },
                {
                  key: "ratios",
                  label: t("analytics.comparisonGroupRatios"),
                  icon: <Percent className="size-3" />,
                },
                {
                  key: "non_financial",
                  label: t("analytics.comparisonGroupNonFinancial"),
                  icon: <Users className="size-3" />,
                },
              ]}
              placeholder={t("analytics.chooseKpiPlaceholder")}
              searchPlaceholder={t("analytics.searchKpiMetric")}
              emptyMessage={t("analytics.noKpiFound")}
            />
          </div>
        </div>

        {selectedCoop && !selectedCoop.has_data ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{t("analytics.noSubmittedDataYear", { year: reportingYear })}</span>
          </div>
        ) : selectedCoop && activeKpiInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Recharts Bar Chart */}
            <div className="lg:col-span-2 border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-primary" />{" "}
                  {t("analytics.visualBenchmark")}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {activeKpiInfo.description}
                </p>
              </div>
              <div className="flex-1 w-full h-[220px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    barSize={50}
                  >
                    <defs>
                      <linearGradient id="colorCoop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="colorPeer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#047857" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.06} stroke="currentColor" />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      fontSize={11}
                      opacity={0.6}
                      tickLine={false}
                    />
                    <YAxis stroke="currentColor" fontSize={11} opacity={0.6} tickLine={false} />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.05)", radius: 8 }}
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(51, 65, 85, 0.5)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      }}
                      labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: "11px" }}
                      itemStyle={{ color: "#94a3b8", fontSize: "11px" }}
                      formatter={(val: unknown) => [
                        <span className="text-white font-bold">
                          {formatValue(Number(val), activeKpiInfo.unit)}
                        </span>,
                        activeKpiInfo.label,
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                    <Bar dataKey="Value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? "url(#colorCoop)" : "url(#colorPeer)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics Summary */}
            <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("analytics.benchmarkingInsight")}
                </h4>
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/30 dark:bg-blue-950/10 rounded-xl border border-blue-100/50 dark:border-blue-900/10">
                    <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                      {selectedCoop.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
                      {formatValue(
                        getCoopKpiValue(selectedCoop, activeKpiInfo),
                        activeKpiInfo.unit,
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {compareTarget.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
                      {(() => {
                        let targetVal = 0;
                        targetVal = getCompareValue(selectedKpi);
                        return formatValue(targetVal, activeKpiInfo.unit);
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {(() => {
                  const coopVal = getCoopKpiValue(selectedCoop, activeKpiInfo);

                  const targetVal = getCompareValue(selectedKpi);

                  const diff = coopVal - targetVal;
                  const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                  // Lower is better for NPL, PAR, and dormancy indicators
                  const isPositiveIndicator = ![
                    "npl_ratio",
                    "par30",
                    "par90",
                    "dormancy_pct",
                    "arrears_rate_pct",
                    "fd_early_withdrawal_pct",
                  ].includes(selectedKpi);
                  const isBetter = isPositiveIndicator ? diff >= 0 : diff <= 0;

                  return (
                    <div
                      className={`flex items-start gap-2.5 rounded-xl p-3.5 border transition-all ${
                        isBetter
                          ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-350"
                          : "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/50 dark:border-rose-900/30 text-rose-700 dark:text-rose-350"
                      }`}
                    >
                      {isBetter ? (
                        <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-500" />
                      )}
                      <div>
                        <p className="text-xs font-bold leading-none">
                          {isBetter
                            ? t("analytics.outperformingPeerGroup")
                            : t("analytics.performanceWatchRequired")}
                        </p>
                        <p className="text-[11px] opacity-80 mt-1.5 leading-normal">
                          {isBetter
                            ? t("analytics.performingAbovePrefix")
                            : t("analytics.standingBelowPrefix")}
                          <span className="font-bold">{Math.abs(percentDiff).toFixed(1)}%</span>{" "}
                          {isBetter
                            ? t("analytics.abovePeerAverage")
                            : t("analytics.belowPeerAverage")}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* KPI Comparison Matrix Table */}
      {selectedCoop && selectedCoop.has_data && (
        <Card title={t("analytics.kpiMatrixTitle")} subtitle={t("analytics.kpiMatrixSubtitle")}>
          {/* Search + Group Filter toolbar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 w-full">
            {/* Search and Dropdown Controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder={t("analytics.searchKpiPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700 dark:text-slate-350"
                />
              </div>

              {/* Group select dropdown */}
              <Select
                value={activeGroupFilter || "all"}
                onValueChange={(val) => setActiveGroupFilter(val === "all" ? null : val)}
              >
                <SelectTrigger className="w-full sm:w-60 h-9 text-xs bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-350">
                  <SelectValue
                    placeholder={t("analytics.allCategories", { count: comparableKpis.length })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    {t("analytics.allCategories", { count: comparableKpis.length })}
                  </SelectItem>
                  {Object.entries(kpiGroups).map(([key, group]) => {
                    const count = comparableKpis.filter((kpi) => kpi.group === key).length;
                    return (
                      <SelectItem key={key} value={key} className="text-xs">
                        {group.label} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Group filter chips (clickable) */}
            <div className="flex flex-wrap gap-2">
              {/* All button */}
              <button
                onClick={() => setActiveGroupFilter(null)}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                  activeGroupFilter === null
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/50"
                }`}
              >
                {t("analytics.comparisonAll")}
                <span
                  className={`text-[9px] px-1 rounded ${
                    activeGroupFilter === null
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {comparableKpis.length}
                </span>
              </button>

              {Object.entries(kpiGroups).map(([key, group]) => {
                const count = comparableKpis.filter((kpi) => kpi.group === key).length;
                const Icon = group.icon;
                const isActive = activeGroupFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveGroupFilter(isActive ? null : key)}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                      isActive
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/50"
                    }`}
                  >
                    <Icon className="size-3" />
                    <span>{group.label}</span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/60 rounded-xl">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="py-3 px-4">{t("analytics.metricKpi")}</th>
                  <th className="py-3 px-4 text-right">{selectedCoop.name}</th>
                  <th className="py-3 px-4 text-right">{compareTarget.name}</th>
                  <th className="py-3 px-4 text-right">{t("analytics.variance")}</th>
                  <th className="py-3 px-4 text-center">{t("analytics.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {Object.entries(kpiGroups).map(([groupKey, groupInfo]) => {
                  const groupKpis = filteredKpis.filter((kpi) => kpi.group === groupKey);
                  if (groupKpis.length === 0) return null;

                  const GroupIcon = groupInfo.icon;

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group Divider */}
                      <tr className="bg-slate-50/30 dark:bg-slate-950/10">
                        <td
                          colSpan={5}
                          className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500"
                        >
                          <div className="flex items-center gap-1.5 font-sans">
                            <div className={`p-1 rounded ${groupInfo.colorClass}`}>
                              <GroupIcon className="size-3.5" />
                            </div>
                            {groupInfo.label}
                          </div>
                        </td>
                      </tr>

                      {groupKpis.map((kpi) => {
                        const coopVal = getCoopKpiValue(selectedCoop, kpi);

                        const targetVal = getCompareValue(kpi.key);

                        const diff = coopVal - targetVal;
                        const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                        // Direction indicators
                        const isPositiveIndicator = ![
                          "npl_ratio",
                          "par30",
                          "par90",
                          "dormancy_pct",
                          "arrears_rate_pct",
                          "fd_early_withdrawal_pct",
                        ].includes(kpi.key);
                        const isBetter = isPositiveIndicator ? diff >= 0 : diff <= 0;

                        return (
                          <tr
                            key={kpi.key}
                            className={`group hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors ${
                              selectedKpi === kpi.key
                                ? "bg-primary/5 dark:bg-primary/5 font-semibold"
                                : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-300">
                              <div className="flex items-center gap-1.5 font-sans">
                                <span
                                  className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                                  onClick={() => setSelectedKpi(kpi.key)}
                                >
                                  {kpi.label}
                                </span>
                                <div className="group relative">
                                  <HelpCircle className="size-3 text-slate-300 dark:text-slate-650 hover:text-slate-500 cursor-help" />
                                  <div className="pointer-events-none absolute left-0 bottom-full mb-1 w-64 rounded-lg bg-slate-950 p-2 text-[10px] text-white opacity-0 shadow-lg transition-all group-hover:opacity-100 z-50 leading-relaxed font-normal">
                                    {kpi.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right num text-slate-900 dark:text-white font-medium font-mono">
                              {formatValue(coopVal, kpi.unit)}
                            </td>
                            <td className="py-3 px-4 text-right num text-slate-400 dark:text-slate-500 font-mono">
                              {formatValue(targetVal, kpi.unit)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right num font-semibold font-mono ${
                                diff === 0
                                  ? "text-slate-450 dark:text-slate-500"
                                  : isBetter
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {diff > 0 ? "+" : ""}
                              {kpi.unit === "%"
                                ? `${diff.toFixed(2)}%`
                                : formatValue(diff, kpi.unit)}
                              {targetVal > 0 && (
                                <span className="text-[9px] ml-1 opacity-70 font-normal">
                                  ({diff > 0 ? "+" : ""}
                                  {percentDiff.toFixed(1)}%)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  isBetter
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                    : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                }`}
                              >
                                {isBetter ? (
                                  <>
                                    <TrendingUp className="size-2.5" />{" "}
                                    {t("analytics.legendHealthy")}
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="size-2.5" />{" "}
                                    {t("analytics.legendWatch")}
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
