import type { TFunction } from "i18next";

import {
  buildFixedDepositMetrics,
  buildLoanMetrics,
  buildMembershipMetrics,
  buildSavingsMetrics,
  pct,
  usd,
} from "@/components/analytics/national/ledgerMetrics";

import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";

export type Trend = "up" | "down" | "neutral";

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  tooltip: string;
  trend?: Trend;
  trendValue?: string;
}

export interface MetricGroup {
  id: string;
  title: string;
  metrics: MetricCard[];
}

export const buildMetricGroups = (nfStats: NfStatisticsResponse, t: TFunction): MetricGroup[] => [
  {
    id: "membership",
    title: t("analytics.netMembershipOverview"),
    metrics: buildMembershipMetrics(nfStats.membership, t),
  },
  {
    id: "savings",
    title: t("analytics.netSavingsPortfolioMetrics"),
    metrics: buildSavingsMetrics(nfStats.savings, t),
  },
  {
    id: "loans",
    title: t("analytics.netLoanPortfolioMetrics"),
    metrics: buildLoanMetrics(nfStats.loans, t),
  },
  {
    id: "fixedDeposits",
    title: t("analytics.netFdMetrics"),
    metrics: buildFixedDepositMetrics(nfStats.fixed_deposits, t),
  },
];

interface HeadlineInput {
  nfStats: NfStatisticsResponse;
  networkTrend?: Pick<MonthlyTrendResponse, "months">;
  cooperativesWithData: number;
  totalCooperatives: number;
  t: TFunction;
}

/**
 * Eight headline figures. Balance-sheet totals come from the approved financial
 * statement, member-ledger figures from the uploaded sub-ledgers; the labels
 * keep that distinction so the two are never read as one number.
 */
export const buildHeadlineMetrics = ({
  nfStats,
  networkTrend,
  cooperativesWithData,
  totalCooperatives,
  t,
}: HeadlineInput): MetricCard[] => {
  const months = networkTrend?.months ?? [];
  const latest = [...months].reverse().find((m) => m.assets !== 0 || (m.liabilities ?? 0) !== 0);
  const groups = buildMetricGroups(nfStats, t);
  const pick = (groupId: MetricGroup["id"], key: string): MetricCard | undefined =>
    groups.find((g) => g.id === groupId)?.metrics.find((m) => m.key === key);

  const headline: (MetricCard | undefined)[] = [
    {
      key: "cooperatives",
      label: t("analytics.netTotalCooperatives"),
      value: String(cooperativesWithData),
      tooltip: t("analytics.netTotalCooperativesTooltip"),
      trend: "neutral",
      trendValue: t("analytics.netOfX", { total: totalCooperatives }),
    },
    pick("membership", "members"),
    latest && {
      key: "totalAssets",
      label: t("analytics.headline.totalAssets"),
      value: usd(latest.assets),
      tooltip: t("analytics.headline.totalAssetsTooltip"),
    },
    latest && latest.assets !== 0
      ? {
          key: "equityToAssets",
          label: t("analytics.headline.equityToAssets"),
          value: pct((latest.equity / latest.assets) * 100),
          tooltip: t("analytics.headline.equityToAssetsTooltip"),
        }
      : undefined,
    pick("savings", "memberLedgerSavings"),
    pick("loans", "memberLedgerLoans"),
    pick("loans", "loansInArrears"),
    pick("loans", "onTimeRepayment"),
  ];

  return headline.filter((card): card is MetricCard => card !== undefined);
};
