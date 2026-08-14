import React, { useCallback, useMemo } from "react";
import { Coins, Percent, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useBenchmark } from "@/hooks/analytics/useBenchmark";
import { BenchmarkComparison } from "@/components/analytics/benchmark-comparison";
import type {
  BenchmarkComparisonLabels,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkRow,
} from "@/components/analytics/benchmark-types";
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

// KPIs where a lower value is considered better (cost/risk indicators).
const LOWER_IS_BETTER_KEYS = new Set([
  "npl_ratio",
  "par30",
  "par90",
  "dormancy_pct",
  "arrears_rate_pct",
  "fd_early_withdrawal_pct",
]);

// Group definitions for KPIs
function buildKpiGroups(t: TFunction): Record<string, BenchmarkGroup> {
  return {
    balances: {
      label: t("analytics.comparisonGroupBalances"),
      icon: Coins,
      colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
      comboboxIconClass: "text-blue-400",
    },
    ratios: {
      label: t("analytics.comparisonGroupRatios"),
      icon: Percent,
      colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
      comboboxIconClass: "text-indigo-400",
    },
    non_financial: {
      label: t("analytics.comparisonGroupNonFinancial"),
      icon: Users,
      colorClass: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
      comboboxIconClass: "text-emerald-400",
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
  const { role } = useAuth();
  const isCoopUser = role === "cooperative";

  const kpiGroups = useMemo(() => buildKpiGroups(t), [t]);
  const comparableKpis = useMemo(() => buildComparableKpis(t), [t]);

  // 1. Fetch the data source based on role.
  //    - Admins: national overview (all coops, client-side averages OK)
  //    - Cooperative: privacy-safe benchmark (own row + server averages)
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
  } = useNationalOverview({ reportingYear }, !isCoopUser);
  const {
    data: benchmark,
    isLoading: benchmarkLoading,
    isError: benchmarkError,
  } = useBenchmark({ reportingYear }, isCoopUser);
  const isLoading = isCoopUser ? benchmarkLoading : overviewLoading;
  const isError = isCoopUser ? benchmarkError : overviewError;

  // Rows available to the widget: own row for coop users, the scoped population
  // for admins. A coop without approved data has no row (empty-state path).
  const cooperatives = useMemo(() => {
    if (isCoopUser) return benchmark?.cooperative ? [benchmark.cooperative] : [];
    return (overview?.cooperatives ?? []) as BenchmarkRow[];
  }, [isCoopUser, benchmark, overview]);

  const serverAverages = useMemo(() => {
    if (!isCoopUser || !benchmark) return null;
    return {
      national: benchmark.national_average,
      regional: benchmark.regional_average,
      sector: benchmark.sector_average,
      sectorRegional: benchmark.sector_regional_average,
      insufficient: {
        national: benchmark.insufficient_data.national,
        regional: benchmark.insufficient_data.regional,
        sector: benchmark.insufficient_data.sector,
        sectorRegional: benchmark.insufficient_data.sector_regional,
      },
    };
  }, [isCoopUser, benchmark]);

  // Value accessor: financial KPIs live in row.kpis, non-financial in
  // row.non_financial.
  const getKpiValue = useCallback(
    (row: BenchmarkRow, metricKey: string) => {
      const coop = row as unknown as Record<string, unknown>;
      const kpi = comparableKpis.find((k) => k.key === metricKey);
      if (!kpi) return 0;
      if (kpi.isNf) {
        return (coop["non_financial"] as Record<string, number> | undefined)?.[metricKey] ?? 0;
      }
      return (
        (coop["kpis"] as Record<string, { value: number }> | undefined)?.[metricKey]?.value ?? 0
      );
    },
    [comparableKpis],
  );

  const metrics = useMemo<BenchmarkMetric[]>(
    () =>
      comparableKpis.map((k) => ({
        key: k.key,
        label: k.label,
        unit: k.unit,
        group: k.group,
        description: k.description,
        isLowerBetter: LOWER_IS_BETTER_KEYS.has(k.key),
      })),
    [comparableKpis],
  );

  const labels = useMemo<BenchmarkComparisonLabels>(
    () => ({
      title: t("analytics.benchmarkingTitle"),
      subtitle: t("analytics.benchmarkingSubtitle", { year: reportingYear }),
      info: t("analytics.benchmarkingInfo"),
      loading: t("analytics.assemblingPerformanceStats"),
      coopNoDataTitle: t("analytics.noBenchmarkingData"),
      coopNoDataDesc: t("analytics.noBenchmarkingDataDesc", { year: reportingYear }),
      noPopulationDataTitle: t("analytics.noBenchmarkingData"),
      noPopulationDataDesc: t("analytics.noBenchmarkingDataDesc", { year: reportingYear }),
      noSubmittedData: t("analytics.noSubmittedDataYear", { year: reportingYear }),
      loadErrorTitle: t("analytics.loadErrorTitle"),
      loadErrorDesc: t("analytics.loadErrorDesc"),
      targetCooperative: t("analytics.targetCooperative"),
      comparisonPeer: t("analytics.comparisonPeer"),
      focusMetric: t("analytics.focusRatioMetric"),
      chooseCooperative: t("analytics.chooseCooperativePlaceholder"),
      searchCooperative: t("analytics.searchCooperative"),
      noCooperativeFound: t("analytics.noCooperativeFound"),
      unknownRegion: t("analytics.unknownRegion"),
      sectorBadge: (sector: string) => t("analytics.sectorBadge", { sector }),
      selectTarget: t("analytics.selectTargetPlaceholder"),
      searchComparison: t("analytics.searchComparison"),
      noComparisonFound: t("analytics.noComparisonFound"),
      averagesGroup: t("analytics.averagesGroup"),
      cooperativesGroup: t("analytics.cooperativesGroup"),
      sectorTargetSubtitle: (sector: string) => t("analytics.sectorTargetSubtitle", { sector }),
      sectorRegionalTargetSubtitle: (sector: string, region: string) =>
        t("analytics.sectorRegionalTargetSubtitle", { sector, region }),
      chooseMetric: t("analytics.chooseKpiPlaceholder"),
      searchMetric: t("analytics.searchKpiMetric"),
      noMetricFound: t("analytics.noKpiFound"),
      nationalAverage: t("analytics.nationalAverage"),
      regionAvg: (region: string) => t("analytics.regionAvg", { region }),
      sectorAvg: t("analytics.sectorAvg"),
      sectorRegionalAvg: (region: string) => t("analytics.sectorRegionalAvg", { region }),
      nationalAverageAll: t("analytics.nationalAverageAll"),
      nationalAverageDesc: t("analytics.nationalAverageDesc"),
      regionAverage: (region: string) => t("analytics.regionAverage", { region }),
      regionAverageDesc: t("analytics.regionAverageDesc"),
      sectorAverage: t("analytics.sectorAverage"),
      sectorAvgDesc: t("analytics.sectorAvgDesc"),
      sectorRegionalAverage: (region: string) => t("analytics.sectorRegionalAverage", { region }),
      sectorRegionalAvgDesc: t("analytics.sectorRegionalAvgDesc"),
      visualBenchmark: t("analytics.visualBenchmark"),
      insightTitle: t("analytics.benchmarkingInsight"),
      outperforming: t("analytics.outperformingPeerGroup"),
      watchRequired: t("analytics.performanceWatchRequired"),
      performingAbovePrefix: t("analytics.performingAbovePrefix"),
      standingBelowPrefix: t("analytics.standingBelowPrefix"),
      abovePeerAverage: t("analytics.abovePeerAverage"),
      belowPeerAverage: t("analytics.belowPeerAverage"),
      matrixTitle: t("analytics.kpiMatrixTitle"),
      matrixSubtitle: t("analytics.kpiMatrixSubtitle"),
      searchPlaceholder: t("analytics.searchKpiPlaceholder"),
      allCategories: (count: number) => t("analytics.allCategories", { count }),
      comparisonAll: t("analytics.comparisonAll"),
      metricKpi: t("analytics.metricKpi"),
      variance: t("analytics.variance"),
      status: t("analytics.status"),
      legendHealthy: t("analytics.legendHealthy"),
      legendWatch: t("analytics.legendWatch"),
      insufficientNational: t("analytics.insufficientNationalData"),
      insufficientRegional: t("analytics.insufficientRegionalData"),
      insufficientSector: t("analytics.insufficientSectorData"),
      insufficientSectorRegional: t("analytics.insufficientSectorRegionalData"),
    }),
    [t, reportingYear],
  );

  return (
    <BenchmarkComparison
      reportingYear={reportingYear}
      metrics={metrics}
      groups={kpiGroups}
      cooperatives={cooperatives}
      isCoopUser={isCoopUser}
      isLoading={isLoading}
      isError={isError}
      serverAverages={serverAverages}
      getValue={getKpiValue}
      labels={labels}
      defaultMetric="capital_adequacy_ratio"
      gradientIdPrefix="std"
    />
  );
}
