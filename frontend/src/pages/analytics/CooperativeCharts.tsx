import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { AgriResilienceRadar } from "@/components/analytics/AgriResilienceRadar";
import { ComplianceRadialGauges } from "@/components/analytics/ComplianceRadialGauges";
import { DormancyLeaderboard } from "@/components/analytics/DormancyLeaderboard";
import { FinancialInclusionBar } from "@/components/analytics/FinancialInclusionBar";
import { GenderParticipationChart } from "@/components/analytics/GenderParticipationChart";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { LoanDualBar } from "@/components/analytics/LoanDualBar";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
import { PortfolioOverviewChart } from "@/components/analytics/PortfolioOverviewChart";
import { SavingsLoansDepositsChart } from "@/components/analytics/SavingsLoansDepositsChart";
import { SavingsRadialGauges } from "@/components/analytics/SavingsRadialGauges";
import { PeriodSeriesCharts } from "@/components/analytics/national/PeriodSeriesCharts";
import type { PeriodSeriesQuery } from "@/hooks/analytics/usePeriodSeries";
import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";

interface CooperativeChartsProps {
  kpiMap: Record<string, number>;
  hasKpis: boolean;
  nfStats?: NfStatisticsResponse;
  trend?: Pick<MonthlyTrendResponse, "months">;
  seriesQuery: PeriodSeriesQuery;
}

const EMPTY_GENDER = {
  total: 0,
  male: 0,
  female: 0,
  other: 0,
  male_pct: 0,
  female_pct: 0,
  other_pct: 0,
};

export function CooperativeCharts({
  kpiMap,
  hasKpis,
  nfStats,
  trend,
  seriesQuery,
}: CooperativeChartsProps) {
  const { t } = useTranslation();
  const membership = nfStats?.membership;
  const points = useMemo(
    () =>
      (trend?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.liquid_assets,
        savings: m.savings,
        loans: m.loans,
        totalAssets: m.assets,
      })),
    [trend],
  );

  return (
    <div className="space-y-6">
      <CollapsibleSection id="coop-charts-portfolio" title={t("analytics.section.portfolio")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PortfolioOverviewChart data={points} />
            </div>
            <div className="lg:col-span-2">
              <GenderParticipationChart data={membership ?? EMPTY_GENDER} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SavingsLoansDepositsChart data={points} />
            {nfStats?.savings && (
              <Card
                title={t("cooperativeAnalytics.savingsPortfolioTitle")}
                subtitle={t("cooperativeAnalytics.savingsPortfolioSubtitle")}
                info={t("cooperativeAnalytics.savingsPortfolioInfo")}
              >
                <SavingsRadialGauges data={nfStats.savings} />
              </Card>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="coop-charts-trends" title={t("analytics.section.trends")}>
        <div className="space-y-6">
          <PeriodSeriesCharts query={seriesQuery} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="coop-charts-compliance" title={t("analytics.section.compliance")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title={t("cooperativeAnalytics.regComplianceTitle")}
              subtitle={t("cooperativeAnalytics.regComplianceSubtitle")}
              info={t("cooperativeAnalytics.regComplianceInfo")}
            >
              <ComplianceRadialGauges
                carValue={kpiMap["capital_adequacy_ratio"]}
                liquidityValue={kpiMap["liquid_funds_ratio"]}
                nplValue={kpiMap["npl_ratio"]}
              />
            </Card>
            {hasKpis && kpiMap["par30"] !== undefined && (
              <Card
                title={t("cooperativeAnalytics.loanProvTitle")}
                subtitle={t("cooperativeAnalytics.loanProvSubtitle")}
                info={t("cooperativeAnalytics.loanProvInfo")}
              >
                <LoanProvisioningWaterfall
                  glp={kpiMap["gross_loan_portfolio"] ?? 0}
                  par30_pct={kpiMap["par30"]}
                  provisions_pct={kpiMap["loan_loss_coverage"] ?? 0}
                />
              </Card>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="coop-charts-loans" title={t("analytics.section.loans")}>
        <div className="space-y-6">
          {nfStats?.loans && (
            <>
              <Card
                title={t("cooperativeAnalytics.loanPortfolioTitle")}
                subtitle={t("cooperativeAnalytics.loanPortfolioSubtitle")}
                info={t("cooperativeAnalytics.loanPortfolioInfo")}
              >
                <LoanDualBar data={nfStats.loans} />
              </Card>
              <Card
                title={t("cooperativeAnalytics.inclusionTitle")}
                subtitle={t("cooperativeAnalytics.inclusionSubtitle")}
                info={t("cooperativeAnalytics.inclusionInfo")}
              >
                <FinancialInclusionBar stats={nfStats.loans} />
              </Card>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="coop-charts-members" title={t("analytics.section.members")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {membership && (
              <Card
                title={t("cooperativeAnalytics.memberDemoTitle")}
                subtitle={t("cooperativeAnalytics.memberDemoSubtitle")}
                info={t("cooperativeAnalytics.memberDemoInfo")}
              >
                <GenderStatusDoughnuts data={membership} />
              </Card>
            )}
            {membership && (
              <Card
                title={t("cooperativeAnalytics.dormancyLeaderboardTitle")}
                info={t("cooperativeAnalytics.dormancyLeaderboardInfo")}
              >
                <DormancyLeaderboard
                  data={[
                    {
                      name: t("cooperativeAnalytics.myCooperative"),
                      dormancy_pct: membership.dormancy_pct,
                      active_members_pct: membership.active_pct,
                      total_members: membership.total,
                    },
                  ]}
                />
              </Card>
            )}
          </div>

          {nfStats?.farm_coop && nfStats.farm_coop.total_coops > 0 && (
            <Card
              title={t("cooperativeAnalytics.agriResilienceTitle")}
              subtitle={t("cooperativeAnalytics.agriResilienceSubtitle")}
              info={t("cooperativeAnalytics.agriResilienceInfo")}
            >
              <AgriResilienceRadar stats={nfStats.farm_coop} />
            </Card>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
