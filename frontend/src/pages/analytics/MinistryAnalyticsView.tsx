/**
 * MinistryAnalyticsView
 * Renders the national analytics dashboard for Ministry administrators.
 * Shows: macro portfolio distribution map, national NF demographics,
 * NF portfolio indicators, compliance distribution, and the
 * full non-financial consolidation panel.
 */
import { useMemo } from "react";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { MetricsGridCards } from "@/components/analytics/MetricsGridCards";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { NetworkConsolidatedMetrics } from "@/components/analytics/NetworkConsolidatedMetrics";
import { ComplianceDoughnutCharts } from "@/components/analytics/ComplianceDoughnutCharts";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { NonFinancialConsolidation } from "@/components/analytics/non-financial-consolidation";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import { CooperativeRanking } from "@/components/analytics/CooperativeRanking";
import { aggregateLoanGap } from "@/lib/loan-gap";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import type { AnalyticsFilterValues } from "./analyticsTypes";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function MinistryAnalyticsView({ filterValues }: Props) {
  const { t } = useOrganizationLabelsContext();
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      periodType: filterValues.periodType,
      periodValue: filterValues.periodValue,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      federationId: filterValues.federationId !== "all" ? filterValues.federationId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const { data: networkTrend } = useMonthlyTrend(params, filterValues.cooperativeId === "all");
  const { data: ministryStats } = useMinistryStats();

  const coops = useMemo(() => overview?.cooperatives ?? [], [overview]);
  const nfSummary = overview?.non_financial_summary;

  const aggMetrics = useMemo(() => aggregateLoanGap(coops), [coops]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Spinner size="md" /> {t("ministryAnalytics.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ministry headline stats */}
      {ministryStats && (
        <MetricsGridCards
          columns={4}
          metrics={[
            {
              label: t("ministryAnalytics.totalCooperatives"),
              value: ministryStats.total_cooperatives?.toLocaleString() ?? "—",
              tooltip: t("ministryAnalytics.totalCooperativesTooltip"),
            },
            {
              label: t("ministryAnalytics.totalSubmissions"),
              value: ministryStats.total_submissions?.toLocaleString() ?? "—",
              tooltip: t("ministryAnalytics.totalSubmissionsTooltip"),
            },
            {
              label: t("ministryAnalytics.pendingReview"),
              value: ministryStats.pending_review_count?.toLocaleString() ?? "—",
              tooltip: t("ministryAnalytics.pendingReviewTooltip"),
            },
            {
              label: t("ministryAnalytics.approved"),
              value: ministryStats.approved_count?.toLocaleString() ?? "—",
              tooltip: t("ministryAnalytics.approvedTooltip"),
            },
          ]}
        />
      )}

      <NetworkConsolidatedMetrics
        nfStats={nfStats}
        networkTrend={networkTrend}
        totalCooperatives={overview?.total_cooperatives ?? 0}
        cooperativesWithData={overview?.cooperatives_with_data ?? 0}
        seriesQuery={params}
      />

      <CollapsibleSection id="analytics-regional-0" title={t("analytics.section.regional")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Macro distribution */}
          <Card
            title={t("ministryAnalytics.nationalPortfolio")}
            subtitle={t("ministryAnalytics.nationalPortfolioSub")}
            info={t("ministryAnalytics.nationalPortfolioInfo")}
          >
            <RegionalGroupedBar cooperatives={coops} />
          </Card>

          {/* National loan gap */}
          {coops.length > 0 && (
            <Card
              title={t("ministryAnalytics.loanProvisioningGap")}
              subtitle={t("ministryAnalytics.loanProvisioningGapSub")}
              info={t("ministryAnalytics.loanProvisioningGapInfo")}
            >
              <LoanProvisioningWaterfall
                glp={aggMetrics.totalGLP}
                par30_pct={aggMetrics.par30Pct}
                provisions_pct={aggMetrics.provisionsPct}
              />
            </Card>
          )}
        </div>
      </CollapsibleSection>

      {/* Top & bottom performers */}
      <CollapsibleSection id="analytics-leaderboards-1" title={t("analytics.section.leaderboards")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title={t("ministryAnalytics.roaLeaderboard")}
            subtitle={t("ministryAnalytics.roaLeaderboardSub")}
            info={t("ministryAnalytics.roaLeaderboardInfo")}
          >
            <TopBottomLeaderboard cooperatives={coops} sortByKpi="roa" />
          </Card>
          <Card
            title={t("ministryAnalytics.carLeaderboard")}
            subtitle={t("ministryAnalytics.carLeaderboardSub")}
            info={t("ministryAnalytics.carLeaderboardInfo")}
          >
            <TopBottomLeaderboard cooperatives={coops} sortByKpi="capital_adequacy_ratio" />
          </Card>
        </div>
      </CollapsibleSection>

      {/* Traffic-light compliance distribution */}
      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <CollapsibleSection id="analytics-compliance" title={t("analytics.section.compliance")}>
          <Card
            title={t("ministryAnalytics.kpiTrafficLight")}
            subtitle={t("ministryAnalytics.kpiTrafficLightSub")}
            info={t("ministryAnalytics.kpiTrafficLightInfo")}
          >
            <ComplianceDoughnutCharts distributions={overview.distributions} />
          </Card>
        </CollapsibleSection>
      )}

      {coops.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {t("ministryAnalytics.noData")}
        </div>
      )}
    </div>
  );
}
