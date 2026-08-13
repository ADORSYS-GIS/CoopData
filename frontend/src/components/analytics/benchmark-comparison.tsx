import React, { useMemo, useState } from "react";
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
import { Card } from "@/components/app-shell";
import { SearchableCombobox, type ComboboxOption } from "@/components/ui/searchable-combobox";
import {
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  Percent,
  ShieldAlert,
  Globe,
  MapPin,
  Briefcase,
} from "lucide-react";
import { BenchmarkMatrix } from "@/components/analytics/benchmark-matrix";
import { computeKpiAverages } from "@/components/analytics/benchmark-utils";
import type {
  BenchmarkAverages,
  BenchmarkComparisonLabels,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkRow,
} from "@/components/analytics/benchmark-types";

// Minimum number of contributing cooperatives-with-data required before a
// sector / sector+regional average is disclosed client-side for admin users.
//
// Security model (why admins may use 2 while coop users are held to 3):
// - Cooperative callers never see other cooperatives' rows — the backend
//   returns only their own row plus server-computed averages, and enforces
//   MIN_CONTRIBUTORS = 3 (services/benchmark.rs) so a coop cannot derive a
//   competitor's value from a small average. This is the differential-privacy
//   guard that matters.
// - Admin callers (ministry / federation / apex) are already authorized to see
//   the raw rows of every cooperative in their scope (the backend returns the
//   full `rows` array to them). A 2-coop sector/regional average therefore
//   reveals nothing they do not already have direct access to, so the relaxed
//   client-side threshold of 2 is acceptable for them.
const MIN_CONTRIBUTORS_ADMIN = 2;

interface BenchmarkComparisonProps {
  reportingYear: number;
  metrics: BenchmarkMetric[];
  groups: Record<string, BenchmarkGroup>;
  /** Rows available to the widget: the caller's own row for coop users, the
   *  scoped population for admin users. */
  cooperatives: BenchmarkRow[];
  isCoopUser: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Server-computed averages for coop users (privacy-safe). Null for admins —
   *  the widget computes averages client-side over `cooperatives`. */
  serverAverages: BenchmarkAverages | null;
  getValue: (row: BenchmarkRow, metricKey: string) => number;
  labels: BenchmarkComparisonLabels;
  defaultMetric: string;
  /** Prefix for the SVG gradient ids so multiple instances never collide. */
  gradientIdPrefix?: string;
}

/**
 * The shared benchmarking widget: three-column control panel, comparison chart,
 * insight card and metric matrix. Used by both the standard (financial
 * statement) and basic (questionnaire) benchmarking tabs; the difference is
 * entirely carried by the props (metric config, data source, labels).
 */
