/**
 * FederationAnalyticsView
 * Renders the analytics dashboard for a Federation administrator.
 * Shows: regional distribution bar, OER leaderboard, traffic-light compliance,
 * and NF portfolio summary. Supports filtering by apex or cooperative.
 */
import { useMemo } from "react";
import {} from "lucide-react";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { ComplianceDoughnutCharts } from "@/components/analytics/ComplianceDoughnutCharts";
import { NetworkConsolidatedMetrics } from "@/components/analytics/NetworkConsolidatedMetrics";
import { ApexRadarChart } from "@/components/analytics/ApexRadarChart";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import { CooperativeRanking } from "@/components/analytics/CooperativeRanking";
import { ApexDistributionBar } from "@/components/analytics/ApexDistributionBar";
import { aggregateLoanGap } from "@/lib/loan-gap";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import type { AnalyticsFilterValues } from "./analyticsTypes";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function FederationAnalyticsView({ filterValues }: Props) {
  const { t } = useOrganizationLabelsContext();
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      periodType: filterValues.periodType,
      periodValue: filterValues.periodValue,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const { data: networkTrend } = useMonthlyTrend(params, filterValues.cooperativeId === "all");
  const coops = useMemo(() => overview?.cooperatives ?? [], [overview]);

  const aggMetrics = useMemo(() => aggregateLoanGap(coops), [coops]);

  const totalApexes = useMemo(() => {
    const apexSet = new Set<string>();
    coops.forEach((c) => {
      if (c.apex_id) apexSet.add(c.apex_id);
    });
    return apexSet.size;
  }, [coops]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Spinner size="md" /> {t("federationAnalytics.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NetworkConsolidatedMetrics
        nfStats={nfStats}
        networkTrend={networkTrend}
        totalCooperatives={overview?.total_cooperatives ?? 0}
        cooperativesWithData={overview?.cooperatives_with_data ?? 0}
        seriesQuery={params}
        totalApexes={totalApexes}
      />

      {/* Apex & Regional Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={t("federationAnalytics.apexDistTitle")}
          subtitle={t("federationAnalytics.apexDistSubtitle")}
          info={t("federationAnalytics.apexDistInfo")}
        >
          <ApexDistributionBar cooperatives={coops} />
        </Card>

        <Card
          title={t("federationAnalytics.regionalPortfolioTitle")}
          subtitle={t("federationAnalytics.regionalPortfolioSubtitle")}
          info={t("federationAnalytics.regionalPortfolioInfo")}
        >
          <RegionalGroupedBar cooperatives={coops} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Efficiency leaderboard (OER — lower = better) */}
        <Card
          title={t("federationAnalytics.oerRankingTitle")}
          subtitle={t("federationAnalytics.oerRankingSubtitle")}
          info={t("federationAnalytics.oerRankingInfo")}
        >
          <TopBottomLeaderboard
            cooperatives={coops}
            sortByKpi="operating_expense_ratio"
            higherIsBetter={false}
          />
        </Card>

        {/* ROA leaderboard */}
        <Card
          title={t("federationAnalytics.profitabilityRankingTitle")}
          subtitle={t("federationAnalytics.profitabilityRankingSubtitle")}
          info={t("federationAnalytics.profitabilityRankingInfo")}
        >
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="roa" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {coops.length > 0 && (
          <Card
            title={t("federationAnalytics.radarTitle")}
            subtitle={t("federationAnalytics.radarSubtitle")}
            info={t("federationAnalytics.radarInfo")}
          >
            <ApexRadarChart data={coops} />
          </Card>
        )}
        {coops.length > 0 && (
          <Card
            title={t("federationAnalytics.loanGapTitle")}
            subtitle={t("federationAnalytics.loanGapSubtitle")}
            info={t("federationAnalytics.loanGapInfo")}
          >
            <LoanProvisioningWaterfall
              glp={aggMetrics.totalGLP}
              par30_pct={aggMetrics.par30Pct}
              provisions_pct={aggMetrics.provisionsPct}
            />
          </Card>
        )}
      </div>

      {/* Traffic-light compliance bars */}
      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <Card
          title={t("federationAnalytics.complianceTitle")}
          subtitle={t("federationAnalytics.complianceSubtitle")}
          info={t("federationAnalytics.complianceInfo")}
        >
          <ComplianceDoughnutCharts distributions={overview.distributions} />
        </Card>
      )}

      {coops.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {t("federationAnalytics.noData")}
        </div>
      )}
    </div>
  );
}
