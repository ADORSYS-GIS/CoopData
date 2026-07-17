/**
 * ApexAnalyticsView
 * Renders the analytics dashboard for an Apex administrator.
 * Shows: scatter (risk vs return), radar (network performance), leaderboard,
 * NF portfolio summary, and per-coop deep-dive if a coop is selected.
 */
import { useMemo } from "react";
import { Loader2, X } from "lucide-react";
import { Card } from "@/components/app-shell";
import { ApexRadarChart } from "@/components/analytics/ApexRadarChart";
import { CoopScatterPlot } from "@/components/analytics/CoopScatterPlot";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { ComplianceStackedBars } from "@/components/analytics/ComplianceStackedBars";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { ComplianceRadialGauges } from "@/components/analytics/ComplianceRadialGauges";
import { CoopTrendAreaChart } from "@/components/analytics/CoopTrendAreaChart";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import type { AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filterValues: AnalyticsFilterValues;
  onFilterChange: (id: string, value: string) => void;
}

export function ApexAnalyticsView({ filterValues, onFilterChange }: Props) {
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading: overviewLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const coops = overview?.cooperatives ?? [];

  // Per-coop deep-dive
  const hasSelected = filterValues.cooperativeId !== "all";
  const { data: coopsList } = useCooperatives();
  const selectedCoopProfile = useMemo(
    () => (coopsList ?? []).find((c: { id: string }) => c.id === filterValues.cooperativeId),
    [coopsList, filterValues.cooperativeId],
  );

  // Find the selected coop's submission_id from the overview rows
  const selectedCoopRow = useMemo(
    () => coops.find((c) => c.cooperative_id === filterValues.cooperativeId),
    [coops, filterValues.cooperativeId],
  );
  const { data: deepDiveKpis } = useCooperativeKpis(
    hasSelected ? (selectedCoopRow?.submission_id ?? undefined) : undefined,
  );
  const { data: deepDiveTrend } = useMonthlyTrend(
    { reportingYear: year, cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined },
    hasSelected,
  );
  const { data: deepDiveNf } = useNfStatistics(
    false,
    { reportingYear: year, cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined },
    hasSelected,
  );

  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    deepDiveKpis?.kpis.forEach((k) => { map[k.name] = k.value; });
    return map;
  }, [deepDiveKpis]);

  const trendPoints = useMemo(
    () =>
      (deepDiveTrend?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.assets,
        savings: m.savings,
        loans: m.loans,
      })),
    [deepDiveTrend],
  );

  if (overviewLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-5 animate-spin" /> Loading apex analytics…
      </div>
    );
  }

  /* ── Deep-dive: single cooperative selected ── */
  if (hasSelected && selectedCoopProfile) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="rounded-xl border border-primary/30 bg-primary/4 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              Cooperative Deep Dive
            </p>
            <h2 className="font-heading text-xl font-bold text-foreground">
              {selectedCoopProfile.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedCoopProfile.institution_type} · {selectedCoopProfile.region}
            </p>
          </div>
          <button
            onClick={() => onFilterChange("cooperativeId", "all")}
            className="press-feedback inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="size-3.5" />
            Close Deep Dive
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Regulatory Compliance" subtitle="CAR · Liquidity · NPL">
            <ComplianceRadialGauges
              carValue={kpiMap["capital_adequacy_ratio"] ?? 0}
              liquidityValue={kpiMap["liquid_funds_ratio"] ?? 0}
              nplValue={kpiMap["npl_ratio"] ?? 0}
            />
          </Card>
          {trendPoints.length > 0 && (
            <Card title="Financial Trend" subtitle="12-month assets, loans & savings">
              <CoopTrendAreaChart data={trendPoints} />
            </Card>
          )}
        </div>

        {deepDiveNf && (
          <Card title="Membership Demographics">
            <GenderStatusDoughnuts data={deepDiveNf.membership} />
          </Card>
        )}
      </div>
    );
  }

  /* ── Network overview ── */
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Risk vs Return Profile" subtitle="NPL ratio vs ROA per cooperative">
          <CoopScatterPlot data={coops} />
        </Card>
        <Card title="Network Comparative Performance" subtitle="Radar across key KPI dimensions">
          <ApexRadarChart data={coops} />
        </Card>
      </div>

      <Card title="NPL Leaderboard" subtitle="Best and worst performing cooperatives by NPL ratio">
        <TopBottomLeaderboard cooperatives={coops} sortByKpi="npl_ratio" />
      </Card>

      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <Card title="Traffic Light Distribution" subtitle="KPI health across all cooperatives">
          <ComplianceStackedBars distributions={overview.distributions} />
        </Card>
      )}

      {nfStats && (
        <Card title="Network Demographics" subtitle="Aggregate membership profile">
          <GenderStatusDoughnuts data={nfStats.membership} />
        </Card>
      )}
    </div>
  );
}
