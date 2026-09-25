import type { TFunction } from "i18next";

import type { MetricCard, Trend } from "@/components/analytics/national/metrics";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";
import { compactNumber } from "@/lib/basic-dashboard";

export const usd = (value: number): string => `$${compactNumber(value)}`;
export const pct = (value: number): string => `${value.toFixed(1)}%`;

export const buildMembershipMetrics = (
  m: NfStatisticsResponse["membership"],
  t: TFunction,
): MetricCard[] => [
  {
    key: "members",
    label: t("analytics.netTotalMembers"),
    value: m.total.toLocaleString(),
    tooltip: t("analytics.netTotalMembersTooltip2"),
    trend: "up",
    trendValue: t("analytics.netNetworkScale"),
  },
  {
    key: "activeMembers",
    label: t("analytics.netActiveMembers"),
    value: m.active.toLocaleString(),
    tooltip: t("analytics.netActiveMembersTooltip"),
    trend: "up",
    trendValue: t("analytics.netOfTotalPct", { pct: m.active_pct.toFixed(1) }),
  },
  {
    key: "dormantMembers",
    label: t("analytics.netDormantMembers"),
    value: m.dormant.toLocaleString(),
    tooltip: t("analytics.netDormantMembersTooltip"),
    trend: m.dormancy_pct > 20 ? "down" : "neutral",
    trendValue: t("analytics.netDormancyRatePct", { pct: m.dormancy_pct.toFixed(1) }),
  },
  {
    key: "youthMembers",
    label: t("analytics.netYouthMembers"),
    value: m.age_18_35.toLocaleString(),
    tooltip: t("analytics.netYouthMembersTooltip"),
    trend: "neutral",
    trendValue: t("analytics.netOfTotalPct", { pct: m.youth_pct.toFixed(1) }),
  },
];

const ledgerCard = (t: TFunction, key: string, value: string, trend?: Trend): MetricCard => ({
  key,
  label: t(`analytics.ledger.${key}`),
  value,
  tooltip: t(`analytics.ledger.${key}Tip`),
  trend,
});

export const buildSavingsMetrics = (
  s: NfStatisticsResponse["savings"],
  t: TFunction,
): MetricCard[] => [
  {
    key: "savingsAccounts",
    label: t("analytics.netSavingsAccounts"),
    value: s.total_accounts.toLocaleString(),
    tooltip: t("analytics.netSavingsAccountsTooltip"),
    trend: "up",
    trendValue: t("analytics.netXActive", { count: s.active_accounts }),
  },
  {
    key: "memberLedgerSavings",
    label: t("analytics.netTotalSavings"),
    value: usd(s.total_balance),
    tooltip: t("analytics.netTotalSavingsTooltip2"),
    trend: "up",
    trendValue: t("analytics.netAvg", { amount: s.average_balance.toFixed(0) }),
  },
  {
    key: "activeSavers",
    label: t("analytics.netActiveSavers"),
    value: s.active_accounts.toLocaleString(),
    tooltip: t("analytics.netActiveSaversTooltip"),
    trend: "up",
    trendValue: t("analytics.netPenetrationPct", { pct: s.active_savers_pct.toFixed(1) }),
  },
  {
    key: "regularSavers",
    label: t("analytics.netRegularSavers"),
    value: pct(s.regular_savers_pct),
    tooltip: t("analytics.netRegularSaversTooltip"),
    trend: s.regular_savers_pct > 50 ? "up" : "neutral",
    trendValue: t("analytics.netConsistentDeposits"),
  },
  ledgerCard(t, "averageSavings", usd(s.average_balance)),
  ledgerCard(
    t,
    "dormantSavings",
    pct(s.dormant_savings_pct),
    s.dormant_savings_pct > 20 ? "down" : "neutral",
  ),
  ledgerCard(
    t,
    "zeroBalance",
    pct(s.zero_balance_pct),
    s.zero_balance_pct > 20 ? "down" : "neutral",
  ),
];

