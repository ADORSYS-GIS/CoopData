import type { TFunction } from "i18next";
import type { BenchmarkMetric } from "@/components/analytics/benchmark-types";

// Questionnaire-derived metrics — membership, financial balances, income.
export function buildBasicMetrics(t: TFunction): BenchmarkMetric[] {
  const keys = {
    registeredMembers: "total_registered_members",
    activeMembers: "total_active_members",
    maleMembers: "total_members_male",
    femaleMembers: "total_members_female",
    age18_25: "members_age_18_25",
    age26_35: "members_age_26_35",
    age36_60: "members_age_36_60",
    age61Plus: "members_age_61plus",
    shareCapital: "total_share_capital",
    borrowedFunds: "total_borrowed_funds",
    savingsValue: "total_savings_value",
    loansOutstanding: "total_loans_outstanding",
    income: "total_income",
    expenditure: "total_expenditure",
    netIncome: "total_net_income",
  } as const;

  const metric = (
    k: string,
    label: string,
    unit: string,
    group: BenchmarkMetric["group"],
    description: string,
    isLowerBetter = false,
  ): BenchmarkMetric => ({
    key: k,
    label,
    unit,
    group,
    description,
    ...(isLowerBetter ? { isLowerBetter: true } : {}),
  });

  return [
    // --- Membership & Demographics ---
    metric(
      keys.registeredMembers,
      t("basicBenchmarking.kpis.registeredMembers"),
      "count",
      "membership",
      t("basicBenchmarking.descs.registeredMembers"),
    ),
    metric(
      keys.activeMembers,
      t("basicBenchmarking.kpis.activeMembers"),
      "count",
      "membership",
      t("basicBenchmarking.descs.activeMembers"),
    ),
    metric(
      keys.maleMembers,
      t("basicBenchmarking.kpis.maleMembers"),
      "count",
      "membership",
      t("basicBenchmarking.descs.maleMembers"),
    ),
    metric(
      keys.femaleMembers,
      t("basicBenchmarking.kpis.femaleMembers"),
      "count",
      "membership",
      t("basicBenchmarking.descs.femaleMembers"),
    ),
    metric(
      keys.age18_25,
      t("basicBenchmarking.kpis.age18_25"),
      "count",
      "membership",
      t("basicBenchmarking.descs.age18_25"),
    ),
    metric(
      keys.age26_35,
      t("basicBenchmarking.kpis.age26_35"),
      "count",
      "membership",
      t("basicBenchmarking.descs.age26_35"),
    ),
    metric(
      keys.age36_60,
      t("basicBenchmarking.kpis.age36_60"),
      "count",
      "membership",
      t("basicBenchmarking.descs.age36_60"),
    ),
    metric(
      keys.age61Plus,
      t("basicBenchmarking.kpis.age61Plus"),
      "count",
      "membership",
      t("basicBenchmarking.descs.age61Plus"),
    ),
    // --- Financial Balances ---
    metric(
      keys.shareCapital,
      t("basicBenchmarking.kpis.shareCapital"),
      "SZL",
      "balances",
      t("basicBenchmarking.descs.shareCapital"),
    ),
    metric(
      keys.borrowedFunds,
      t("basicBenchmarking.kpis.borrowedFunds"),
      "SZL",
      "balances",
      t("basicBenchmarking.descs.borrowedFunds"),
    ),
    metric(
      keys.savingsValue,
      t("basicBenchmarking.kpis.savingsValue"),
      "SZL",
      "balances",
      t("basicBenchmarking.descs.savingsValue"),
    ),
    metric(
      keys.loansOutstanding,
      t("basicBenchmarking.kpis.loansOutstanding"),
      "SZL",
      "balances",
      t("basicBenchmarking.descs.loansOutstanding"),
    ),
    // --- Income & Surplus ---
    metric(
      keys.income,
      t("basicBenchmarking.kpis.income"),
      "SZL",
      "income",
      t("basicBenchmarking.descs.income"),
    ),
    metric(
      keys.expenditure,
      t("basicBenchmarking.kpis.expenditure"),
      "SZL",
      "income",
      t("basicBenchmarking.descs.expenditure"),
      true, // lower is better (cost control)
    ),
    metric(
      keys.netIncome,
      t("basicBenchmarking.kpis.netIncome"),
      "SZL",
      "income",
      t("basicBenchmarking.descs.netIncome"),
    ),
  ];
}
