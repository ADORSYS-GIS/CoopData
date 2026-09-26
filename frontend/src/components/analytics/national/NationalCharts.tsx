import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AgeDemographicsChart } from "@/components/analytics/AgeDemographicsChart";
import { FinancialInclusionBar } from "@/components/analytics/FinancialInclusionBar";
import { GenderParticipationChart } from "@/components/analytics/GenderParticipationChart";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { LoanDualBar } from "@/components/analytics/LoanDualBar";
import { FlatCard } from "@/components/analytics/national/FlatCard";
import { PortfolioOverviewChart } from "@/components/analytics/PortfolioOverviewChart";
import { SavingsLoansDepositsChart } from "@/components/analytics/SavingsLoansDepositsChart";
import { SavingsRadialGauges } from "@/components/analytics/SavingsRadialGauges";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { PeriodSeriesCharts } from "@/components/analytics/national/PeriodSeriesCharts";
import type { PeriodSeriesQuery } from "@/hooks/analytics/usePeriodSeries";
import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";

interface NationalChartsProps {
  nfStats?: NfStatisticsResponse;
  networkTrend?: Pick<MonthlyTrendResponse, "months">;
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

export function NationalCharts({ nfStats, networkTrend, seriesQuery }: NationalChartsProps) {
  const { t } = useTranslation();

  // `liquidity` is liquid assets (COA 1100), never total assets (COA 1999):
  // total assets already contains loans and liquid assets, so the two must not
  // be treated as separately summable series.
  const trend = useMemo(
    () =>
      (networkTrend?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.liquid_assets,
        savings: m.savings,
        loans: m.loans,
        totalAssets: m.assets,
      })),
    [networkTrend],
  );

  return (
    <div className="space-y-6">
      <CollapsibleSection id="charts-portfolio" title={t("analytics.section.portfolio")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PortfolioOverviewChart data={trend} />
            </div>
            <div className="lg:col-span-2">
              <GenderParticipationChart data={nfStats?.membership ?? EMPTY_GENDER} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SavingsLoansDepositsChart data={trend} />
            {nfStats && (
              <FlatCard
                title={t("analytics.netSavingsPortfolioHealth")}
                subtitle={t("analytics.netSavingsPortfolioHealthSub")}
                info={t("analytics.netSavingsPortfolioHealthInfo")}
              >
                <SavingsRadialGauges data={nfStats.savings} />
              </FlatCard>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="charts-trends" title={t("analytics.section.trends")}>
        <PeriodSeriesCharts query={seriesQuery} />
      </CollapsibleSection>

      {nfStats && (
        <>
          <CollapsibleSection id="charts-loans" title={t("analytics.section.loans")}>
            <div className="space-y-6">
              <FlatCard
                title={t("analytics.netLoanPortfolioBreakdown")}
                subtitle={t("analytics.netLoanPortfolioBreakdownSub")}
                info={t("analytics.netLoanPortfolioBreakdownInfo")}
              >
                <LoanDualBar data={nfStats.loans} />
              </FlatCard>
              <FlatCard
                title={t("analytics.deepDiveFinancialInclusion")}
                subtitle={t("analytics.netInclusionSub")}
                info={t("analytics.netInclusionInfo")}
              >
                <FinancialInclusionBar stats={nfStats.loans} />
              </FlatCard>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="charts-members" title={t("analytics.section.members")}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FlatCard
                title={t("analytics.netDemographics")}
                subtitle={t("analytics.netDemographicsSub")}
                info={t("analytics.netDemographicsInfo")}
              >
                <GenderStatusDoughnuts data={nfStats.membership} />
              </FlatCard>
              <FlatCard
                title={t("analytics.netAgeGeography")}
                subtitle={t("analytics.netAgeGeographySub")}
                info={t("analytics.netAgeGeographyInfo")}
              >
                <AgeDemographicsChart data={nfStats.membership} />
              </FlatCard>
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
