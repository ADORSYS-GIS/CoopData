/**
 * FederationAnalyticsView
 * Renders the analytics dashboard for a Federation administrator.
 * Shows: regional distribution bar, OER leaderboard, traffic-light compliance,
 * and NF portfolio summary. Supports filtering by apex or cooperative.
 */
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/app-shell";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { ComplianceStackedBars } from "@/components/analytics/ComplianceStackedBars";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { ApexRadarChart } from "@/components/analytics/ApexRadarChart";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import type { AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function FederationAnalyticsView({ filterValues }: Props) {
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const coops = overview?.cooperatives ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-5 animate-spin" /> Loading federation analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Regional portfolio distribution */}
      <Card
        title="Regional Portfolio Distribution"
        subtitle="Total assets, loans and deposits by region"
      >
        <RegionalGroupedBar cooperatives={coops} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Efficiency leaderboard (OER — lower = better) */}
        <Card
          title="Operational Efficiency Ranking"
          subtitle="Best and worst OER cooperatives (lower = more efficient)"
        >
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="operating_expense_ratio" />
        </Card>

        {/* ROA leaderboard */}
        <Card title="Profitability Ranking" subtitle="Best and worst ROA cooperatives">
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="roa" />
        </Card>
      </div>

      {/* Network radar */}
      {coops.length > 0 && (
        <Card
          title="Network Performance Radar"
          subtitle="Comparative KPI profile across cooperatives"
        >
          <ApexRadarChart data={coops} />
        </Card>
      )}

      {/* Traffic-light compliance bars */}
      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <Card title="Compliance Traffic-Light Distribution" subtitle="KPI health across the federation">
          <ComplianceStackedBars distributions={overview.distributions} />
        </Card>
      )}

      {/* NF demographics */}
      {nfStats && (
        <Card title="Consolidated Membership Demographics" subtitle="Aggregate gender and activity profile">
          <GenderStatusDoughnuts data={nfStats.membership} />
        </Card>
      )}

      {coops.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No cooperative data available for the selected filters and reporting year.
        </div>
      )}
    </div>
  );
}
