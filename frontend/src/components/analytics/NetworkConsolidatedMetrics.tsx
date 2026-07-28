import React, { useMemo } from "react";
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

  const networkKpiGridMetrics = useMemo(() => {
    if (!nfStats) return [];

    const baseMetrics = [
      {
        label: "Total Cooperatives",
        value: cooperativesWithData,
        tooltip:
          "Cooperatives that have successfully submitted and had their data approved for this reporting year.",
        trend: "neutral" as const,
        trendValue: `of ${totalCooperatives}`,
      },
      {
        label: "Total Members",
        value: nfStats.membership.total.toLocaleString(),
        tooltip: "Total registered members across the network.",
        trend: "up" as const,
        trendValue: `${nfStats.membership.active_pct.toFixed(1)}% Active`,
      },
      {
        label: "Total Savings",
        value: `$${(nfStats.savings.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Aggregate savings deposits held by all cooperatives.",
        trend: "up" as const,
        trendValue: `Avg: $${nfStats.savings.average_balance.toFixed(0)}`,
      },
      {
        label: "Total Loans",
        value: `$${(nfStats.loans.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: "Aggregate outstanding loan portfolio across all cooperatives.",
        trend: "up" as const,
        trendValue: `${nfStats.loans.arrears_rate_pct.toFixed(1)}% Arrears`,
      },
      {
        label: "Fixed Deposits",
        value: `$${(nfStats.fixed_deposits.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Aggregate fixed term deposits held by all cooperatives.",
        trend: "neutral" as const,
        trendValue: `${nfStats.fixed_deposits.fd_penetration_pct.toFixed(1)}% Pen`,
      },
      {
        label: "On-time Repayment",
        value: `${nfStats.loans.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: "Aggregate percentage of loans repaid on schedule across the network.",
        trend: "up" as const,
        trendValue: "Healthy",
      },
    ];

    if (totalApexes !== undefined) {
      baseMetrics.unshift({
        label: "Total Apexes",
        value: totalApexes.toLocaleString(),
        tooltip: "Total number of active apex organizations within the federation.",
        trend: "neutral" as const,
        trendValue: "Network scale",
      });
    }

    return baseMetrics;
  }, [nfStats, totalCooperatives, cooperativesWithData, totalApexes]);

  const membershipMetrics = useMemo(() => {
    if (!nfStats?.membership) return [];
    const m = nfStats.membership;
    return [
      {
        label: "Total Members",
        value: m.total.toLocaleString(),
        tooltip: "Total number of registered cooperative members across the network",
        trend: "up" as const,
        trendValue: "Network scale",
      },
      {
        label: "Active Members",
        value: m.active.toLocaleString(),
        tooltip: "Members with transactions in the last 90 days",
        trend: "up" as const,
        trendValue: `${m.active_pct.toFixed(1)}% of total`,
      },
      {
        label: "Dormant Members",
        value: m.dormant.toLocaleString(),
        tooltip: "Members with no transactions in the last 90 days",
        trend: m.dormancy_pct > 20 ? ("down" as const) : ("neutral" as const),
        trendValue: `${m.dormancy_pct.toFixed(1)}% dormancy rate`,
      },
      {
        label: "Youth Members",
        value: m.age_18_35.toLocaleString(),
        tooltip: "Members under 35 years old",
        trend: "neutral" as const,
        trendValue: `${m.youth_pct.toFixed(1)}% of total`,
      },
    ];
  }, [nfStats]);

  const savingsMetrics = useMemo(() => {
    if (!nfStats?.savings) return [];
    const s = nfStats.savings;
    return [
      {
        label: "Savings Accounts",
        value: s.total_accounts.toLocaleString(),
        tooltip: "Total number of active savings accounts across the network",
        trend: "up" as const,
        trendValue: `${s.active_accounts} active`,
      },
      {
        label: "Total Savings",
        value: `$${(s.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Total balance across all savings accounts",
        trend: "up" as const,
        trendValue: `Avg: $${s.average_balance.toFixed(0)}`,
      },
      {
        label: "Active Savers",
        value: s.active_accounts.toLocaleString(),
        tooltip: "Members with deposits in the last 30 days",
        trend: "up" as const,
        trendValue: `${s.active_savers_pct.toFixed(1)}% penetration`,
      },
      {
        label: "Regular Savers",
        value: `${s.regular_savers_pct.toFixed(1)}%`,
        tooltip: "Percentage of members with consistent monthly deposits",
        trend: s.regular_savers_pct > 50 ? ("up" as const) : ("neutral" as const),
        trendValue: "Consistent deposits",
      },
    ];
  }, [nfStats]);

  const loanMetrics = useMemo(() => {
    if (!nfStats?.loans) return [];
    const l = nfStats.loans;
    return [
      {
        label: "Loan Accounts",
        value: l.total_loans.toLocaleString(),
        tooltip: "Total number of active loan accounts",
        trend: "up" as const,
        trendValue: `${l.active_loans} active`,
      },
      {
        label: "Total Loans",
        value: `$${(l.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: "Total outstanding loan balance across the network",
        trend: "up" as const,
        trendValue: `Avg: $${l.average_loan_size.toFixed(0)}`,
      },
      {
        label: "Loans in Arrears",
        value: l.arrears.toLocaleString(),
        tooltip: "Number of loans with payments overdue by 30+ days",
        trend: l.arrears_rate_pct > 5 ? ("down" as const) : ("up" as const),
        trendValue: `${l.arrears_rate_pct.toFixed(1)}% arrears rate`,
      },
      {
        label: "On-time Repayment",
        value: `${l.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: "Percentage of loans repaid on schedule",
        trend: l.on_time_repayment_pct > 90 ? ("up" as const) : ("neutral" as const),
        trendValue: "Repayment performance",
      },
    ];
  }, [nfStats]);

  const fdMetrics = useMemo(() => {
    if (!nfStats?.fixed_deposits) return [];
    const fd = nfStats.fixed_deposits;
    return [
      {
        label: "FD Accounts",
        value: fd.total_fds.toLocaleString(),
        tooltip: "Total number of active fixed deposit accounts",
        trend: "up" as const,
        trendValue: `${fd.active_fds} active`,
      },
      {
        label: "Total FD Balance",
        value: `$${(fd.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Total balance across all fixed deposits",
        trend: "up" as const,
        trendValue: `Avg: $${fd.average_balance.toFixed(0)}`,
      },
      {
        label: "FD Penetration",
        value: `${fd.fd_penetration_pct.toFixed(1)}%`,
        tooltip: "Percentage of members with fixed deposits",
        trend: fd.fd_penetration_pct > 20 ? ("up" as const) : ("neutral" as const),
        trendValue: "Member participation",
      },
      {
        label: "Rollover Rate",
        value: `${fd.rollover_rate_pct.toFixed(1)}%`,
        tooltip: "Percentage of matured FDs rolled over",
        trend: fd.rollover_rate_pct > 70 ? ("up" as const) : ("neutral" as const),
        trendValue: "Retention rate",
      },
    ];
  }, [nfStats]);

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
            data={
              networkTrendPoints.length > 0
                ? networkTrendPoints
                : [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ].map((m) => ({ month: m, liquidity: 0, savings: 0, loans: 0 }))
            }
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
          data={
            networkTrendPoints.length > 0
              ? networkTrendPoints
              : [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((m) => ({ month: m, liquidity: 0, savings: 0, loans: 0 }))
          }
        />
        {nfStats && (
          <Card
            title="Network Savings Portfolio Health"
            subtitle="Account activity and penetration"
            info="Analyzes the vitality of the aggregated savings base. Savings Penetration shows the percentage of members holding savings, Regular Savers tracks consistent monthly deposits, and Active Savers indicates recent deposit activity."
          >
            <SavingsRadialGauges data={nfStats.savings} />
          </Card>
        )}
      </div>

      {nfStats?.membership && membershipMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Membership Overview</h3>
          <MetricsGridCards metrics={membershipMetrics} columns={4} />
        </div>
      )}

      {nfStats?.savings && savingsMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Savings Portfolio Metrics</h3>
          <MetricsGridCards metrics={savingsMetrics} columns={4} />
        </div>
      )}

      {nfStats?.loans && loanMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Loan Portfolio Metrics</h3>
          <MetricsGridCards metrics={loanMetrics} columns={4} />
        </div>
      )}

      {nfStats && (
        <div className="mt-6">
          <Card
            title="Loan Portfolio Breakdown"
            subtitle="Performing vs. arrears across the network"
            info="A detailed breakdown of active loans across the network, comparing performing loans against loans in arrears, categorized by demographics."
          >
            <LoanDualBar data={nfStats.loans} />
          </Card>
        </div>
      )}

      {nfStats?.fixed_deposits && fdMetrics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Fixed Deposit Metrics</h3>
          <MetricsGridCards metrics={fdMetrics} columns={4} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {nfStats && (
          <Card
            title="Network Liquidity Risk"
            subtitle="Term deposit concentration"
            info="Assesses aggregate liquidity risk by examining the concentration of fixed (term) deposits across the network."
          >
            <DepositConcentrationGauge stats={nfStats.fixed_deposits} />
          </Card>
        )}
        {nfStats && (
          <Card
            title="Network Governance"
            subtitle="Aggregate democratic participation"
            info="Measures the democratic health of the network by tracking aggregate member participation in governance activities."
          >
            <GovernanceFunnel stats={nfStats.membership} />
          </Card>
        )}
        {nfStats && (
          <Card
            title="Financial Inclusion"
            subtitle="Aggregate credit access"
            info="Tracks the distribution of credit access across key demographics to ensure the network is fulfilling its inclusive mandate."
          >
            <FinancialInclusionBar stats={nfStats.loans} />
          </Card>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nfStats && (
          <Card
            title="Network Demographics"
            subtitle="Aggregate membership profile"
            info="Visualizes the demographic makeup of the entire member base, including gender ratios and the proportion of active versus dormant accounts."
          >
            <GenderStatusDoughnuts data={nfStats.membership} />
          </Card>
        )}
        {nfStats && (
          <Card
            title="Age & Geography Breakdown"
            subtitle="Member age distribution and geographic spread"
            info="Visualizes the distribution of members across various age groups and their geographic dispersion (Urban vs. Rural)."
          >
            <AgeDemographicsChart data={nfStats.membership} />
          </Card>
        )}
      </div>
    </>
  );
};
