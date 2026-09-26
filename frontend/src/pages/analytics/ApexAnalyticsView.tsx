/**
 * ApexAnalyticsView
 * Renders the analytics dashboard for an Apex administrator.
 * Shows: scatter (risk vs return), radar (network performance), leaderboard,
 * NF portfolio summary, and per-coop deep-dive if a coop is selected.
 */
import { useMemo } from "react";
import { X } from "lucide-react";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
import { ApexRadarChart } from "@/components/analytics/ApexRadarChart";
import { CoopScatterPlot } from "@/components/analytics/CoopScatterPlot";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { ComplianceDoughnutCharts } from "@/components/analytics/ComplianceDoughnutCharts";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { NetworkConsolidatedMetrics } from "@/components/analytics/NetworkConsolidatedMetrics";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import { CooperativeRanking } from "@/components/analytics/CooperativeRanking";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import type { AnalyticsFilterValues } from "./analyticsTypes";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function ApexAnalyticsView({ filterValues }: Props) {
  const { t } = useOrganizationLabelsContext();
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      periodType: filterValues.periodType,
      periodValue: filterValues.periodValue,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading: overviewLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const { data: networkTrend } = useMonthlyTrend(params, filterValues.cooperativeId === "all");
  const coops = useMemo(() => overview?.cooperatives ?? [], [overview]);

  if (overviewLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Spinner size="md" /> {t("apexAnalytics.loading")}
      </div>
    );
  }

  /* ── Deep-dive: single cooperative selected ── */
  /* ── Network overview ── */
  return (
    <div className="space-y-6">
      <NetworkConsolidatedMetrics
        nfStats={nfStats}
        networkTrend={networkTrend}
        totalCooperatives={overview?.total_cooperatives ?? 0}
        cooperativesWithData={overview?.cooperatives_with_data ?? 0}
        seriesQuery={params}
      />

      <CollapsibleSection id="analytics-comparison-0" title={t("analytics.section.comparison")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title={t("apexAnalytics.riskVsReturnTitle")}
            subtitle={t("apexAnalytics.riskVsReturnSubtitle")}
            info={t("apexAnalytics.riskVsReturnInfo")}
          >
            <CoopScatterPlot data={coops} />
          </Card>
          <Card
            title={t("apexAnalytics.networkCompTitle")}
            subtitle={t("apexAnalytics.networkCompSubtitle")}
            info={t("apexAnalytics.networkCompInfo")}
          >
            <ApexRadarChart data={coops} />
          </Card>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="analytics-leaderboards-1" title={t("analytics.section.leaderboards")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title={t("apexAnalytics.nplLeaderboardTitle")}
            subtitle={t("apexAnalytics.nplLeaderboardSubtitle")}
            info={t("apexAnalytics.nplLeaderboardInfo")}
          >
            <TopBottomLeaderboard
              cooperatives={coops}
              sortByKpi="npl_ratio"
              higherIsBetter={false}
            />
          </Card>
          {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
            <Card
              title={t("apexAnalytics.trafficLightTitle")}
              subtitle={t("apexAnalytics.trafficLightSubtitle")}
              info={t("apexAnalytics.trafficLightInfo")}
            >
              <ComplianceDoughnutCharts distributions={overview.distributions} />
            </Card>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
