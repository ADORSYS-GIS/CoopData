import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { KpiScorecard } from "@/components/analytics/KpiScorecard";
import { MetricsGridCards } from "@/components/analytics/MetricsGridCards";
import { CoopTrendAreaChart } from "@/components/analytics/CoopTrendAreaChart";
import { PortfolioOverviewChart } from "@/components/analytics/PortfolioOverviewChart";
import { GenderParticipationChart } from "@/components/analytics/GenderParticipationChart";
import { SavingsLoansDepositsChart } from "@/components/analytics/SavingsLoansDepositsChart";
import { SavingsRadialGauges } from "@/components/analytics/SavingsRadialGauges";
import { LoanDualBar } from "@/components/analytics/LoanDualBar";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { AgeDemographicsChart } from "@/components/analytics/AgeDemographicsChart";
import { DepositConcentrationGauge } from "@/components/analytics/DepositConcentrationGauge";
import { GovernanceFunnel } from "@/components/analytics/GovernanceFunnel";
import { FinancialInclusionBar } from "@/components/analytics/FinancialInclusionBar";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";

export interface NetworkConsolidatedMetricsProps {
  nfStats?: NfStatisticsResponse;
  networkTrend?: {
    months: {
      month_label: string;
      savings: number;
      loans: number;
      assets: number;
    }[];
  };
  totalCooperatives: number;
  cooperativesWithData: number;
  totalApexes?: number;
}

