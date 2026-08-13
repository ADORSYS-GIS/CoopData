import type { LucideIcon } from "lucide-react";

/** A comparison group (display section) used by the matrix, chips and combobox. */
export interface BenchmarkGroup {
  label: string;
  icon: LucideIcon;
  colorClass: string;
  /** Icon color used in the metric combobox (e.g. "text-blue-400"). */
  comboboxIconClass: string;
}

/** One comparable metric/KPI in a benchmarking widget. */
export interface BenchmarkMetric {
  key: string;
  label: string;
  unit: string;
  group: string;
  description: string;
  /** When true, a lower value is considered better (e.g. expenditure, NPL ratio). */
  isLowerBetter?: boolean;
}

/** Structural view of a cooperative row shared by both benchmarking widgets. */
export interface BenchmarkRow {
  cooperative_id: string;
  name: string;
  region: string | null;
  sector: string | null;
  has_data: boolean;
}

/** Server-computed averages for cooperative callers (privacy-safe) plus the
 *  min-contributor withholding flags for each slice. */
export interface BenchmarkAverages {
  national: Record<string, number> | null;
  regional: Record<string, number> | null;
  sector: Record<string, number> | null;
  sectorRegional: Record<string, number> | null;
  insufficient: {
    national: boolean;
    regional: boolean;
    sector: boolean;
    sectorRegional: boolean;
  };
}

/** Fully-resolved display strings for the benchmark widget. The widget itself
 *  is i18n-agnostic — each wrapper resolves its own keys (standard vs basic). */
export interface BenchmarkComparisonLabels {
  title: string;
  subtitle: string;
  info: string;
  loading: string;
  // Empty / error states
  coopNoDataTitle: string;
  coopNoDataDesc: string;
  noPopulationDataTitle: string;
  noPopulationDataDesc: string;
  noSubmittedData: string;
  loadErrorTitle: string;
  loadErrorDesc: string;
  // Control panel
  targetCooperative: string;
  comparisonPeer: string;
  focusMetric: string;
  chooseCooperative: string;
  searchCooperative: string;
  noCooperativeFound: string;
  unknownRegion: string;
  sectorBadge: (sector: string) => string;
  selectTarget: string;
  searchComparison: string;
  noComparisonFound: string;
  averagesGroup: string;
  cooperativesGroup: string;
  sectorTargetSubtitle: (sector: string) => string;
  sectorRegionalTargetSubtitle: (sector: string, region: string) => string;
  chooseMetric: string;
  searchMetric: string;
  noMetricFound: string;
  // Comparison targets
  nationalAverage: string;
  regionAvg: (region: string) => string;
  sectorAvg: string;
  sectorRegionalAvg: (region: string) => string;
  nationalAverageAll: string;
  nationalAverageDesc: string;
  regionAverage: (region: string) => string;
  regionAverageDesc: string;
  sectorAverage: string;
  sectorAvgDesc: string;
  sectorRegionalAverage: (region: string) => string;
  sectorRegionalAvgDesc: string;
  // Chart + insight
  visualBenchmark: string;
  insightTitle: string;
  outperforming: string;
  watchRequired: string;
  performingAbovePrefix: string;
  standingBelowPrefix: string;
  abovePeerAverage: string;
  belowPeerAverage: string;
  // Matrix
  matrixTitle: string;
  matrixSubtitle: string;
  searchPlaceholder: string;
  allCategories: (count: number) => string;
  comparisonAll: string;
  metricKpi: string;
  variance: string;
  status: string;
  legendHealthy: string;
  legendWatch: string;
  // Insufficient-data notices
  insufficientNational: string;
  insufficientRegional: string;
  insufficientSector: string;
  insufficientSectorRegional: string;
}

/** The subset of labels used by the standalone matrix component. */
export interface BenchmarkMatrixLabels {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  allCategories: (count: number) => string;
  comparisonAll: string;
  metricKpi: string;
  variance: string;
  status: string;
  legendHealthy: string;
  legendWatch: string;
}