export const buildLoanMetrics = (l: NfStatisticsResponse["loans"], t: TFunction): MetricCard[] => [
  {
    key: "loanAccounts",
    label: t("analytics.netLoanAccounts"),
    value: l.total_loans.toLocaleString(),
    tooltip: t("analytics.netLoanAccountsTooltip"),
    trend: "up",
    trendValue: t("analytics.netXActive", { count: l.active_loans }),
  },
  {
    key: "memberLedgerLoans",
    label: t("analytics.netTotalLoans"),
    value: usd(l.total_balance),
    tooltip: t("analytics.netTotalLoansTooltip2"),
    trend: "up",
    trendValue: t("analytics.netAvg", { amount: l.average_loan_size.toFixed(0) }),
  },
  {
    key: "loansInArrears",
    label: t("analytics.netLoansInArrears"),
    value: l.arrears.toLocaleString(),
    tooltip: t("analytics.netLoansInArrearsTooltip"),
    trend: l.arrears_rate_pct > 5 ? "down" : "up",
    trendValue: t("analytics.netArrearsRatePct", { pct: l.arrears_rate_pct.toFixed(1) }),
  },
  {
    key: "onTimeRepayment",
    label: t("analytics.netOnTimeRepayment"),
    value: pct(l.on_time_repayment_pct),
    tooltip: t("analytics.netOnTimeRepaymentTooltip2"),
    trend: l.on_time_repayment_pct > 90 ? "up" : "neutral",
    trendValue: t("analytics.netRepaymentPerformance"),
  },
  ledgerCard(t, "womenBorrowers", pct(l.women_borrower_pct)),
  ledgerCard(t, "youthBorrowers", pct(l.youth_borrower_pct)),
  ledgerCard(t, "ruralBorrowers", pct(l.rural_borrower_pct)),
  ledgerCard(
    t,
    "restructuredLoans",
    pct(l.restructured_pct),
    l.restructured_pct > 10 ? "down" : "neutral",
  ),
  ledgerCard(
    t,
    "writtenOffLoans",
    l.written_off.toLocaleString(),
    l.written_off > 0 ? "down" : "neutral",
  ),
];

export const buildFixedDepositMetrics = (
  fd: NfStatisticsResponse["fixed_deposits"],
  t: TFunction,
): MetricCard[] => [
  {
    key: "fdAccounts",
    label: t("analytics.netFdAccounts"),
    value: fd.total_fds.toLocaleString(),
    tooltip: t("analytics.netFdAccountsTooltip"),
    trend: "up",
    trendValue: t("analytics.netXActive", { count: fd.active_fds }),
  },
  {
    key: "fdBalance",
    label: t("analytics.netTotalFdBalance"),
    value: usd(fd.total_balance),
    tooltip: t("analytics.netTotalFdBalanceTooltip"),
    trend: "up",
    trendValue: t("analytics.netAvg", { amount: fd.average_balance.toFixed(0) }),
  },
  {
    key: "fdPenetration",
    label: t("analytics.netFdPenetration"),
    value: pct(fd.fd_penetration_pct),
    tooltip: t("analytics.netFdPenetrationTooltip"),
    trend: fd.fd_penetration_pct > 20 ? "up" : "neutral",
    trendValue: t("analytics.netMemberParticipation"),
  },
  {
    key: "fdRollover",
    label: t("analytics.netRolloverRate"),
    value: pct(fd.rollover_rate_pct),
    tooltip: t("analytics.netRolloverRateTooltip"),
    trend: fd.rollover_rate_pct > 70 ? "up" : "neutral",
    trendValue: t("analytics.netRetentionRate"),
  },
  ledgerCard(
    t,
    "earlyFdWithdrawal",
    pct(fd.early_withdrawal_pct),
    fd.early_withdrawal_pct > 10 ? "down" : "neutral",
  ),
];