export const NetworkConsolidatedMetrics: React.FC<NetworkConsolidatedMetricsProps> = ({
  nfStats,
  networkTrend,
  totalCooperatives,
  cooperativesWithData,
  totalApexes,
}) => {
  const { t } = useTranslation();
  const networkTrendPoints = useMemo(
    () =>
      (networkTrend?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.assets,
        savings: m.savings,
        loans: m.loans,
      })),
    [networkTrend],
  );

  const fallbackTrendPoints = useMemo(
    () =>
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
        (m) => ({ month: m, liquidity: 0, savings: 0, loans: 0 }),
      ),
    [],
  );

  const networkKpiGridMetrics = useMemo(() => {
    if (!nfStats) return [];

    const baseMetrics = [
      {
        label: t("analytics.netTotalCooperatives"),
        value: cooperativesWithData,
        tooltip: t("analytics.netTotalCooperativesTooltip"),
        trend: "neutral" as const,
        trendValue: t("analytics.netOfX", { total: totalCooperatives }),
      },
      {
        label: t("analytics.netTotalMembers"),
        value: nfStats.membership.total.toLocaleString(),
        tooltip: t("analytics.netTotalMembersTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netActivePct", {
          pct: nfStats.membership.active_pct.toFixed(1),
        }),
      },
      {
        label: t("analytics.netTotalSavings"),
        value: `$${(nfStats.savings.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netTotalSavingsTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netAvg", {
          amount: nfStats.savings.average_balance.toFixed(0),
        }),
      },
      {
        label: t("analytics.netTotalLoans"),
        value: `$${(nfStats.loans.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netTotalLoansTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netArrearsPct", {
          pct: nfStats.loans.arrears_rate_pct.toFixed(1),
        }),
      },
      {
        label: t("analytics.netFixedDeposits"),
        value: `$${(nfStats.fixed_deposits.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netFixedDepositsTooltip"),
        trend: "neutral" as const,
        trendValue: t("analytics.netPenPct", {
          pct: nfStats.fixed_deposits.fd_penetration_pct.toFixed(1),
        }),
      },
      {
        label: t("analytics.netOnTimeRepayment"),
        value: `${nfStats.loans.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: t("analytics.netOnTimeRepaymentTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.legendHealthy"),
      },
    ];

    if (totalApexes !== undefined) {
      baseMetrics.unshift({
        label: t("analytics.netTotalApexes"),
        value: totalApexes.toLocaleString(),
        tooltip: t("analytics.netTotalApexesTooltip"),
        trend: "neutral" as const,
        trendValue: t("analytics.netNetworkScale"),
      });
    }

    return baseMetrics;
  }, [nfStats, totalCooperatives, cooperativesWithData, totalApexes, t]);

  const membershipMetrics = useMemo(() => {
    if (!nfStats?.membership) return [];
    const m = nfStats.membership;
    return [
      {
        label: t("analytics.netTotalMembers"),
        value: m.total.toLocaleString(),
        tooltip: t("analytics.netTotalMembersTooltip2"),
        trend: "up" as const,
        trendValue: t("analytics.netNetworkScale"),
      },
      {
        label: t("analytics.netActiveMembers"),
        value: m.active.toLocaleString(),
        tooltip: t("analytics.netActiveMembersTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netOfTotalPct", { pct: m.active_pct.toFixed(1) }),
      },
      {
        label: t("analytics.netDormantMembers"),
        value: m.dormant.toLocaleString(),
        tooltip: t("analytics.netDormantMembersTooltip"),
        trend: m.dormancy_pct > 20 ? ("down" as const) : ("neutral" as const),
        trendValue: t("analytics.netDormancyRatePct", { pct: m.dormancy_pct.toFixed(1) }),
      },
      {
        label: t("analytics.netYouthMembers"),
        value: m.age_18_35.toLocaleString(),
        tooltip: t("analytics.netYouthMembersTooltip"),
        trend: "neutral" as const,
        trendValue: t("analytics.netOfTotalPct", { pct: m.youth_pct.toFixed(1) }),
      },
    ];
  }, [nfStats, t]);

  const savingsMetrics = useMemo(() => {
    if (!nfStats?.savings) return [];
    const s = nfStats.savings;
    return [
      {
        label: t("analytics.netSavingsAccounts"),
        value: s.total_accounts.toLocaleString(),
        tooltip: t("analytics.netSavingsAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netXActive", { count: s.active_accounts }),
      },
      {
        label: t("analytics.netTotalSavings"),
        value: `$${(s.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netTotalSavingsTooltip2"),
        trend: "up" as const,
        trendValue: t("analytics.netAvg", { amount: s.average_balance.toFixed(0) }),
      },
      {
        label: t("analytics.netActiveSavers"),
        value: s.active_accounts.toLocaleString(),
        tooltip: t("analytics.netActiveSaversTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netPenetrationPct", {
          pct: s.active_savers_pct.toFixed(1),
        }),
      },
      {
        label: t("analytics.netRegularSavers"),
        value: `${s.regular_savers_pct.toFixed(1)}%`,
        tooltip: t("analytics.netRegularSaversTooltip"),
        trend: s.regular_savers_pct > 50 ? ("up" as const) : ("neutral" as const),
        trendValue: t("analytics.netConsistentDeposits"),
      },
    ];
  }, [nfStats, t]);

  const loanMetrics = useMemo(() => {
    if (!nfStats?.loans) return [];
    const l = nfStats.loans;
    return [
      {
        label: t("analytics.netLoanAccounts"),
        value: l.total_loans.toLocaleString(),
        tooltip: t("analytics.netLoanAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netXActive", { count: l.active_loans }),
      },
      {
        label: t("analytics.netTotalLoans"),
        value: `$${(l.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netTotalLoansTooltip2"),
        trend: "up" as const,
        trendValue: t("analytics.netAvg", { amount: l.average_loan_size.toFixed(0) }),
      },
      {
        label: t("analytics.netLoansInArrears"),
        value: l.arrears.toLocaleString(),
        tooltip: t("analytics.netLoansInArrearsTooltip"),
        trend: l.arrears_rate_pct > 5 ? ("down" as const) : ("up" as const),
        trendValue: t("analytics.netArrearsRatePct", { pct: l.arrears_rate_pct.toFixed(1) }),
      },
      {
        label: t("analytics.netOnTimeRepayment"),
        value: `${l.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: t("analytics.netOnTimeRepaymentTooltip2"),
        trend: l.on_time_repayment_pct > 90 ? ("up" as const) : ("neutral" as const),
        trendValue: t("analytics.netRepaymentPerformance"),
      },
    ];
  }, [nfStats, t]);

  const fdMetrics = useMemo(() => {
    if (!nfStats?.fixed_deposits) return [];
    const fd = nfStats.fixed_deposits;
    return [
      {
        label: t("analytics.netFdAccounts"),
        value: fd.total_fds.toLocaleString(),
        tooltip: t("analytics.netFdAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netXActive", { count: fd.active_fds }),
      },
      {
        label: t("analytics.netTotalFdBalance"),
        value: `$${(fd.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("analytics.netTotalFdBalanceTooltip"),
        trend: "up" as const,
        trendValue: t("analytics.netAvg", { amount: fd.average_balance.toFixed(0) }),
      },
      {
        label: t("analytics.netFdPenetration"),
        value: `${fd.fd_penetration_pct.toFixed(1)}%`,
        tooltip: t("analytics.netFdPenetrationTooltip"),
        trend: fd.fd_penetration_pct > 20 ? ("up" as const) : ("neutral" as const),
        trendValue: t("analytics.netMemberParticipation"),
      },
      {
        label: t("analytics.netRolloverRate"),
        value: `${fd.rollover_rate_pct.toFixed(1)}%`,
        tooltip: t("analytics.netRolloverRateTooltip"),
        trend: fd.rollover_rate_pct > 70 ? ("up" as const) : ("neutral" as const),
        trendValue: t("analytics.netRetentionRate"),
      },
    ];
  }, [nfStats, t]);

  return (
    <>
      {networkKpiGridMetrics.length > 0 && (
        <div className="mb-6">
          <KpiScorecard metrics={networkKpiGridMetrics} />
        </div>
      )}

      {/* Row 1: Portfolio Overview & Gender Participation */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <PortfolioOverviewChart
            data={networkTrendPoints.length > 0 ? networkTrendPoints : fallbackTrendPoints}
          />
        </div>
        <div className="lg:col-span-2">
          <GenderParticipationChart
            data={
              nfStats?.membership ?? {
                total: 0,
                male: 0,
                female: 0,
                other: 0,
                male_pct: 0,
                female_pct: 0,
                other_pct: 0,
              }
            }
          />
        </div>
      </div>

      {/* Row 2: Monthly Breakdown & Savings Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SavingsLoansDepositsChart
          data={networkTrendPoints.length > 0 ? networkTrendPoints : fallbackTrendPoints}
        />
        {nfStats && (
          <Card
            title={t("analytics.netSavingsPortfolioHealth")}
            subtitle={t("analytics.netSavingsPortfolioHealthSub")}
            info={t("analytics.netSavingsPortfolioHealthInfo")}
          >
            <SavingsRadialGauges data={nfStats.savings} />
          </Card>
        )}
      </div>

      {nfStats?.membership && membershipMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("analytics.netMembershipOverview")}
          </h3>
          <MetricsGridCards metrics={membershipMetrics} columns={4} />
        </div>
      )}

      {nfStats?.savings && savingsMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("analytics.netSavingsPortfolioMetrics")}
          </h3>
          <MetricsGridCards metrics={savingsMetrics} columns={4} />
        </div>
      )}

      {nfStats?.loans && loanMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("analytics.netLoanPortfolioMetrics")}
          </h3>
          <MetricsGridCards metrics={loanMetrics} columns={4} />
        </div>
      )}

      {nfStats && (
        <div className="mt-6">
          <Card
            title={t("analytics.netLoanPortfolioBreakdown")}
            subtitle={t("analytics.netLoanPortfolioBreakdownSub")}
            info={t("analytics.netLoanPortfolioBreakdownInfo")}
          >
            <LoanDualBar data={nfStats.loans} />
          </Card>
        </div>
      )}

      {nfStats?.fixed_deposits && fdMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("analytics.netFdMetrics")}</h3>
          <MetricsGridCards metrics={fdMetrics} columns={4} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {nfStats && (
          <Card
            title={t("analytics.netLiquidityRisk")}
            subtitle={t("analytics.netLiquidityRiskSub")}
            info={t("analytics.netLiquidityRiskInfo")}
          >
            <DepositConcentrationGauge stats={nfStats.fixed_deposits} />
          </Card>
        )}
        {nfStats && (
          <Card
            title={t("analytics.netGovernance")}
            subtitle={t("analytics.netGovernanceSub")}
            info={t("analytics.netGovernanceInfo")}
          >
            <GovernanceFunnel stats={nfStats.membership} />
          </Card>
        )}
        {nfStats && (
          <Card
            title={t("analytics.deepDiveFinancialInclusion")}
            subtitle={t("analytics.netInclusionSub")}
            info={t("analytics.netInclusionInfo")}
          >
            <FinancialInclusionBar stats={nfStats.loans} />
          </Card>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nfStats && (
          <Card
            title={t("analytics.netDemographics")}
            subtitle={t("analytics.netDemographicsSub")}
            info={t("analytics.netDemographicsInfo")}
          >
            <GenderStatusDoughnuts data={nfStats.membership} />
          </Card>
        )}
        {nfStats && (
          <Card
            title={t("analytics.netAgeGeography")}
            subtitle={t("analytics.netAgeGeographySub")}
            info={t("analytics.netAgeGeographyInfo")}
          >
            <AgeDemographicsChart data={nfStats.membership} />
          </Card>
        )}
      </div>
    </>
  );
};
