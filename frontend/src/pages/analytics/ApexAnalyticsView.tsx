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
import { ComplianceDoughnutCharts } from "@/components/analytics/ComplianceDoughnutCharts";
import { CooperativeDeepDive } from "@/components/analytics/CooperativeDeepDive";
import { NetworkConsolidatedMetrics } from "@/components/analytics/NetworkConsolidatedMetrics";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
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
  const { data: networkTrend } = useMonthlyTrend(params, filterValues.cooperativeId === "all");
  const coops = overview?.cooperatives ?? [];

  const hasSelected = filterValues.cooperativeId !== "all";
  const selectedCoopRow = useMemo(
    () => coops.find((c) => c.cooperative_id === filterValues.cooperativeId),
    [coops, filterValues.cooperativeId],
  );

  if (overviewLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-5 animate-spin" /> Loading apex analytics…
      </div>
    );
  }

  /* ── Deep-dive: single cooperative selected ── */
  if (hasSelected && selectedCoopRow) {
    return (
      <CooperativeDeepDive
        cooperativeId={selectedCoopRow.cooperative_id}
        submissionId={selectedCoopRow.submission_id}
        cooperativeName={selectedCoopRow.name}
        cooperativeRegion={selectedCoopRow.region}
        cooperativeType={selectedCoopRow.institution_type}
        reportingYear={year}
        onClose={() => onFilterChange("cooperativeId", "all")}
      />
    );
  }

  /* ── Network overview ── */
  return (
    <div className="space-y-6">
      <NetworkConsolidatedMetrics 
        nfStats={nfStats}
        networkTrend={networkTrend}
        totalCooperatives={overview?.total_cooperatives ?? 0}
        cooperativesWithData={overview?.cooperatives_with_data ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card 
          title="Risk vs Return Profile" 
          subtitle="NPL ratio vs ROA per cooperative"
          info="A scatter plot mapping the risk (Non-Performing Loans ratio) against the return (Return on Assets) for each cooperative in the network."
        >
          <CoopScatterPlot data={coops} />
        </Card>
        <Card 
          title="Network Comparative Performance" 
          subtitle="Radar across key KPI dimensions"
          info="A radar chart visualizing average performance across multiple dimensions including Management Efficiency, Asset Quality, and Capital Adequacy."
        >
          <ApexRadarChart data={coops} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card 
          title="NPL Leaderboard" 
          subtitle="Best and worst performing cooperatives by NPL ratio"
          info="Highlights the cooperatives with the best and worst Non-Performing Loan ratios to identify excellence and areas requiring intervention."
        >
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="npl_ratio" />
        </Card>
        {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
          <Card 
            title="Traffic Light Distribution" 
            subtitle="KPI health across all cooperatives"
            info="Shows the distribution of cooperatives falling into Healthy (Green), Watch (Amber), and Risk (Red) categories for various key performance indicators."
          >
            <ComplianceDoughnutCharts distributions={overview.distributions} />
          </Card>
        )}
      </div>
    </div>
  );
}
