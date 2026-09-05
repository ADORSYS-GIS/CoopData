import React, { useCallback, useMemo } from "react";
import { BarChart3, Coins, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBasicBenchmark, type BasicBenchmarkRow } from "@/hooks/analytics/useBasicBenchmark";
import { BenchmarkComparison } from "@/components/analytics/benchmark-comparison";
import type {
  BenchmarkComparisonLabels,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkRow,
} from "@/components/analytics/benchmark-types";
import { buildBasicMetrics } from "@/components/analytics/basic-benchmark-utils";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

interface BasicCooperativeComparisonProps {
  reportingYear: number;
}

// Group definitions for questionnaire metrics
function buildMetricGroups(t: (key: string) => string): Record<string, BenchmarkGroup> {
  return {
    membership: {
      label: t("basicBenchmarking.groups.membership"),
      icon: Users,
      colorClass: "text-success bg-success/10 dark:bg-success/30",
      comboboxIconClass: "text-success",
    },
    balances: {
      label: t("basicBenchmarking.groups.balances"),
      icon: Coins,
      colorClass: "text-accent bg-accent/10 dark:bg-primary/30",
      comboboxIconClass: "text-accent",
    },
    income: {
      label: t("basicBenchmarking.groups.income"),
      icon: BarChart3,
      colorClass: "text-accent bg-accent/10 dark:bg-accent/30",
      comboboxIconClass: "text-accent",
    },
  };
}

export function BasicCooperativeComparison({ reportingYear }: BasicCooperativeComparisonProps) {
  const { t } = useOrganizationLabelsContext();
  const { role } = useAuth();
  const isCoopUser = role === "cooperative";

  const metricGroups = useMemo(() => buildMetricGroups(t), [t]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = useMemo(() => buildBasicMetrics(t as any), [t]);

  // The benchmark endpoint serves both roles: coop callers get their own row +
  // server averages; admin callers get the full rows for their scope.
  const { data: benchmark, isLoading, isError } = useBasicBenchmark({ reportingYear }, true);

  // Rows available to the widget: own row for coop users, the scoped population
  // for admins. A coop without approved questionnaire data has no row.
  const cooperatives = useMemo(() => {
    if (isCoopUser) return benchmark?.cooperative ? [benchmark.cooperative] : [];
    return (benchmark?.rows ?? []) as BenchmarkRow[];
  }, [isCoopUser, benchmark]);

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

  const getMetricValue = useCallback((row: BenchmarkRow, metricKey: string) => {
    return ((row as BasicBenchmarkRow).metrics?.[metricKey] ?? 0) as number;
  }, []);

  const labels = useMemo<BenchmarkComparisonLabels>(
    () => ({
      title: t("basicBenchmarking.title"),
      subtitle: t("basicBenchmarking.subtitle", { year: reportingYear }),
      info: t("basicBenchmarking.info"),
      loading: t("analytics.assemblingPerformanceStats"),
      coopNoDataTitle: t("basicBenchmarking.noApprovedDataTitle"),
      coopNoDataDesc: t("basicBenchmarking.noApprovedDataDesc", { year: reportingYear }),
      noPopulationDataTitle: t("basicBenchmarking.noDataTitle"),
      noPopulationDataDesc: t("basicBenchmarking.noDataDesc", { year: reportingYear }),
      noSubmittedData: t("analytics.noSubmittedDataYear", { year: reportingYear }),
      loadErrorTitle: t("basicBenchmarking.loadErrorTitle"),
      loadErrorDesc: t("basicBenchmarking.loadErrorDesc"),
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
      sectorAvg: t("basicBenchmarking.sectorAvg"),
      sectorRegionalAvg: (region: string) => t("basicBenchmarking.sectorRegionalAvg", { region }),
      nationalAverageAll: t("analytics.nationalAverageAll"),
      nationalAverageDesc: t("analytics.nationalAverageDesc"),
      regionAverage: (region: string) => t("analytics.regionAverage", { region }),
      regionAverageDesc: t("analytics.regionAverageDesc"),
      sectorAverage: t("basicBenchmarking.sectorAverage"),
      sectorAvgDesc: t("basicBenchmarking.sectorAvgDesc"),
      sectorRegionalAverage: (region: string) =>
        t("basicBenchmarking.sectorRegionalAverage", { region }),
      sectorRegionalAvgDesc: t("basicBenchmarking.sectorRegionalAvgDesc"),
      visualBenchmark: t("analytics.visualBenchmark"),
      insightTitle: t("analytics.benchmarkingInsight"),
      outperforming: t("analytics.outperformingPeerGroup"),
      watchRequired: t("analytics.performanceWatchRequired"),
      performingAbovePrefix: t("analytics.performingAbovePrefix"),
      standingBelowPrefix: t("analytics.standingBelowPrefix"),
      abovePeerAverage: t("analytics.abovePeerAverage"),
      belowPeerAverage: t("analytics.belowPeerAverage"),
      matrixTitle: t("basicBenchmarking.matrixTitle"),
      matrixSubtitle: t("basicBenchmarking.matrixSubtitle"),
      searchPlaceholder: t("analytics.searchKpiPlaceholder"),
      allCategories: (count: number) => t("analytics.allCategories", { count }),
      comparisonAll: t("analytics.comparisonAll"),
      metricKpi: t("analytics.metricKpi"),
      variance: t("analytics.variance"),
      status: t("analytics.status"),
      legendHealthy: t("analytics.legendHealthy"),
      legendWatch: t("analytics.legendWatch"),
      insufficientNational: t("basicBenchmarking.insufficientNationalData"),
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
      groups={metricGroups}
      cooperatives={cooperatives}
      isCoopUser={isCoopUser}
      isLoading={isLoading}
      isError={isError}
      serverAverages={serverAverages}
      getValue={getMetricValue}
      labels={labels}
      defaultMetric="total_share_capital"
      gradientIdPrefix="basic"
    />
  );
}