export function BenchmarkComparison({
  reportingYear,
  metrics,
  groups,
  cooperatives,
  isCoopUser,
  isLoading,
  isError,
  serverAverages,
  getValue,
  labels,
  defaultMetric,
  gradientIdPrefix = "benchmark",
}: BenchmarkComparisonProps) {
  // Cooperatives with valid submission data
  const cooperativesWithData = useMemo(() => {
    return cooperatives.filter((c) => c.has_data);
  }, [cooperatives]);

  // Default selected cooperative — own row for coop users, first with data for admins
  const defaultCoopId = useMemo(() => {
    if (isCoopUser) return cooperatives[0]?.cooperative_id ?? "";
    return cooperativesWithData[0]?.cooperative_id ?? "all";
  }, [isCoopUser, cooperatives, cooperativesWithData]);

  const [selectedCoopId, setSelectedCoopId] = useState("");
  const [compareTargetId, setCompareTargetId] = useState("national_average");
  const [selectedKpi, setSelectedKpi] = useState(defaultMetric);

  // Keep state synced with default when data loads
  React.useEffect(() => {
    if (defaultCoopId && defaultCoopId !== "all" && !selectedCoopId) {
      setSelectedCoopId(defaultCoopId);
    }
  }, [defaultCoopId, selectedCoopId]);

  const activeCoopId = selectedCoopId || defaultCoopId;

  const selectedCoop = useMemo(() => {
    return cooperatives.find((c) => c.cooperative_id === activeCoopId);
  }, [cooperatives, activeCoopId]);

  const selectedCoopSector = selectedCoop?.sector ?? null;
  const selectedCoopRegion = selectedCoop?.region ?? null;

  // Available regions — coop users only see their own region (the server sends
  // only their regional average); admins see every region in the population.
  const availableRegions = useMemo(() => {
    if (isCoopUser) {
      const region = cooperatives[0]?.region;
      return region ? [region] : [];
    }
    const regions = new Set<string>();
    cooperativesWithData.forEach((c) => {
      if (c.region) regions.add(c.region);
    });
    return Array.from(regions).sort();
  }, [isCoopUser, cooperatives, cooperativesWithData]);

  // Selected target details (National/Regional/Sector averages, or Coop B)
  const compareTarget = useMemo(() => {
    if (compareTargetId === "national_average") {
      return {
        name: labels.nationalAverage,
        isAverage: true,
        isRegional: false,
        isSector: false,
        region: null as string | null,
        sector: null as string | null,
      };
    }
    if (compareTargetId.startsWith("region_avg_")) {
      const region = compareTargetId.replace("region_avg_", "");
      return {
        name: labels.regionAvg(region),
        isAverage: true,
        isRegional: true,
        isSector: false,
        region,
        sector: null as string | null,
      };
    }
    if (compareTargetId === "sector_avg") {
      return {
        name: labels.sectorAvg,
        isAverage: true,
        isRegional: false,
        isSector: true,
        region: null as string | null,
        sector: selectedCoopSector,
      };
    }
    if (compareTargetId === "sector_regional_avg") {
      return {
        name: labels.sectorRegionalAvg(selectedCoopRegion ?? ""),
        isAverage: true,
        isRegional: true,
        isSector: true,
        region: selectedCoopRegion,
        sector: selectedCoopSector,
      };
    }
    const coop = cooperatives.find((c) => c.cooperative_id === compareTargetId);
    return coop
      ? {
          ...coop,
          isAverage: false,
          isRegional: false,
          isSector: false,
          region: coop.region ?? null,
          sector: coop.sector ?? null,
        }
      : {
          name: labels.nationalAverage,
          isAverage: true,
          isRegional: false,
          isSector: false,
          region: null as string | null,
          sector: null as string | null,
        };
  }, [cooperatives, compareTargetId, labels, selectedCoopSector, selectedCoopRegion]);

  // National averages — coop users consume the server-computed value.
  const systemAverages = useMemo(() => {
    if (isCoopUser) return serverAverages?.national ?? {};
    return computeKpiAverages(cooperativesWithData, metrics, getValue);
  }, [isCoopUser, serverAverages, cooperativesWithData, metrics, getValue]);

  // Regional averages keyed by region name → metric key → average value.
  // Coop users consume the server-computed regional average for their own region.
  const regionalAverages = useMemo(() => {
    if (isCoopUser) {
      const region = cooperatives[0]?.region;
      if (region && serverAverages?.regional) {
        return { [region]: serverAverages.regional };
      }
      return {};
    }
    const result: Record<string, Record<string, number>> = {};
    availableRegions.forEach((region) => {
      const regionCoops = cooperativesWithData.filter((c) => c.region === region);
      result[region] = computeKpiAverages(regionCoops, metrics, getValue);
    });
    return result;
  }, [
    isCoopUser,
    cooperatives,
    serverAverages,
    cooperativesWithData,
    availableRegions,
    metrics,
    getValue,
  ]);

  // Sector average for the selected coop's sector (nationally).
  // Coop users consume the server-computed sector average; admin users compute
  // it over their scoped coops but withhold it below MIN_CONTRIBUTORS_ADMIN.
  const sectorAverages = useMemo(() => {
    if (isCoopUser) return serverAverages?.sector ?? null;
    if (!selectedCoopSector) return null;
    const sectorCoops = cooperativesWithData.filter((c) => c.sector === selectedCoopSector);
    if (sectorCoops.length < MIN_CONTRIBUTORS_ADMIN) return null;
    return computeKpiAverages(sectorCoops, metrics, getValue);
  }, [isCoopUser, serverAverages, selectedCoopSector, cooperativesWithData, metrics, getValue]);

  // Sector+regional average for the selected coop's sector within its region.
  const sectorRegionalAverages = useMemo(() => {
    if (isCoopUser) return serverAverages?.sectorRegional ?? null;
    if (!selectedCoopSector || !selectedCoopRegion) return null;
    const coops = cooperativesWithData.filter(
      (c) => c.sector === selectedCoopSector && c.region === selectedCoopRegion,
    );
    if (coops.length < MIN_CONTRIBUTORS_ADMIN) return null;
    return computeKpiAverages(coops, metrics, getValue);
  }, [
    isCoopUser,
    serverAverages,
    selectedCoopSector,
    selectedCoopRegion,
    cooperativesWithData,
    metrics,
    getValue,
  ]);

  // Helper to get comparison value for a metric based on the selected target
  const getCompareValue = (metricKey: string): number => {
    if (compareTarget.isSector && compareTarget.isRegional) {
      return sectorRegionalAverages?.[metricKey] ?? 0;
    }
    if (compareTarget.isSector) {
      return sectorAverages?.[metricKey] ?? 0;
    }
    if (compareTarget.isRegional && compareTarget.region) {
      return regionalAverages[compareTarget.region]?.[metricKey] ?? 0;
    }
    if (compareTarget.isAverage) {
      return systemAverages[metricKey] ?? 0;
    }
    return getValue(compareTarget as BenchmarkRow, metricKey);
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

  const activeMetricInfo = useMemo(() => {
    return metrics.find((m) => m.key === selectedKpi);
  }, [selectedKpi, metrics]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!selectedCoop || !selectedCoop.has_data) return [];
    const metricInfo = metrics.find((m) => m.key === selectedKpi);
    if (!metricInfo) return [];
    const coopVal = getValue(selectedCoop, selectedKpi);
    const targetVal = getCompareValue(selectedKpi);
    return [
      { name: selectedCoop.name, Value: coopVal, color: "#3b82f6" },
      { name: compareTarget.name, Value: targetVal, color: "#10b981" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCoop,
    selectedKpi,
    compareTarget,
    systemAverages,
    regionalAverages,
    sectorAverages,
    sectorRegionalAverages,
  ]);

  // Comparison peer options — coop users only see averages (never other coops)
  const peerOptions = useMemo(() => {
    const averages: ComboboxOption[] = [
      {
        value: "national_average",
        label: labels.nationalAverageAll,
        description: labels.nationalAverageDesc,
        group: "averages",
      },
      ...availableRegions.map((region) => ({
        value: `region_avg_${region}`,
        label: labels.regionAverage(region),
        description: labels.regionAverageDesc,
        group: "averages",
      })),
    ];
    if (selectedCoopSector) {
      averages.push({
        value: "sector_avg",
        label: labels.sectorAverage,
        description: labels.sectorAvgDesc,
        group: "averages",
      });
      if (selectedCoopRegion) {
        averages.push({
          value: "sector_regional_avg",
          label: labels.sectorRegionalAverage(selectedCoopRegion),
          description: labels.sectorRegionalAvgDesc,
          group: "averages",
        });
      }
    }
    if (isCoopUser) return averages;
    return [
      ...averages,
      ...cooperativesWithData
        .filter((c) => c.cooperative_id !== activeCoopId)
        .map((c) => ({
          value: c.cooperative_id,
          label: c.name,
          description: c.region ?? labels.unknownRegion,
          group: "cooperatives",
          icon: <Users className="size-3 text-blue-400" />,
        })),
    ];
  }, [
    isCoopUser,
    availableRegions,
    selectedCoopSector,
    selectedCoopRegion,
    cooperativesWithData,
    activeCoopId,
    labels,
  ]);

  // True when the selected average was withheld for too few contributors.
  // Coop users rely on the backend's insufficient_data flags; apex/federation
  // users rely on the client-side MIN_CONTRIBUTORS guard (null average).
  const isNationalInsufficient =
    isCoopUser &&
    compareTarget.isAverage &&
    !compareTarget.isRegional &&
    !compareTarget.isSector &&
    (serverAverages?.insufficient.national ?? false);
  const isRegionalInsufficient =
    isCoopUser &&
    compareTarget.isRegional &&
    !compareTarget.isSector &&
    (serverAverages?.insufficient.regional ?? false);
  const isSectorInsufficient =
    compareTarget.isSector && !compareTarget.isRegional && sectorAverages == null;
  const isSectorRegionalInsufficient =
    compareTarget.isSector && compareTarget.isRegional && sectorRegionalAverages == null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-medium tracking-wide">{labels.loading}</span>
      </div>
    );
  }

  // A failed request is an error — never conflate it with a "no data" state.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {labels.loadErrorTitle}
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{labels.loadErrorDesc}</p>
      </div>
    );
  }

  // Coop user with no approved/submitted data for the year — a legitimate empty
  // state, not an error: the backend returns `cooperative: null` with 200 OK.
  if (isCoopUser && cooperatives.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 opacity-60 mb-3" />
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {labels.coopNoDataTitle}
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{labels.coopNoDataDesc}</p>
      </div>
    );
  }

  // Coop user whose own submission exists but carries no benchmarkable data.
  // (The inline amber notice further below covers the admin case where the
  // selected coop lacks data while others in the population have it.)
  if (isCoopUser && cooperatives[0] && !cooperatives[0].has_data) {
    return (
      <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0 text-amber-500" />
        <span>{labels.noSubmittedData}</span>
      </div>
    );
  }

  // Handle case where no cooperatives have data (admin path)
  if (cooperativesWithData.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 opacity-60 mb-3" />
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          {labels.noPopulationDataTitle}
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          {labels.noPopulationDataDesc}
        </p>
      </div>
    );
  }

  const coopGradientId = `${gradientIdPrefix}ColorCoop`;
  const peerGradientId = `${gradientIdPrefix}ColorPeer`;

  return (
    <div className="space-y-6">
      <Card title={labels.title} subtitle={labels.subtitle} info={labels.info}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* ── Target cooperative ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> {labels.targetCooperative}
            </label>
            <SearchableCombobox
              value={activeCoopId}
              onChange={(val) => val && setSelectedCoopId(val)}
              options={cooperativesWithData.map((c) => ({
                value: c.cooperative_id,
                label: c.name,
                description: c.region ?? labels.unknownRegion,
                icon: <MapPin className="size-3 text-blue-400" />,
              }))}
              placeholder={labels.chooseCooperative}
              searchPlaceholder={labels.searchCooperative}
              emptyMessage={labels.noCooperativeFound}
              disabled={isCoopUser}
            />
            {selectedCoop && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedCoopSector && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <Briefcase className="size-3" /> {labels.sectorBadge(selectedCoopSector)}
                  </span>
                )}
                {selectedCoopRegion && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    <MapPin className="size-3" /> {selectedCoopRegion}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Comparison peer ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ArrowRightLeft className="size-3.5 text-emerald-500" /> {labels.comparisonPeer}
            </label>
            <SearchableCombobox
              value={compareTargetId}
              onChange={(val) => val && setCompareTargetId(val)}
              options={peerOptions}
              groups={[
                {
                  key: "averages",
                  label: labels.averagesGroup,
                  icon: <Globe className="size-3" />,
                },
                {
                  key: "cooperatives",
                  label: labels.cooperativesGroup,
                  icon: <Users className="size-3" />,
                },
              ]}
              placeholder={labels.selectTarget}
              searchPlaceholder={labels.searchComparison}
              emptyMessage={labels.noComparisonFound}
            />
            {compareTarget.isSector && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1">
                <Briefcase className="size-3 text-indigo-400" />
                {compareTarget.isRegional
                  ? labels.sectorRegionalTargetSubtitle(
                      selectedCoopSector ?? "",
                      selectedCoopRegion ?? "",
                    )
                  : labels.sectorTargetSubtitle(selectedCoopSector ?? "")}
              </p>
            )}
          </div>

          {/* ── Focus metric ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Percent className="size-3.5 text-indigo-500" /> {labels.focusMetric}
            </label>
            <SearchableCombobox
              value={selectedKpi}
              onChange={(val) => val && setSelectedKpi(val)}
              options={metrics.map((metric) => {
                const group = groups[metric.group];
                const Icon = group?.icon ?? Users;
                return {
                  value: metric.key,
                  label: metric.label,
                  description: metric.description,
                  group: metric.group,
                  icon: (
                    <Icon className={`size-3 ${group?.comboboxIconClass ?? "text-slate-400"}`} />
                  ),
                };
              })}
              groups={Object.entries(groups).map(([key, group]) => ({
                key,
                label: group.label,
                icon: <group.icon className="size-3" />,
              }))}
              placeholder={labels.chooseMetric}
              searchPlaceholder={labels.searchMetric}
              emptyMessage={labels.noMetricFound}
            />
          </div>
        </div>

        {selectedCoop && !selectedCoop.has_data ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{labels.noSubmittedData}</span>
          </div>
        ) : isNationalInsufficient ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2 mt-6">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{labels.insufficientNational}</span>
          </div>
        ) : isSectorRegionalInsufficient ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2 mt-6">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{labels.insufficientSectorRegional}</span>
          </div>
        ) : isSectorInsufficient ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2 mt-6">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{labels.insufficientSector}</span>
          </div>
        ) : isRegionalInsufficient ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2 mt-6">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{labels.insufficientRegional}</span>
          </div>
        ) : selectedCoop && activeMetricInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Recharts Bar Chart */}
            <div className="lg:col-span-2 border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-primary" /> {labels.visualBenchmark}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {activeMetricInfo.description}
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
                      <linearGradient id={coopGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id={peerGradientId} x1="0" y1="0" x2="0" y2="1">
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
                          {formatValue(Number(val), activeMetricInfo.unit)}
                        </span>,
                        activeMetricInfo.label,
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
                          fill={index === 0 ? `url(#${coopGradientId})` : `url(#${peerGradientId})`}
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
                  {labels.insightTitle}
                </h4>
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/30 dark:bg-blue-950/10 rounded-xl border border-blue-100/50 dark:border-blue-900/10">
                    <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                      {selectedCoop.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
                      {formatValue(getValue(selectedCoop, selectedKpi), activeMetricInfo.unit)}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {compareTarget.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
                      {formatValue(getCompareValue(selectedKpi), activeMetricInfo.unit)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {(() => {
                  const coopVal = getValue(selectedCoop, selectedKpi);
                  const targetVal = getCompareValue(selectedKpi);
                  const diff = coopVal - targetVal;
                  const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                  // Lower is better for e.g. expenditure, NPL, PAR, dormancy.
                  const isPositiveIndicator = !(activeMetricInfo.isLowerBetter ?? false);
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
                          {isBetter ? labels.outperforming : labels.watchRequired}
                        </p>
                        <p className="text-[11px] opacity-80 mt-1.5 leading-normal">
                          {isBetter ? labels.performingAbovePrefix : labels.standingBelowPrefix}
                          <span className="font-bold">
                            {Math.abs(percentDiff).toFixed(1)}%
                          </span>{" "}
                          {isBetter ? labels.abovePeerAverage : labels.belowPeerAverage}
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

      {/* Metric Comparison Matrix Table */}
      {selectedCoop && selectedCoop.has_data && (
        <BenchmarkMatrix
          metrics={metrics}
          groups={groups}
          selectedCoop={selectedCoop}
          compareTargetName={compareTarget.name}
          getValue={getValue}
          getCompareValue={getCompareValue}
          selectedKpi={selectedKpi}
          onSelectKpi={setSelectedKpi}
          formatValue={formatValue}
          labels={{
            title: labels.matrixTitle,
            subtitle: labels.matrixSubtitle,
            searchPlaceholder: labels.searchPlaceholder,
            allCategories: labels.allCategories,
            comparisonAll: labels.comparisonAll,
            metricKpi: labels.metricKpi,
            variance: labels.variance,
            status: labels.status,
            legendHealthy: labels.legendHealthy,
            legendWatch: labels.legendWatch,
          }}
        />
      )}
    </div>
  );
}
